"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { Engine } = require("../src/engine"),
  T = require("../src/enemy-tactics"),
  Brain = require("../src/combat-brain");
function arena(rank = "regular", role = "brawler") {
  const g = new Engine();
  g.enemies = [];
  g.nextExploration = g.eventAt = 1e9;
  const p = g.addPlayer("p");
  Object.assign(p, {
    world: "space",
    mode: "flight",
    x: 80000,
    y: 80000,
    hp: 1000,
    maxHp: 1000,
    invuln: 0,
    angle: 0,
  });
  const e = g.spawn("space", "Rival", "vegeta", p.x + 95, p.y, false, {
    ai: { ...T.ROLES[role], aggroRange: 1100 },
    mode: "flight",
    hp: 1000,
    maxHp: 1000,
    damage: 20,
    rank,
    cooldown: 0,
  });
  p.targetId = e.id;
  return { g, p, e };
}
function step(g, n = 1) {
  for (let i = 0; i < n; i++) g.tick();
}
test("an earlier player impact interrupts an enemy startup without a delayed ghost strike", () => {
  const { g, p, e } = arena();
  g.tick();
  assert.equal(e.state, "windup");
  g.act(p.id, "attack");
  step(g, 4);
  assert.ok(e.hp < 1000);
  assert.equal(p.hp, 1000);
  assert.equal(e.attackAt, Infinity);
  const count = e.attackCount;
  step(g, 3);
  assert.ok(e.attackCount<=count+1);
  if(e.attackCount>count)assert.ok(e.attackAt>g.time);
  assert.equal(p.hp, 1000);
});
test("an earlier NPC impact interrupts the player instead of rewarding click volume", () => {
  const { g, p, e } = arena("elite");
  g.tick();
  g.time = e.attackAt - 0.01;
  g.act(p.id, "attack");
  step(g, 2);
  assert.ok(p.hp < 1000);
  assert.equal(e.hp, 1000);
  assert.equal(p.moveAction, null);
});
test("same-tick unequal impacts preserve their scheduled order for players and NPCs", () => {
  for (const npcFirst of [true, false]) {
    const { g, p, e } = arena();
    g.tick();
    g.act(p.id, "attack");
    e.attackAt = p.moveAction.impact + (npcFirst ? -0.01 : 0.01);
    g.time = p.moveAction.impact - 0.02;
    g.tick();
    assert.equal(p.hp < 1000, npcFirst);
    assert.equal(e.hp < 1000, !npcFirst);
  }
});
test("exact simultaneous player and NPC impacts trade", () => {
  const { g, p, e } = arena();
  g.tick();
  g.act(p.id, "attack");
  e.attackAt = p.moveAction.impact;
  g.time = e.attackAt - 0.02;
  g.tick();
  assert.ok(p.hp < 1000);
  assert.ok(e.hp < 1000);
});
test("enemy confirmation continues a short combo but a whiff clears it and opens recovery", () => {
  const { g, p, e } = arena("elite");
  g.tick();
  g.time = e.attackAt;
  g.tick();
  assert.equal(e.confirmedHits, 1);
  const first = e.attackCount;
  for (let i = 0; i < 30 && e.attackCount === first; i++) g.tick();
  assert.equal(e.motorMove.stage, 2);
  assert.equal(e.state, "windup");
  p.y += 500;
  g.time = e.attackAt;
  g.tick();
  assert.equal(e.confirmedHits, 0);
  const count = e.attackCount;
  step(g, 3);
  assert.equal(e.attackCount, count);
  assert.equal(e.state, "recover");
});
test("difficulty speeds up observable reactions and committed attacks, retaining a finite reaction floor", () => {
  const timings = [];
  for (const rank of ["regular", "veteran", "elite"]) {
    const { g, e } = arena(rank);
    g.tick();
    timings.push([Brain.reaction(e), e.attackAt - e.windupAt]);
  }
  assert.ok(timings[0][0] > timings[1][0] && timings[1][0] > timings[2][0]);
  assert.ok(timings[0][1] > timings[1][1] && timings[1][1] > timings[2][1]);
  assert.ok(timings[2][0] >= 4 / 30);
});
test("enemies keep observing during hitstun and defend against repeated pressure", () => {
  const { g, p, e } = arena("elite", "duelist");
  e.stun = 0.35;
  g.act(p.id, "blastStart");
  step(g, 10);
  assert.ok(e.brain.seen?.threat);
  assert.equal(e.attackCount, undefined);
  e.recentPressure = 3;
  e.pressureHitAt = 0;
  p.state = "idle";
  step(g, 2);
  assert.ok(["guard", "evade"].includes(e.state), e.state);
});
test("rapid press-release pairs retain at most one followup, and releasing it never adds a third", () => {
  const { g, p, e } = arena();
  e.stun = 999;
  g.act(p.id, "attackStart");
  g.act(p.id, "attackRelease");
  step(g, 1);
  g.act(p.id, "attackStart");
  step(g, 2);
  assert.equal(p.moveAction.key, "link");
  g.act(p.id, "attackRelease");
  assert.equal(p.rhythmQueue, null);
  step(g, 20);
  assert.equal(p.moveAction, null);
  assert.equal(p.comboConfirmed, 2);
});
