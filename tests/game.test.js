const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeElement() {
    return {
        style: {}, listeners: {}, children: [], clientWidth: 800, clientHeight: 600,
        pauseCalls: 0, currentTime: 0,
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
        pause() { this.pauseCalls++; },
        play() { return Promise.resolve(); },
        appendChild(child) { this.children.push(child); },
        querySelector() { return this; },
        getContext() { return {}; },
        getBoundingClientRect() { return { left: 0, top: 0 }; }
    };
}

async function createGame() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
    };
    const document = {
        getElementById: element,
        querySelector: element,
        createElement: makeElement,
        addEventListener() {}
    };
    const window = makeElement();
    const math = Object.create(Math);
    math.random = () => 0.99;
    const context = vm.createContext({
        console, document, window, Math: math, Date,
        Image: class {}, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
        loadLanguage: async () => {}, initializeChat() {},
        t: key => key, showScorePopup() {}, playRandomBackgroundMusic() {},
        AudioManager: class {
            initAudio() {}
            isMutedState() { return true; }
        },
        firebase: { apps: [{}], firestore: () => ({}), app: () => ({ functions: () => ({}) }) },
        alarmSound: element('alarmSound'), explosionSound: element('explosionSound'),
        goodJobSound: element('goodJobSound'), ohNoSound: element('ohNoSound'),
        gunModeLoopSound: element('gunModeLoopSound')
    });
    const source = name => fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', name), 'utf8');
    vm.runInContext(source('Game.js'), context, { filename: 'Game.js' });
    // These tests exercise state and real input handlers without a renderer or animation scheduler.
    vm.runInContext('Game.prototype.gameLoop = function () {};', context);
    vm.runInContext(source('main.js'), context, { filename: 'main.js' });
    await window.listeners.load[0]();
    const game = vm.runInContext('game', context);
    game.gameRunning = true;
    const move = (x, y) => element('gameCanvas').listeners.pointermove[0]({ pointerType: 'mouse', clientX: x, clientY: y });
    return { game, move, element };
}

function addDocuments(game) {
    const first = { x: 100, y: 100, size: 30, color: '#ff0000' };
    const target = { x: 400, y: 400, size: 30, color: '#00ff00' };
    game.stackedDocuments = [first, target];
    game.spawnBombDocument(); // Deterministic random selection chooses the final document.
    return { first, target };
}

for (const [name, state] of [
    ['paused', { paused: true }],
    ['game over', { gameOver: true }],
    ['stopped', { gameRunning: false }]
]) {
    test(`AI mouse input cannot change score or documents while ${name}`, async () => {
        const { game, move } = await createGame();
        let clicks = 0;
        game.documents = [{ x: 10, y: 10, size: 30, click() { clicks++; return true; }, getScore: () => 8 }];
        game.stackedDocuments = [{ x: 10, y: 10, size: 30, color: '#ff0000' }];
        Object.assign(game, { isGunMode: true }, state);
        move(20, 20);
        assert.equal(clicks, 0);
        assert.equal(game.score, 0);
        assert.equal(game.stackedDocuments.length, 1);
    });
}

test('AI input still destroys documents and awards points during normal play', async () => {
    const { game, move } = await createGame();
    let clicks = 0;
    game.documents = [{ x: 10, y: 10, size: 30, click() { clicks++; return true; }, getScore: () => 8 }];
    game.stackedDocuments = [{ x: 100, y: 100, size: 30, color: '#ff0000' }];
    game.isGunMode = true;
    move(20, 20);
    move(110, 110);
    assert.equal(clicks, 1);
    assert.equal(game.score, 18);
    assert.equal(game.stackedDocuments.length, 0);
});

test('AI removal before the bomb keeps the same bomb clickable and defusable', async () => {
    const { game, move } = await createGame();
    const { target } = addDocuments(game);
    game.isGunMode = true;
    move(110, 110);
    assert.equal(game.bombDocument, target);
    assert.equal(game.stackedDocuments[0], target);
    game.handleClick(410, 410);
    assert.equal(game.bombDocument, null);
    assert.equal(game.stackedDocuments.length, 0);
    assert.equal(game.score, 60);
});

test('AI removal of the bomb cancels its timer and alarm without a later penalty', async () => {
    const { game, move, element } = await createGame();
    const { first } = addDocuments(game);
    game.isGunMode = true;
    game.bombSirenPlaying = true;
    const alarm = element('alarmSound');
    const pauses = alarm.pauseCalls;
    alarm.currentTime = 3;
    move(410, 410);
    assert.equal(game.bombDocument, null);
    assert.equal(game.bombRemainingTime, 0);
    assert.equal(game.bombSirenPlaying, false);
    assert.equal(alarm.pauseCalls, pauses + 1);
    assert.equal(alarm.currentTime, 0);
    game.updateBombTimer(Date.now() + 30000, 30000);
    assert.equal(game.score, 10);
    assert.equal(game.stackedDocuments.length, 1);
    assert.equal(game.stackedDocuments[0], first);
});

for (const hitTarget of [false, true]) {
    test(`boss ball removal ${hitTarget ? 'of' : 'before'} the bomb preserves bomb state correctly`, async () => {
        const { game, element } = await createGame();
        const { target } = addDocuments(game);
        const pauses = element('alarmSound').pauseCalls;
        Object.assign(game, {
            blockBreakerMode: true, blockBreakerStartTime: Date.now(),
            ballX: hitTarget ? 410 : 110, ballY: hitTarget ? 410 : 110,
            ballVX: 0, ballVY: 0
        });
        game.updateBlockBreaker();
        assert.equal(game.stackedDocuments.length, 1);
        assert.equal(game.score, 20);
        assert.equal(game.bombDocument, hitTarget ? null : target);
        if (hitTarget) {
            assert.equal(element('alarmSound').pauseCalls, pauses + 1);
            game.updateBombTimer(Date.now() + 30000, 30000);
            assert.equal(game.score, 20);
            assert.equal(game.stackedDocuments.length, 1);
        }
    });
}

test('job change clears the bomb and stops its alarm', async () => {
    const { game, element } = await createGame();
    addDocuments(game);
    game.bombSirenPlaying = true;
    const pauses = element('alarmSound').pauseCalls;
    game.triggerJobChange();
    assert.equal(game.bombDocument, null);
    assert.equal(game.bombRemainingTime, 0);
    assert.equal(game.bombSirenPlaying, false);
    assert.equal(game.stackedDocuments.length, 0);
    assert.equal(element('alarmSound').pauseCalls, pauses + 1);
});

test('a bomb that remains in the stack still applies its normal timeout penalty', async () => {
    const { game } = await createGame();
    addDocuments(game);
    game.score = 100;
    game.updateBombTimer(Date.now() + 30000, 30000);
    assert.equal(game.score, 50);
    assert.equal(game.stackedDocuments.length, 5);
    assert.equal(game.bombDocument, null);
    assert.equal(game.bombRemainingTime, 0);
});

test('game over and reset end AI mode and clear bomb state', async () => {
    const { game, element } = await createGame();
    addDocuments(game);
    game.isGunMode = true;
    game.gunModeEndTime = Date.now() + 5000;
    element('gameCanvas').style.cursor = 'crosshair';
    await game.endGame();
    assert.equal(game.isGunMode, false);
    assert.equal(game.gunModeEndTime, 0);
    assert.equal(element('gameCanvas').style.cursor, '');
    assert.equal(game.bombDocument, null);
    game.isGunMode = true;
    game.gunModeEndTime = Date.now() + 5000;
    element('gameCanvas').style.cursor = 'crosshair';
    game.reset();
    assert.equal(game.isGunMode, false);
    assert.equal(game.gunModeEndTime, 0);
    assert.equal(element('gameCanvas').style.cursor, '');
    assert.equal(game.aiTokens, game.CONSTANTS.AI_TOKENS_START);
});
