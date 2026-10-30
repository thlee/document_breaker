const { test } = require('node:test');
const assert = require('node:assert/strict');

// Run only against an explicitly configured, local demo emulator.
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = 'demo-document-breaker';

test('private chat, scores and validation tokens deny all direct client access', {
  skip: !host && 'Run with firebase emulators:exec --only firestore --project demo-document-breaker',
}, async () => {
  assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
  const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
  const fields = {
    username: { stringValue: 'test' },
    message: { stringValue: 'ordinary valid message' },
    timestamp: { timestampValue: '2026-01-01T00:00:00Z' },
    score: { integerValue: '100' },
    ip: { stringValue: '192.0.2.1' },
  };

  // Emulator-only administrator credentials seed legacy private fields.
  for (const collection of ['chat', 'scores', 'validation_tokens', '_internal']) {
    const url = `${base}/${collection}/rules-test`;
    const seed = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields }),
    });
    assert.equal(seed.status, 200, `seed ${collection}: ${await seed.text()}`);

    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const result = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'PATCH' ? { body: JSON.stringify({ fields }) } : {}),
      });
      assert.equal(result.status, 403, `${method} ${collection}: ${await result.text()}`);
    }

    const create = await fetch(`${base}/${collection}?documentId=client-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    assert.equal(create.status, 403, `create ${collection}: ${await create.text()}`);

    const list = await fetch(`${base}/${collection}`);
    assert.equal(list.status, 403, `list ${collection}: ${await list.text()}`);
  }
});
