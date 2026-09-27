"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { Engine } = require("../src/engine"),
  Brain = require("../src/combat-brain"),
  T = require("../src/enemy-tactics");
function arena(role = "duelist", distance = 110) {
  const g = new Engine(),
    p = g.addPlayer("p");
  g.enemies = [];
  g.nextExploration = 1e9;
  g.eventAt = 1e9;
  p.x = 80000;
  p.y = 80000;
  p.world = "space";
  p.mode = "flight";
  p.invuln = 0;
  const e = g.spawn("space", "Rival", "vegeta", p.x + distance, p.y, false, {
    ai: { ...T.ROLES[role], aggroRange: 1100 },
    mode: "flight",
    hp: 1000,
    maxHp: 1000,
    damage: 20,
    cooldown: 0,
    rank: "regular",
  });
  return { g, p, e };
}
function step(g, n) {
  for (let i = 0; i < n; i++) g.tick();
}
test("perception retains visible attack history but never reacts before rank reaction time", () => {
  const { e, p } = arena();
  p.state = "attack";
  Brain.observe(e, p, 1, true);
  assert.equal(e.brain.seen, null);
  Brain.observe(e, p, 1.29, true);
  assert.equal(e.brain.seen, null);
  Brain.observe(e, p, 1.31, true);
  assert.equal(e.brain.seen.threat, true);
  assert.equal(Brain.decide(e, p, 1.31, false, true), "guard");
  const other = { ...e, brain: null };
  p.state = "idle";
  p.input.attack = true;
  Brain.observe(other, p, 2, true);
  Brain.observe(other, p, 2.5, true);
  assert.equal(other.brain.seen.threat, false);
});
test("energy shortage denies attack and recovering restores the action budget", () => {
  const { e, p } = arena();
  e.effort = 10;
  assert.ok(["breathe", "retreat"].includes(Brain.decide(e, p, 1, true, true)));
  e.state = "recover";
  Brain.maintain(e, 2);
  assert.equal(e.effort, 46);
  assert.equal(Brain.decide(e, p, 4, true, true), "strike");
});
test("identities choose a lateral dodge or a planted guard from the same delayed threat", () => {
  const { e, p } = arena();
  p.state = "chargeAim";
  for (const [role, expected] of [
    ["scout", "evade"],
    ["juggernaut", "guard"],
  ]) {
    const rival = { ...e, ai: T.ROLES[role], brain: null };
    Brain.observe(rival, p, 1, true);
    Brain.observe(rival, p, 1.5, true);
    assert.equal(Brain.decide(rival, p, 1.5, false, true), expected);
  }
});
test("a real block earns one telegraphed counter with room to move away", () => {
  const { g, p, e } = arena();
  e.state = "guard";
  e.angle = Math.PI;
  e.guardUntil = g.time + 0.5;
  e.guardMeter = 70;
  e.cooldown = g.time + 2;
  e.nextOpening = g.time + 2;
  g.damage(p, e, 20);
  assert.equal(e.hp, 996);
  assert.ok(e.counterReadyUntil > g.time);
  step(g, 5);
  assert.equal(e.state, "windup");
  assert.equal(e.counterStrike, true);
  assert.ok(e.attackAt - e.windupAt >= 4 / 30 && e.attackAt > g.time);
  assert.equal(e.counterReadyUntil, 0);
  const hp = p.hp;
  p.y += 500;
  g.time = e.attackAt;
  g.tick();
  assert.equal(p.hp, hp);
});
test("enemy ki has travel time, is dodgeable, and a precise guard returns it", () => {
  const { g, p, e } = arena("artillery", 400);
  g.tick();
  assert.equal(e.state, "windup");
  g.time = e.attackAt;
  g.tick();
  assert.equal(g.shots.length, 1);
  assert.equal(p.hp, p.maxHp);
  const s = g.shots[0];
  assert.equal(s.hostile, true);
  s.x = p.x + 40;
  s.y = p.y;
  s.angle = Math.PI;
  g.input(p.id, { x: 0, y: 0, angle: 0, guard: true });
  g.tick();
  assert.equal(p.hp, p.maxHp);
  assert.equal(s.owner, p.id);
  assert.equal(s.hostile, false);
  assert.equal(s.technique, "divine");
  assert.equal(e.stun, 0);
});
test("a missed enemy projectile cannot hit players outside its actual trajectory", () => {
  const { g, p, e } = arena("artillery", 400);
  g.tick();
  g.time = e.attackAt;
  g.tick();
  p.y += 200;
  step(g, 25);
  assert.equal(p.hp, p.maxHp);
});
test("active projectile pressure reserves introductory group attack capacity", () => {
  const { g, p, e } = arena("artillery");
  e.state = "recover";
  e.combatTargetId = p.id;
  e.pressureUntil = 3;
  const other = { ...e, id: "other", level: 1, nextOpening: 0 };
  assert.equal(T.canCommit(other, [e, other], p, 2), false);
  assert.equal(T.canCommit(other, [e, other], p, 4), true);
});
test("quick ki after two punches consumes extra ki and damages frontal posture", () => {
  const { g, p, e } = arena();
  p.combo = 2;
  p.comboConfirmed = 2;
  p.confirmedAt = g.time;
  p.comboAt = g.time;
  p.ki = 100;
  g.act(p.id, "blastStart");
  g.act(p.id, "blast");
  step(g, 4);
  const shot = g.shots[0];
  assert.equal(shot.weave, true);
  assert.equal(p.comboConfirmed, 0);
  assert.equal(p.ki, 84);
  e.state = "guard";
  e.guardMeter = 70;
  e.angle = Math.PI;
  g.damage({ ...p, kiWeave: true }, e, shot.damage);
  assert.equal(e.guardMeter, 25);
});
test("snapshots exclude private AI observations and keep effort visible", () => {
  const { g, p, e } = arena();
  g.tick();
  const s = g.snapshot(p.id);
  const foe = s.enemies.find((f) => f.id === e.id);
  assert.ok(foe.effort <= 100);
  assert.equal(foe.brain, undefined);
});
test("dojo enforces proximity, private opponent, no economic reward, and stops before KO", () => {
  const g = new Engine(),
    p = g.addPlayer("p"),
    other = g.addPlayer("other");
  g.nextExploration = 1e9;
  g.enemies = [];
  p.mode = "ground";
  p.x = 20000;
  assert.equal(
    g.betaCommand(p.id, { action: "sparring", role: "duelist" }).ok,
    false,
  );
  Object.assign(p, g.maps[p.world].mentor);
  const result = g.betaCommand(p.id, { action: "sparring", role: "duelist" });
  assert.equal(result.ok, true, result.message);
  const foe = g.enemies.find((e) => e.practiceOwner === p.id),
    xp = p.xp,
    money = p.zenni,
    kills = p.kills;
  g.damage(other, foe, 9000);
  assert.equal(foe.hp, 500);
  g.damage(p, foe, 9000);
  assert.equal(p.xp, xp);
  assert.equal(p.zenni, money);
  assert.equal(p.kills, kills);
  g.tick();
  assert.equal(p.sparring, null);
  g.time += 6;
  assert.equal(
    g.betaCommand(p.id, { action: "sparring", role: "artillery" }).ok,
    true,
  );
  const second = g.enemies.find((e) => e.practiceOwner === p.id);
  p.invuln = 0;
  g.damage(second, p, 9999);
  assert.equal(p.hp, 1);
  g.tick();
  assert.equal(p.sparring, null);
  assert.notEqual(p.state, "dead");
});
