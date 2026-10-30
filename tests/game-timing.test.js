const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeElement(tagName = 'DIV') {
    return {
        tagName, style: {}, listeners: {}, children: [], clientWidth: 800, clientHeight: 600,
        currentTime: 0, value: '',
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
        dispatch(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); },
        pause() {}, play() { return Promise.resolve(); },
        appendChild(child) { this.children.push(child); },
        querySelector() { return this; }, closest() { return null; },
        getContext() { return {}; },
        getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
    };
}

function createGame() {
    let now = 1800000000000;
    let randomSeed = 123456;
    let timerId = 0;
    const timers = new Map();
    const frames = [];
    const popups = [];
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
    const math = Object.create(Math);
    math.random = () => ((randomSeed = (1664525 * randomSeed + 1013904223) >>> 0) / 4294967296);
    class ClockDate extends Date { static now() { return now; } }
    const context = vm.createContext({
        console, document, window, Math: math, Date: ClockDate, Image: class {},
        performance: { now: () => now - 1800000000000 },
        setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
        audioContext: null, audioManager: null, isMuted: true,
        canvas: element('gameCanvas'), t: key => key, playSound() {}, playRandomBackgroundMusic() {},
        showScorePopup: score => popups.push(score),
        alarmSound: element('alarmSound'), explosionSound: element('explosionSound'),
        goodJobSound: element('goodJobSound'), ohNoSound: element('ohNoSound'),
        newbieAppearSound0: element('newbieAppearSound0'), newbieAppearSound1: element('newbieAppearSound1'),
        bossAppearSound0: element('bossAppearSound0'), bossAppearSound1: element('bossAppearSound1'),
        goodByeSound: element('goodByeSound'), gunModeLoopSound: element('gunModeLoopSound')
    });
    const source = name => fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8');
    vm.runInContext(source('GameObjects.js'), context);
    vm.runInContext(source('Game.js'), context);
    // Drawing has no bearing on simulation timing; keep the real animation loop and entity updates.
    vm.runInContext('Game.prototype.draw = function () {}; globalThis.game = new Game();', context);
    const game = context.game;
    game.start();
    return {
        game, context, document, window, element, popups,
        get now() { return now; },
        setClock(value) { now = value; },
        frameAt(value) {
            now = value;
            assert.equal(frames.length, 1, 'exactly one animation loop should be scheduled');
            frames.shift()(now - 1800000000000);
        },
        runTimersAt(value) {
            now = value;
            for (const [id, timer] of [...timers]) {
                if (timer.at <= now) { timers.delete(id); timer.callback(); }
            }
        },
        newDocument(lifespan = 120) {
            return vm.runInContext(`new Document(100, 150, 30, '#ff0000', ${lifespan})`, context);
        }
    };
}

test('document lifetime and motion are consistent at 30/60/120/144 Hz', () => {
    const observations = [];
    for (const hz of [30, 60, 120, 144]) {
        const fixture = createGame();
        const { game } = fixture;
        game.updateSpawnTimers = () => {}; // isolate one real document from random spawns
        const doc = fixture.newDocument();
        Object.assign(doc, { vx: 1, vy: 0 });
        game.documents = [doc];
        const start = fixture.now;
        for (let frame = 1; frame <= hz; frame++) fixture.frameAt(start + frame * 1000 / hz);
        const positionAtOneSecond = doc.x;
        const ageAtOneSecond = doc.age;
        let expiredAt;
        for (let frame = hz + 1; frame <= hz * 3; frame++) {
            fixture.frameAt(start + frame * 1000 / hz);
            if (!game.documents.includes(doc)) { expiredAt = fixture.now - start; break; }
        }
        assert.ok(Math.abs(ageAtOneSecond - 60) <= 1, `${hz} Hz age=${ageAtOneSecond}`);
        assert.ok(Math.abs(positionAtOneSecond - 160) <= 1, `${hz} Hz x=${positionAtOneSecond}`);
        assert.ok(expiredAt >= 1980 && expiredAt <= 2040, `${hz} Hz lifetime=${expiredAt}ms`);
        assert.equal(game.stackedDocuments.length, 1);
        observations.push({ age: ageAtOneSecond, x: positionAtOneSecond });
    }
    assert.ok(Math.max(...observations.map(item => item.x)) - Math.min(...observations.map(item => item.x)) <= 1);
});

test('hidden-tab pause and immediate resume do not age documents or consume the bomb timeout', () => {
    const fixture = createGame();
    const { game, document } = fixture;
    game.updateSpawnTimers = () => {};
    const doc = fixture.newDocument(1000);
    game.documents = [doc];
    const bomb = { x: 300, y: 200, size: 30, color: '#ff0000' };
    game.stackedDocuments = [bomb];
    Object.assign(game, { bombDocument: bomb, bombRemainingTime: 15000, bombStartTime: fixture.now });
    fixture.frameAt(fixture.now + 100);
    const age = doc.age;
    const remaining = game.bombRemainingTime;
    document.hidden = true;
    document.dispatch('visibilitychange');
    assert.equal(game.paused, true);
    fixture.setClock(fixture.now + 60000); // no rAF callbacks while hidden
    document.hidden = false;
    document.dispatch('visibilitychange');
    if (game.paused) game.togglePause();
    fixture.frameAt(fixture.now + 17);
    assert.ok(doc.age - age <= 2, `resuming added ${doc.age - age} simulation ticks`);
    assert.ok(game.bombRemainingTime >= remaining - 35);
    assert.equal(game.gameOver, false);
});

test('a bomb ending the game prevents a same-frame breaker collision and freezes the final score', () => {
    const fixture = createGame();
    const { game } = fixture;
    game.stackedDocuments = Array.from({ length: 22 }, (_, index) => ({
        x: index === 0 ? 100 : 350, y: 200, size: 30, color: '#ff0000'
    }));
    Object.assign(game, {
        score: 100, bombDocument: game.stackedDocuments[21], bombRemainingTime: 1,
        bombStartTime: fixture.now, blockBreakerMode: true, blockBreakerStartTime: fixture.now,
        ballX: 110, ballY: 210, ballVX: 0, ballVY: 0
    });
    fixture.frameAt(fixture.now + 20);
    assert.equal(game.gameOver, true);
    assert.equal(game.score, 50, 'there must be no +20 breaker score after the fatal bomb');
    assert.equal(game.stackedDocuments.length, 25);
    fixture.runTimersAt(fixture.now + 1000);
    assert.deepEqual(fixture.popups, [50]);
});

test('score popup uses the completed score snapshot and reset cancels the previous session popup', async () => {
    const fixture = createGame();
    fixture.game.score = 123;
    await fixture.game.endGame();
    fixture.game.score = 999;
    fixture.runTimersAt(fixture.now + 1000);
    assert.deepEqual(fixture.popups, [123]);

    const restarted = createGame();
    restarted.game.score = 100;
    await restarted.game.endGame();
    restarted.game.reset();
    restarted.game.start();
    restarted.game.score = 20;
    restarted.runTimersAt(restarted.now + 1000);
    assert.deepEqual(restarted.popups, []);
});

test('first bomb waits for its configured interval after start and restart', () => {
    const fixture = createGame();
    const { game } = fixture;
    for (let session = 0; session < 2; session++) {
        if (session) { game.reset(); game.start(); }
        const start = fixture.now;
        const interval = game.bombSpawnInterval;
        game.addStackedDocuments(5);
        fixture.setClock(start + 8000);
        game.updateSpawnTimers(fixture.now);
        assert.equal(game.bombDocument, null, 'five documents alone must not bypass the initial delay');
        fixture.setClock(start + interval + 1);
        game.updateSpawnTimers(fixture.now);
        assert.ok(game.bombDocument);
    }
});

test('active bomb remains clickable during breaker mode', () => {
    const fixture = createGame();
    const bomb = { x: 300, y: 200, size: 30, color: '#ff0000' };
    fixture.game.stackedDocuments = [bomb];
    fixture.game.bombDocument = bomb;
    fixture.game.blockBreakerMode = true;
    fixture.game.handleClick(310, 210);
    assert.equal(fixture.game.bombDocument, null);
    assert.equal(fixture.game.stackedDocuments.length, 0);
    assert.equal(fixture.game.score, 50);
});

test('resize preserves bomb identity and moves static and moving targets into the visible canvas', () => {
    const fixture = createGame();
    const { game } = fixture;
    const bomb = { x: 740, y: 550, size: 40, color: '#ff0000' };
    const moving = fixture.newDocument();
    Object.assign(moving, { x: 730, y: 540 });
    game.stackedDocuments = [bomb];
    game.bombDocument = bomb;
    game.documents = [moving];
    game.newbies = [{ x: 750, y: 540, size: 35 }];
    game.stars = [{ x: 760, y: 550, size: 35 }];
    game.aiItems = [{ x: 770, y: 550, size: 35 }];
    Object.assign(fixture.element('.game-container'), { clientWidth: 350, clientHeight: 300 });
    game.resizeCanvas();
    assert.equal(game.bombDocument, bomb);
    for (const item of [bomb, moving, ...game.newbies, ...game.stars, ...game.aiItems]) {
        assert.ok(item.x >= 0 && item.x + item.size <= 350, `target x=${item.x}`);
        assert.ok(item.y >= 80 && item.y + item.size <= 300, `target y=${item.y}`);
    }
    game.handleClick(bomb.x + bomb.size / 2, bomb.y + bomb.size / 2);
    assert.equal(game.bombDocument, null);
    assert.equal(game.score, 50);
});

test('pause shortcuts never prevent typing p/P/space in the player-name input', () => {
    const fixture = createGame();
    fixture.game.gameOver = true;
    fixture.game.gameRunning = false;
    const input = Object.assign(makeElement('INPUT'), { id: 'popupPlayerName' });
    fixture.document.activeElement = input;
    for (const key of ['p', 'P', ' ']) {
        let prevented = false;
        fixture.window.dispatch('keydown', { key, target: input, preventDefault() { prevented = true; } });
        assert.equal(prevented, false, `name character ${JSON.stringify(key)} was blocked`);
    }
});
