const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// These DOM doubles reject HTML parsing, so untrusted values must be text nodes.
class Element {
    constructor(tagName = 'div') {
        this.tagName = tagName;
        this.childNodes = [];
        this.dataset = {};
        this.style = {};
        this.value = '';
        this.scrollTop = 0;
        this.classList = { add() {}, remove() {} };
    }
    get children() { return this.childNodes.filter(node => node.tagName !== '#text'); }
    get scrollHeight() { return this.children.length * 20; }
    get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
    set textContent(value) { this.childNodes = [{ tagName: '#text', textContent: String(value) }]; }
    set innerHTML(value) {
        assert.equal(value, '', 'Rendering must not parse untrusted HTML');
        this.childNodes = [];
    }
    append(...nodes) { this.childNodes.push(...nodes); }
    appendChild(node) { this.append(node); return node; }
    prepend(node) { this.childNodes.unshift(node); }
    replaceChildren(...nodes) { this.childNodes = nodes; }
    addEventListener() {}
    getAttribute(name) { return this.attributes?.[name] ?? null; }
}

function makeContext(extra = {}) {
    const elements = new Map();
    const context = vm.createContext({
        console: { error() {}, warn() {}, log() {} },
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, new Element());
                return elements.get(id);
            },
            createElement: tag => new Element(tag),
            createTextNode: value => ({ tagName: '#text', textContent: String(value) }),
            addEventListener() {}
        },
        window: { addEventListener() {} },
        setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
        currentLanguage: 'ko',
        translations: { saveFailed: '저장 실패', scoreSaved: '저장 완료', savingScore: '저장 중' },
        ...extra
    });
    return { context, elements };
}

function load(context, file) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context);
}

function makeChat(extra) {
    const fixture = makeContext(extra);
    load(fixture.context, 'Chat.js');
    const chat = vm.runInContext('Object.create(ChatSystem.prototype)', fixture.context);
    Object.assign(chat, {
        chatMessages: new Element(), messageCache: new Map(),
        chatInput: new Element('textarea'), usernameInput: new Element('input'),
        sendButton: new Element('button'), lastSendTime: 0, SEND_COOLDOWN: 30000,
        showToast(message) { this.lastToast = message; }
    });
    return { ...fixture, chat };
}

function message(id, fields = {}) {
    return { id: String(id), username: '익명', message: `메시지 ${id}`,
        timestamp: new Date(Number(id) * 1000).toISOString(), deleteVotes: 0, ...fields };
}

test('chat renders stored HTML in every user-controlled field as literal text', () => {
    const { chat } = makeChat();
    const payload = '<svg onload=alert(1)>';
    const hostile = message(1, { username: payload, message: payload, maskedIP: payload,
        id: '\"><img src=x onerror=alert(1)>' });
    chat.displayMessages([hostile]);
    chat.prependMessages([message(0, { message: payload })]);
    assert.equal(chat.chatMessages.children.length, 2);
    assert.equal(chat.chatMessages.children[1].dataset.messageId, hostile.id);
    assert.equal(chat.chatMessages.children[1].textContent.split(payload).length - 1, 3);
    assert.ok(chat.chatMessages.children[0].textContent.includes(payload));
    assert.equal(chat.findMessageElement(hostile.id), chat.chatMessages.children[1]);
});

test('older chat pages stay chronological and maintain the visible scroll position', () => {
    const { chat } = makeChat();
    chat.displayMessages([message(11), message(12), message(13)]);
    chat.chatMessages.scrollTop = 0;
    const older = [message(8), message(9), message(10)];
    chat.prependMessages(older);
    assert.deepEqual(chat.chatMessages.children.map(item => item.dataset.messageId), ['8', '9', '10', '11', '12', '13']);
    assert.equal(chat.chatMessages.scrollTop, 60);
    assert.deepEqual(older.map(item => item.id), ['8', '9', '10']);
    chat.prependMessages(older);
    assert.equal(chat.chatMessages.children.length, 6);
});

test('chat service failure keeps the draft and never writes directly to Firestore', async () => {
    let directWrites = 0;
    const { chat } = makeChat({ db: { collection() { directWrites++; throw new Error('Forbidden'); } } });
    chat.chatInput.value = '보관할 메시지';
    await chat.sendMessage();
    assert.equal(directWrites, 0);
    assert.equal(chat.chatInput.value, '보관할 메시지');
    assert.equal(chat.lastSendTime, 0);
    assert.ok(chat.lastToast.includes('실패'));
});

test('normal chat send obtains a validation token and clears the draft after success', async () => {
    const calls = [];
    const { chat } = makeChat({ functions: { httpsCallable: name => async data => {
        calls.push({ name, data });
        return { data: { success: true, token: 'validation-token' } };
    } } });
    chat.chatInput.value = '안녕하세요';
    await chat.sendMessage();
    assert.deepEqual(calls.map(call => call.name), ['getValidationToken', 'sendChatMessage']);
    assert.equal(calls[1].data.validationToken, 'validation-token');
    assert.equal(calls[1].data.message, '안녕하세요');
    assert.equal(chat.chatInput.value, '');
});

test('leaderboard reads its public callable projection and renders legacy HTML safely', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const calls = [];
    const { context, elements } = makeContext({
        functions: { httpsCallable: name => async () => {
            calls.push(name);
            return { data: { success: true, scores: [{ id: '1', playerName: payload, flag: payload,
                score: 1234, timestamp: { seconds: Math.floor(Date.now() / 1000) } }] } };
        } },
        db: { collection() { throw new Error('No direct Firestore reads'); } },
        getCountryFlag() { return '🌍'; }
    });
    load(context, 'LeaderBoard.js');
    await context.loadLeaderboard();
    const rendered = elements.get('leaderboardList');
    assert.deepEqual(calls, ['getLeaderboard']);
    assert.equal(rendered.children.length, 1);
    assert.equal(rendered.textContent.split(payload).length - 1, 2);
    assert.ok(rendered.textContent.includes('1,234점'));
    assert.ok(rendered.textContent.includes('🥇'));
});

test('leaderboard distinguishes an empty result from a rejected request', async () => {
    let success = true;
    const { context, elements } = makeContext({ functions: { httpsCallable: () => async () => ({ data: { success, scores: [] } }) } });
    load(context, 'LeaderBoard.js');
    await context.loadLeaderboard();
    assert.equal(elements.get('leaderboardList').textContent, '아직 점수가 없습니다');
    success = false;
    await context.loadLeaderboard();
    assert.equal(elements.get('leaderboardList').textContent, '랭킹 불러오기 실패');
});

function makeScoreUI(success) {
    const fixture = makeContext({
        fetch: async () => ({ ok: true, json: async () => ({ country_name: 'South Korea', country_code: 'KR' }) }),
        functions: { httpsCallable: name => async () => ({ data: name === 'getValidationToken'
            ? { success: true, token: 'validation-token' }
            : { success, message: success ? 'Saved' : 'Score too low to be saved in top 50' } }) },
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } }
    });
    load(fixture.context, 'UI.js');
    return fixture;
}

test('score rejection is propagated and the popup displays the server reason', async () => {
    const { context, elements } = makeScoreUI(false);
    const result = await context.saveScore('테스트', 1);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Score too low to be saved in top 50');
    context.document.getElementById('popupPlayerName').value = '테스트';
    context.document.getElementById('popupScore').attributes = { 'data-score': '1' };
    await context.submitScoreFromPopup();
    assert.equal(elements.get('popupStatus').textContent, 'Score too low to be saved in top 50');
    assert.equal(elements.get('popupSubmitBtn').disabled, false);
});

test('accepted scores still report success', async () => {
    const { context } = makeScoreUI(true);
    const result = await context.saveScore('테스트', 1234);
    assert.equal(result.success, true);
    assert.equal(result.error, null);
});
