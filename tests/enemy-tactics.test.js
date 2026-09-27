"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Tactics = require("../src/enemy-tactics");
const { Engine } = require("../src/engine");

test("enemy identities produce distinct readable combat roles", () => {
  const scout = Tactics.identity("soldier", 1, "earth");
  const artillery = Tactics.identity("frieza", 2, "namek");
  const duelist = Tactics.identity("vegeta", 3, "earth");
  const giant = Tactics.identity("hirudegarn", 4, "demon");
  assert.equal(scout.archetype, "scout");
  assert.equal(artillery.pattern, "beam");
  assert.equal(duelist.archetype, "duelist");
  assert.equal(giant.pattern, "ring");
  assert.equal(Tactics.identity("soldier", 1, "space").pattern, "beam");
  assert.equal(Tactics.attackPattern({ ai: duelist, attackCount: 2 }, 160), "rush");
});

test("introductory enemies leave a single attack opening and avoid converging on one point", () => {
  const engine = new Engine();
  const player = engine.addPlayer("pilot");
  engine.enemies = [];
  player.x = 10000;
  player.y = 10000;
  const enemies = [0, 1, 2].map((i) =>
    engine.spawn("earth", "Patrulha", "soldier", player.x - 180, player.y + i * 55, false, {
      cooldown: 0,
      level: 1,
    }),
  );
  for (let frame = 0; frame < 24; frame++) {
    engine.tick();
    const commitments = enemies.filter((e) => ["windup", "attack"].includes(e.state));
    assert.ok(commitments.length <= 1, "patrulhas iniciais não devem atacar em bloco");
  }
  assert.ok(enemies.some((e) => e.attackCount > 0));
  assert.ok(new Set(enemies.map((e) => Math.round(e.y))).size > 1);
});

test("a telegraph uses the same range and pattern as the authoritative hit", () => {
  const engine = new Engine();
  const player = engine.addPlayer("pilot");
  engine.enemies = [];
  player.x = 10000;
  player.y = 10000;
  const enemy = engine.spawn("earth", "Atirador", "frieza", player.x - 400, player.y, false, {
    cooldown: 0,
    level: 8,
  });
  engine.tick();
  assert.equal(enemy.state, "windup");
  assert.equal(enemy.pattern, "beam");
  assert.equal(enemy.telegraphRadius, enemy.ai.rangedRange);
  assert.ok(enemy.attackAt > engine.time);
});