const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeElement(tagName = 'DIV') {
    return {
        tagName, style: {}, listeners: {}, children: [], captured: new Set(),
        clientWidth: 600, clientHeight: 500, currentTime: 0,
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
        dispatch(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); },
        pause() {}, play() { return Promise.resolve(); },
        appendChild(child) { this.children.push(child); },
        querySelector() { return this; }, closest() { return null; },
        getContext() { return {}; },
        setPointerCapture(id) { this.captured.add(id); },
        hasPointerCapture(id) { return this.captured.has(id); },
        releasePointerCapture(id) { this.captured.delete(id); },
        getBoundingClientRect() { return { left: 20, top: 30, width: this.width, height: this.height }; }
    };
}

async function createGame() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
    };
    const document = Object.assign(makeElement(), {
        hidden: false, activeElement: null,
        getElementById: element, querySelector: element, createElement: () => makeElement()
    });
    const window = makeElement();
    let randomSeed = 3456;
    const math = Object.create(Math);
    math.random = () => ((randomSeed = (1664525 * randomSeed + 1013904223) >>> 0) / 4294967296);
    const context = vm.createContext({
        console, document, window, Math: math, Image: class {},
        setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
        loadLanguage: async () => {}, initializeChat() {}, t: key => key,
        showScorePopup() {}, playRandomBackgroundMusic() {},
        AudioManager: class {
            initAudio() {} isMutedState() { return true; }
            playRandomBackgroundMusic() {} playSound() {}
        },
        firebase: { apps: [{}], firestore: () => ({}), app: () => ({ functions: () => ({}) }) },
        alarmSound: element('alarmSound'), explosionSound: element('explosionSound'),
        goodJobSound: element('goodJobSound'), ohNoSound: element('ohNoSound'),
        gunModeLoopSound: element('gunModeLoopSound')
    });
    const source = name => fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8');
    vm.runInContext(source('GameObjects.js'), context);
    vm.runInContext(source('Game.js'), context);
    vm.runInContext('Game.prototype.gameLoop = function () {};', context);
    vm.runInContext(source('main.js'), context);
    await window.listeners.load[0]();
    const game = vm.runInContext('game', context);
    game.start();
    game.isGunMode = true;
    const canvas = element('gameCanvas');
    function pointer(name, x, y, type = 'touch', id = 1) {
        const event = {
            pointerType: type, pointerId: id, isPrimary: true,
            clientX: x + 20, clientY: y + 30, target: canvas,
            button: 0, buttons: name === 'pointerup' || (type === 'mouse' && name === 'pointermove') ? 0 : 1, cancelable: true, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };
        canvas.dispatch(name, event);
        return event;
    }
    return { game, canvas, context, document, window, pointer };
}

function stack(x, y = 100) { return { x, y, size: 30, color: '#ff0000' }; }

test('start is safe before initialization and repeated starts do not reset a running round', async () => {
    const early = vm.createContext({
        window: { addEventListener() {} },
        firebase: { apps: [{}], firestore: () => ({}), app: () => ({ functions: () => ({}) }) }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/main.js'), 'utf8'), early);
    assert.doesNotThrow(() => vm.runInContext('startGame(); restartGame();', early));
    const { game, context, document } = await createGame();
    assert.equal(document.getElementById('startGameButton').disabled, false);
    const startedAt = game.gameStartTime;
    game.score = 37;
    vm.runInContext('startGame()', context);
    assert.equal(game.gameStartTime, startedAt);
    assert.equal(game.score, 37);
});

test('touch pause button pauses and resumes without a keyboard', async () => {
    const { game, document } = await createGame();
    const button = document.getElementById('pauseButton');
    assert.equal(button.disabled, false);
    button.dispatch('click');
    assert.equal(game.paused, true);
    assert.equal(button.textContent, '▶');
    button.dispatch('click');
    assert.equal(game.paused, false);
    assert.equal(button.textContent, '⏸');
});

test('AI touch tap and drag destroy targeted documents while suppressing page scrolling', async () => {
    const { game, pointer } = await createGame();
    game.stackedDocuments = [stack(100), stack(200)];
    const down = pointer('pointerdown', 110, 110);
    assert.equal(down.defaultPrevented, true);
    assert.equal(game.stackedDocuments.length, 1);
    assert.equal(game.score, 10);
    const move = pointer('pointermove', 210, 110);
    assert.equal(move.defaultPrevented, true);
    assert.equal(game.stackedDocuments.length, 0);
    assert.equal(game.score, 20);
    pointer('pointerup', 210, 110);
    assert.equal(game.score, 20, 'release must not repeat the touch hit');
});

for (const release of ['pointerup', 'pointercancel']) {
    test(`AI touch ${release} ends the drag and prevents later hover hits`, async () => {
        const { game, pointer } = await createGame();
        pointer('pointerdown', 50, 100);
        pointer(release, 50, 100);
        game.stackedDocuments = [stack(200)];
        pointer('pointermove', 210, 110);
        assert.equal(game.stackedDocuments.length, 1);
        assert.equal(game.score, 0);
        pointer('pointerdown', 210, 110);
        assert.equal(game.stackedDocuments.length, 0, 'a fresh touch must still work');
    });
}

test('AI mouse hover still destroys real moving documents without requiring a pressed button', async () => {
    const { game, context, pointer } = await createGame();
    const doc = vm.runInContext("new Document(100, 100, 40, '#ff0000', 180)", context);
    game.documents = [doc];
    const expected = doc.getScore();
    pointer('pointermove', 110, 110, 'mouse');
    assert.equal(doc.clicked, true);
    assert.equal(game.score, expected);
    pointer('pointermove', 110, 110, 'mouse');
    assert.equal(game.score, expected, 'hover must not score an already destroyed document');
});

for (const state of ['paused', 'gameOver', 'stopped', 'normalMode']) {
    test(`AI pointer input cannot destroy documents while ${state}`, async () => {
        const { game, pointer } = await createGame();
        game.stackedDocuments = [stack(100)];
        if (state === 'stopped') game.gameRunning = false;
        else if (state === 'normalMode') game.isGunMode = false;
        else game[state] = true;
        pointer('pointerdown', 110, 110);
        pointer('pointermove', 110, 110);
        pointer('pointermove', 110, 110, 'mouse');
        assert.equal(game.stackedDocuments.length, 1);
        assert.equal(game.score, 0);
    });
}

test('AI touch removal of an active bomb also cancels the bomb state', async () => {
    const { game, pointer } = await createGame();
    const bomb = stack(100);
    game.stackedDocuments = [bomb];
    Object.assign(game, { bombDocument: bomb, bombRemainingTime: 1000, bombSirenPlaying: true });
    pointer('pointerdown', 110, 110);
    assert.equal(game.bombDocument, null);
    assert.equal(game.bombRemainingTime, 0);
    assert.equal(game.stackedDocuments.length, 0);
    assert.equal(game.score, 10);
});

test('AI keyboard shortcut leaves the name input text and tokens unchanged', async () => {
    const { game, document } = await createGame();
    const input = Object.assign(makeElement('INPUT'), { id: 'popupPlayerName' });
    document.activeElement = input;
    const tokens = game.aiTokens;
    let prevented = false;
    document.dispatch('keydown', { key: 'a', target: input, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(game.aiTokens, tokens);
});
