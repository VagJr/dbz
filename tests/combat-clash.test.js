"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  { Engine } = require("../src/engine");
function arena() {
  const g = new Engine();
  g.enemies = [];
  g.nextExploration = g.eventAt = 1e9;
  const a = g.addPlayer("a"),
    b = g.addPlayer("b");
  for (const p of [a, b])
    Object.assign(p, {
      world: "space",
      mode: "flight",
      x: 80000,
      y: 80000,
      hp: 1000,
      maxHp: 1000,
      ki: 100,
      pvp: true,
      invuln: 0,
    });
  b.x += 100;
  a.angle = 0;
  b.angle = Math.PI;
  a.input.angle = 0;
  b.input.angle = Math.PI;
  return { g, a, b };
}
function step(g, n = 1) {
  for (let i = 0; i < n; i++) g.tick();
}
function beam(g, p, x, angle) {
  const s = {
    id: "s" + ++g.serial,
    owner: p.id,
    world: p.world,
    mode: p.mode,
    x,
    y: p.y,
    originX: x,
    originY: p.y,
    angle,
    initialAngle: angle,
    speed: 1080,
    r: 18,
    life: 1,
    damage: 68,
    charged: true,
    steerUntil: g.time + 0.65,
    pierce: true,
    hits: [],
  };
  g.shots.push(s);
  return s;
}
test("charged heavy breaks a full ordinary guard but a timed perfect guard still counters it", () => {
  for (const perfect of [false, true]) {
    const { g, a, b } = arena();
    g.time = 1;
    b.state = "guard";
    b.guardAt = perfect ? 1 : -99;
    a.heavyStrike = true;
    a.attackData = { posture: 80, stun: 0.36 };
    g.damage(a, b, 44, true);
    assert.equal(b.ki, perfect ? 92 : 0);
    assert.equal(b.hp === 1000, perfect);
    if (perfect) assert.ok(a.stun > g.time);
    else assert.ok(b.stun >= g.time + 0.7);
  }
});
test("charged heavy breaks full NPC posture", () => {
  const { g, a } = arena();
  const e = g.spawn("space", "guard", "vegeta", a.x + 70, a.y, false, {
    hp: 1000,
    maxHp: 1000,
    guardMeter: 70,
    state: "guard",
    angle: Math.PI,
    guardUntil: 5,
  });
  a.heavyStrike = true;
  a.attackData = { posture: 80, stun: 0.36 };
  g.damage(a, e, 44, true);
  assert.ok(e.guardMeter <= 0);
  assert.ok(e.guardBrokenUntil > g.time);
});
test("beams steer with a turn-speed limit, a total cone limit, and a fixed control deadline", () => {
  const { g, a } = arena();
  g.enemies = [];
  g.players.delete("b");
  const s = beam(g, a, a.x, 0);
  a.input.angle = Math.PI / 2;
  g.advanceBeams(1 / 30);
  assert.ok(s.angle > 0 && s.angle <= 1.2 / 30 + 1e-8);
  for (let i = 0; i < 18; i++) {
    g.time += 1 / 30;
    g.advanceBeams(1 / 30);
  }
  assert.ok(s.angle <= 0.65 + 1e-8);
  const end = s.angle;
  g.time = 0.7;
  a.input.angle = -Math.PI / 2;
  g.advanceBeams(1 / 30);
  assert.equal(s.angle, end);
  assert.ok(s.trail.length <= 18);
});
test("opposing fast charged beams start one contest before either deals damage", () => {
  const { g, a, b } = arena();
  beam(g, a, a.x, 0);
  beam(g, b, b.x, Math.PI);
  g.tick();
  assert.equal(g.clashes.size, 1);
  assert.equal(g.shots.length, 0);
  assert.equal(a.clashId, b.clashId);
  assert.equal(a.hp, 1000);
  assert.equal(b.hp, 1000);
  assert.equal(g.act(a.id, "dash"), false);
  assert.equal(g.snapshot(a.id).self.clash.type, "beam");
});
test("beam contests require mutual PvP and cannot pull spectators in", () => {
  const { g, a, b } = arena();
  b.pvp = false;
  beam(g, a, a.x, 0);
  beam(g, b, b.x, Math.PI);
  g.tick();
  assert.equal(g.clashes?.size || 0, 0);
  assert.equal(a.clashId, undefined);
});
test("one input per beat defeats click flooding and precise timing earns more", () => {
  const { g, a, b } = arena();
  g.startClash(a, b, "fists", { world: a.world, x: a.x + 50, y: a.y });
  const c = g.clashes.get(a.clashId);
  for (let i = 0; i < 100; i++) g.act(a.id, "attackStart");
  assert.equal(c.scores[0], 0.4);
  assert.equal(a.ki, 99);
  g.time = c.start + c.period / 2;
  g.act(b.id, "attackStart");
  assert.equal(c.scores[1], 1);
  g.time = c.start + c.period * 1.5;
  g.input(a.id, { x: 0, y: 0, angle: 0, guard: true });
  assert.ok(c.scores[0] > 1.3);
  assert.equal(a.ki, 98);
});
test("three simultaneous light exchanges can engage a fist contest, with a cooldown afterward", () => {
  const { g, a, b } = arena();
  for (let round = 0; round < 3; round++) {
    a.x = 80000;
    b.x = 80100;
    a.y = b.y = 80000;
    a.angle = 0;
    b.angle = Math.PI;
    g.act(a.id, "attack");
    g.act(b.id, "attack");
    step(g, 30);
  }
  assert.ok(a.clashId);
  assert.equal(g.clashes.get(a.clashId).type, "fists");
  const c = g.clashes.get(a.clashId);
  g.time = c.ends;
  g.tick();
  assert.equal(g.clashes.size, 0);
  assert.equal(a.clashId, null);
  assert.equal(g.startClash(a, b, "fists", a), false);
});
test("draws throw both fighters away and disconnect cancels without a stuck state", () => {
  const { g, a, b } = arena();
  g.startClash(a, b, "fists", { world: a.world, x: a.x + 50, y: a.y });
  g.time = g.clashes.get(a.clashId).ends;
  g.tick();
  assert.equal(a.clashId, null);
  assert.equal(b.clashId, null);
  assert.ok(a.launch.x < 0 && b.launch.x > 0);
  const x = a.x,
    y = b.x;
  step(g, 2);
  assert.ok(a.x < x && b.x > y);
  a.clashCooldown = b.clashCooldown = 0;
  g.startClash(a, b, "fists", a);
  g.players.delete(b.id);
  g.tick();
  assert.equal(a.clashId, null);
  assert.equal(g.clashes.size, 0);
});
test("a beam contest winner releases a travelling beam rather than unavoidable damage", () => {
  const { g, a, b } = arena();
  a.x -= 300;
  b.x += 300;
  const sa = beam(g, a, a.x, 0),
    sb = beam(g, b, b.x, Math.PI);
  g.shots = [];
  g.startClash(a, b, "beam", { world: a.world, x: 80050, y: a.y }, [sa, sb]);
  const c = g.clashes.get(a.clashId);
  c.scores = [4, 1];
  g.time = c.ends;
  g.endClash(c);
  assert.equal(b.hp, 1000);
  assert.equal(g.shots.length, 1);
  assert.equal(g.shots[0].owner, a.id);
  assert.equal(g.shots[0].charged, false);
});
test("frontal dashes explode and recoil, while spectators remain unaffected", () => {
  const { g, a, b } = arena();
  g.input(a.id, { x: 1, y: 0, angle: 0 });
  g.input(b.id, { x: -1, y: 0, angle: Math.PI });
  g.act(a.id, "dash");
  g.act(b.id, "dash");
  g.tick();
  assert.ok(g.effects.some((e) => e.type === "collisionBurst"));
  assert.ok(a.launch.x < 0 && b.launch.x > 0);
  assert.equal(a.hp, 1000);
  assert.equal(b.hp, 1000);
});
test("awakening repels nearby opponents once but never neutral players", () => {
  const { g, a, b } = arena(),
    spectator = g.addPlayer("spectator");
  Object.assign(spectator, {
    world: a.world,
    x: a.x + 40,
    y: a.y,
    mode: "flight",
    pvp: false,
  });
  a.focus = 100;
  assert.equal(g.act(a.id, "form"), true);
  assert.ok(b.launch.x > 0);
  assert.equal(spectator.launch, undefined);
  const old = b.launch;
  assert.equal(g.act(a.id, "form"), false);
  assert.equal(b.launch, old);
});
test("NPCs participate in contests without reading opponent scores or inputs", () => {
  const { g, a } = arena();
  const e = g.spawn("space", "elite", "vegeta", a.x + 80, a.y, false, {
    rank: "elite",
    effort: 100,
  });
  g.startClash(a, e, "fists", a);
  step(g, 30);
  const c = g.clashes.get(a.clashId);
  assert.ok(c.scores[1] > 0);
  assert.equal(c.scores[0], 0);
  assert.ok(e.effort < 100);
});

test("charged beam breaks a held guard through its real projectile collision", () => {
  const { g, a, b } = arena();
  g.time = 1;
  b.guardAt = -99;
  b.nextPerfectGuard = 99;
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: true });
  beam(g, a, b.x - 30, 0);
  g.tick();
  assert.equal(b.ki, 0);
  assert.ok(b.stun >= g.time + 0.7);
});
test("ending a duel releases an ongoing contest immediately and restores its profiles", () => {
  const { g, a, b } = arena();
  a.mode = b.mode = "ground";
  const m = g.duelBegin(a, b);
  g.time = m.start + 0.1;
  a.roundLocked = b.roundLocked = false;
  g.startClash(a, b, "fists", { world: a.world, x: a.x, y: a.y });
  assert.ok(a.clashId);
  g.duelEnd(m, a.id, "Teste");
  assert.equal(g.clashes.size, 0);
  assert.equal(a.clashId, null);
  assert.equal(b.clashId, null);
  assert.equal(a.maxHp, 1000);
});
