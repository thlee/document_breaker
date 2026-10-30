const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGame() {
  let randomValues = [];
  const randomMath = Object.create(Math);
  randomMath.random = () => randomValues.length ? randomValues.shift() : 0.5;
  const canvas = { width: 800, height: 600 };
  const context = vm.createContext({ Math: randomMath, canvas });
  for (const file of ['GameObjects.js', 'Game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context);
  }
  const Game = vm.runInContext('Game', context);
  const Document = vm.runInContext('Document', context);
  return {
    Document,
    canvas,
    Star: vm.runInContext('Star', context),
    Newbie: vm.runInContext('Newbie', context),
    spawn(score, lifetimeRandom) {
      // Keep size/position/color identical; vary only the lifespan draw.
      randomValues = [0, 0, 0, 0, lifetimeRandom];
      const state = Object.assign(Object.create(Game.prototype), {
        score, canvas: { width: 800, height: 600 }, documents: []
      });
      Game.prototype.spawnDocument.call(state);
      return state.documents[0];
    }
  };
}

test('actual document spawning produces different lifetime rewards at equal size', () => {
  const game = loadGame();
  const shortest = game.spawn(0, 0);
  const longest = game.spawn(0, 0.999);
  assert.equal(shortest.size, longest.size);
  assert.equal(shortest.lifespan, 180);
  assert.ok(longest.lifespan > 359 && longest.lifespan <= 360);
  assert.equal(shortest.getScore(), 20);
  assert.equal(longest.getScore(), 10);
});

test('higher difficulty shortens actual spawned lifetimes and increases their reward', () => {
  const game = loadGame();
  const documents = [0, 100, 250].map(score => game.spawn(score, 0.9));
  assert.ok(documents[0].lifespan > documents[1].lifespan);
  assert.ok(documents[1].lifespan > documents[2].lifespan);
  assert.equal(documents[2].lifespan, 180);
  assert.ok(documents[0].getScore() < documents[1].getScore());
  assert.ok(documents[1].getScore() < documents[2].getScore());
  assert.equal(game.spawn(100000, 0.9).getScore(), documents[2].getScore());
});

test('size reward remains bounded and smaller documents retain their bonus', () => {
  const { Document } = loadGame();
  const reward = (size, lifespan) => new Document(0, 0, size, '#fff', lifespan).getScore();
  assert.equal(reward(30, 180), 20);
  assert.equal(reward(50, 180), 10);
  assert.equal(reward(70, 180), 10);
  assert.equal(reward(30, 360), 10);
  assert.equal(reward(70, 360), 5);
});

test('malformed dimensions and lifetimes cannot produce invalid or unbounded scores', () => {
  const { Document } = loadGame();
  for (const size of [NaN, Infinity, -Infinity, -100, undefined, '30']) {
    for (const lifespan of [NaN, Infinity, -Infinity, -1, 0, undefined, '180']) {
      const score = new Document(0, 0, size, '#fff', lifespan).getScore();
      assert.ok(Number.isSafeInteger(score));
      assert.ok(score >= 5 && score <= 20);
    }
  }
});

test('moving documents, mail and newbies stay within a short mobile viewport', () => {
  const { Document, Star, Newbie, canvas } = loadGame();
  canvas.width = 80;
  canvas.height = 60;
  const objects = [new Document(-5, 80, 30, '#fff', 180), new Star(-5, 80, 30, 180), new Newbie(-5, 80, 30, 180)];
  for (const object of objects) {
    object.update();
    assert.ok(object.x >= 0 && object.x + object.size <= canvas.width);
    assert.ok(object.y >= 0 && object.y + object.size <= canvas.height);
  }
});
