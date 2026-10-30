const test = require('node:test');
const assert = require('node:assert/strict');

const host = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = 'demo-document-breaker';

// Run this file and firestore-rules.test.js with --test-concurrency=1:
// the leaderboard transaction intentionally operates on the whole collection.
test('backend transactions and privacy against the Firestore emulator', {
  skip: !host && 'Run with the local demo-document-breaker Firestore emulator',
  timeout: 90000,
}, async t => {
  assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (process.env[key]) assert.equal(process.env[key], projectId);
    process.env[key] = projectId;
  }
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });
  const admin = require('../functions/node_modules/firebase-admin');
  const api = require('../functions/index.js');
  const db = admin.firestore();
  assert.equal(admin.app().options.projectId, projectId);
  assert.equal(typeof api.submitScore.run, 'function');

  const prefix = 'backend-emulator-';
  const tokenIds = new Set();
  const request = (data, ip = '192.0.2.101') => ({ data, rawRequest: { headers: { 'x-forwarded-for': ip } } });
  const token = async (actionType, ip) => {
    const result = await api.getValidationToken.run(request({ actionType }, ip));
    tokenIds.add(result.token);
    return result.token;
  };
  t.after(async () => {
    try {
      for (const collection of ['scores', 'chat', 'validation_tokens']) {
        const snapshot = await db.collection(collection).get();
        const owned = snapshot.docs.filter(doc => doc.id.startsWith(prefix) || tokenIds.has(doc.id) ||
          (collection === 'scores' && ['emuScore1', 'emuScore2'].includes(doc.data().playerName)));
        await Promise.all(owned.map(doc => doc.ref.delete()));
      }
    } finally {
      await db.terminate();
      await admin.app().delete();
    }
  });

  await t.test('one token cannot authorize two concurrent calls', async () => {
    const validationToken = await token('board_refresh', '192.0.2.101');
    const results = await Promise.allSettled([
      api.validateBoardRefresh.run(request({ validationToken })),
      api.validateBoardRefresh.run(request({ validationToken }))
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected').reason;
    assert.equal(rejected.code, 'permission-denied');
    assert.match(rejected.message, /이미 사용된 토큰/);
    assert.equal((await db.collection('validation_tokens').doc(validationToken).get()).data().used, true);
  });

  await t.test('public projections hide legacy IPs and ignore stored HTML flags', async () => {
    const timestamp = admin.firestore.Timestamp.now();
    await db.collection('chat').doc(prefix + 'legacy').set({
      username: 'Test', message: 'hello', timestamp,
      ip: '198.51.100.12', maskedIP: '198.51.100.12', votedIps: ['203.0.113.99'], deleteVotes: 1
    });
    await db.collection('scores').doc(prefix + 'legacy').set({
      playerName: 'Emu', score: 1, timestamp, countryCode: 'kr',
      flag: '<svg onload=alert(1)>', ip: '198.51.100.12'
    });
    const chat = await api.getChatMessages.run(request({ limit: 100 }));
    const message = chat.messages.find(item => item.id === prefix + 'legacy');
    assert.ok(message);
    assert.equal(message.maskedIP, '198.51.*.**');
    assert.ok(!Object.hasOwn(message, 'ip'));
    assert.ok(!Object.hasOwn(message, 'votedIps'));
    const leaderboard = await api.getLeaderboard.run(request({}));
    const score = leaderboard.scores.find(item => item.id === prefix + 'legacy');
    assert.ok(score);
    assert.equal(score.flag, '🇰🇷');
    assert.ok(!Object.hasOwn(score, 'ip'));
    assert.equal(typeof score.timestamp.seconds, 'number');
  });

  await t.test('deletion requires ownership or three different voters', async () => {
    const messageId = prefix + 'votes';
    const ref = db.collection('chat').doc(messageId);
    await ref.set({ ip: '192.0.2.110', votedIps: [], deleteVotes: 0 });
    const vote = ip => api.deleteChatMessage.run(request({ messageId }, ip));
    assert.equal((await vote('192.0.2.111')).deleted, false);
    await assert.rejects(vote('192.0.2.111'), { code: 'permission-denied' });
    assert.equal((await vote('192.0.2.112')).deleted, false);
    assert.equal((await ref.get()).exists, true);
    assert.equal((await vote('192.0.2.113')).deleted, true);
    assert.equal((await ref.get()).exists, false);
    await ref.set({ ip: '192.0.2.110', votedIps: [], deleteVotes: 0 });
    assert.equal((await vote('192.0.2.110')).deleted, true);
  });

  await t.test('concurrent score transactions preserve exactly the highest 50', async () => {
    const batch = db.batch();
    for (let i = 0; i < 50; i++) {
      batch.set(db.collection('scores').doc(prefix + 'score-' + i), {
        playerName: 'Seed', score: i + 2, timestamp: admin.firestore.Timestamp.now()
      });
    }
    await batch.commit();
    const before = await db.collection('scores').get();
    const expected = [...before.docs.map(doc => doc.data().score), 1000, 1001].sort((a, b) => b - a).slice(0, 50);
    const inputs = await Promise.all([0, 1].map(async i => {
      const ip = '192.0.2.' + (120 + i);
      return request({
        validationToken: await token('score_submit', ip), playerName: 'emuScore' + (i + 1),
        score: 1000 + i, countryCode: 'KR', flag: '<img onerror=alert(1)>'
      }, ip);
    }));
    const results = await Promise.all(inputs.map(input => api.submitScore.run(input)));
    assert.ok(results.every(result => result.success));
    const after = await db.collection('scores').orderBy('score', 'desc').get();
    assert.equal(after.size, 50);
    assert.deepEqual(after.docs.map(doc => doc.data().score), expected);
    assert.equal(after.docs[0].data().flag, '🇰🇷');
  });
});
