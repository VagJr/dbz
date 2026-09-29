"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { Engine } = require("../src/engine"),
  C = require("../shared/combat"),
  Q = require("../shared/quests");
function arena() {
  const g = new Engine();
  g.enemies = [];
  g.eventAt = 1e9;
  g.nextExploration = 1e9;
  const a = g.addPlayer("a"),
    b = g.addPlayer("b");
  for (const p of [a, b])
    Object.assign(p, {
      world: "space",
      x: 80000,
      y: 80000,
      mode: "flight",
      invuln: 0,
      pvp: true,
      hp: 600,
      maxHp: 600,
      angle: 0,
    });
  b.x += 100;
  b.angle = Math.PI;
  a.targetId = b.id;
  b.targetId = a.id;
  return { g, a, b };
}
function step(g, n = 1) {
  for (let i = 0; i < n; i++) {
    for (const p of g.players.values())
      g.input(p.id, { ...p.input, x: 0, y: 0, angle: p.angle });
    g.tick();
  }
}
function duel() {
  const s = arena();
  s.a.mode = s.b.mode = "ground";
  s.g.time = 10;
  const m = s.g.duelBegin(s.a, s.b);
  step(s.g, 92);
  s.a.x = 80000;
  s.b.x = 80100;
  s.a.angle = 0;
  s.b.angle = Math.PI;
  for(const p of [s.a,s.b])s.g.input(p.id,{x:0,y:0,angle:p.angle});
  return { ...s, m };
}
test("release starts a fast strike and a burst of clicks retains only one continuation",()=>{
 const {g,a,b}=arena();g.act(a.id,'attackStart');step(g,2);assert.equal(b.hp,600);
 g.act(a.id,'attackRelease');assert.equal(b.hp,600);
 for(let i=0;i<100;i++)g.act(a.id,'attack');assert.ok(a.rhythmQueue);
 step(g,8);assert.ok(b.hp<600);const hp=b.hp;step(g,20);assert.equal(b.hp,hp);assert.equal(a.moveAction,null);
});

test("whiff cannot teleport to a rival or confirm a combo", () => {
  const { g, a, b } = arena();
  b.x = a.x + 400;
  g.act(a.id, "attack");
  step(g, 23);
  assert.equal(b.hp, 600);
  assert.ok(a.x < 80030);
  assert.equal(a.comboConfirmed, 0);
  assert.equal(g.nextCombo(a), "jab");
});
test("mobile melee assist faces a nearby NPC and adds only a short step", () => {
  const { g, a } = arena();
  const npc = g.spawn("space", "Treino", "vegeta", a.x - 145, a.y, false, {
    hp: 1000, maxHp: 1000, mode: "flight", cooldown: Infinity, nextOpening: Infinity,
  });
  a.targetId = npc.id;
  g.input(a.id, { x: 0, y: 0, angle: 0, mobileAssist: true });
  const start = a.x;
  assert.equal(g.act(a.id, "attack"), true);
  step(g, 4);
  assert.ok(npc.hp < 1000);
  assert.ok(a.x < start && a.x > start - 65);
});
test("mobile melee assist leaves a distant NPC out of reach", () => {
  const { g, a } = arena();
  const npc = g.spawn("space", "Distante", "vegeta", a.x - 400, a.y, false, {
    hp: 1000, maxHp: 1000, mode: "flight", cooldown: Infinity, nextOpening: Infinity,
  });
  a.targetId = npc.id;
  g.input(a.id, { x: 0, y: 0, angle: 0, mobileAssist: true });
  g.act(a.id, "attack");
  step(g, 4);
  assert.equal(npc.hp, 1000);
  assert.ok(a.x < 80030);
});
test("a confirmed fast strike buffers only one followup and cancels recovery after impact", () => {
  const { g, a, b } = arena();
  g.act(a.id, "attack");
  step(g, 1);
  assert.ok(a.moveAction.end - g.time <= C.buffer);
  g.act(a.id, "attack");
  const q = a.rhythmQueue;
  assert.ok(q);
  g.act(a.id, "blastStart");
  assert.equal(a.rhythmQueue, q);
  step(g, 2);
  assert.equal(a.moveAction.key, "link");
  assert.equal(a.rhythmQueue, null);
  assert.ok(b.hp < 600);
});
test("committed attacks cannot be cancelled by dash or guard", () => {
  const { g, a } = arena();
  g.act(a.id, "attack");
  const energy = a.ki;
  assert.equal(g.act(a.id, "dash"), false);
  assert.equal(a.ki, energy);
  g.input(a.id, { x: 0, y: 0, angle: 0, guard: true });
  step(g, 2);
  assert.notEqual(a.state, "guard");
  assert.ok(a.moveAction);
});
test("a held guard does not renew perfect defense after block stun", () => {
  const { g, a, b } = arena();
  g.time = 1;
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: true });
  step(g);
  g.damage(a, b, 18);
  assert.equal(b.hp, 600);
  a.stun = 0;
  step(g, 25);
  const old = b.guardAt;
  g.damage(a, b, 18);
  assert.ok(b.hp < 600);
  const hp = b.hp;
  step(g, 7);
  g.damage(a, b, 18);
  assert.ok(b.hp < hp);
  assert.equal(b.guardAt, old);
});
test("guard tapping has a retry interval and consumes ki on a perfect block", () => {
  const { g, a, b } = arena();
  g.time = 1;
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: true });
  step(g);
  const ki = b.ki;
  g.damage(a, b, 18);
  assert.equal(Math.round(ki - b.ki), 8);
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: false });
  step(g);
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: true });
  step(g);
  assert.equal(b.guardAt, -99);
  g.damage(a, b, 18);
  assert.ok(b.hp < 600);
});
test("defensive burst costs 45 ki and cannot be repeated before cooldown", () => {
  const { g, a } = arena();
  a.stun = 1;
  a.ki = 100;
  assert.equal(g.act(a.id, "dash"), true);
  assert.equal(a.ki, 55);
  assert.equal(a.stun, 0);
  a.stun = 1;
  assert.equal(g.act(a.id, "dash"), false);
  assert.equal(a.ki, 55);
});
test("four consecutive hits scale damage and grant a short escape window", () => {
  const { g, a, b } = arena();
  const damage = [];
  for (let i = 0; i < 4; i++) {
    g.time += 0.3;
    a.attackData = { stun: 0.22, posture: 12 };
    const hp = b.hp;
    g.damage(a, b, 18);
    damage.push(hp - b.hp);
  }
  assert.ok(damage[0] > damage[1] && damage[1] > damage[2]);
  assert.ok(b.invuln > g.time);
  assert.ok(b.stun <= g.time + 0.12);
});
test("simultaneous committed melee hits trade instead of favoring player insertion order", () => {
  const { g, a, b } = arena();
  g.act(a.id, "attack");
  g.act(b.id, "attack");
  step(g, 7);
  assert.equal(a.hp, b.hp);
  assert.ok(a.hp < 600);
});
test("duel countdown prevents attacks, movement and world consumables", () => {
  const { g, a, b } = arena();
  a.mode = b.mode = "ground";
  const m = g.duelBegin(a, b),
    x = a.x;
  assert.equal(g.act(a.id, "attack"), false);
  g.input(a.id, { x: 1, y: 0, angle: 0 });
  g.tick();
  assert.equal(a.x, x);
  assert.equal(
    g.sandboxCommand(a.id, { action: "use", item: "senzu" }).ok,
    false,
  );
  assert.equal(g.act(a.id, "form"), false);
  assert.ok(m);
});
test("duel normalizes damage across levels, attributes and transformation", () => {
  const { g, a, b } = duel();
  a.level = 100;
  a.stats.force = 999;
  a.form = false;
  b.level = 1;
  b.stats.force = 0;
  g.act(a.id, "attack");
  g.act(b.id, "attack");
  step(g, 7);
  assert.equal(a.hp, b.hp);
  assert.equal(600 - a.hp, 18);
});
test("equal lethal hits draw a round and reset both players without granting an insertion advantage", () => {
  const { g, a, b, m } = duel();
  a.hp = b.hp = 18;
  g.act(a.id, "attack");
  g.act(b.id, "attack");
  step(g, 7);
  assert.equal(m.round, 2);
  assert.deepEqual(m.score, [0, 0]);
  assert.equal(a.hp, 600);
  assert.equal(b.hp, 600);
  assert.ok(a.roundLocked && b.roundLocked);
});
test("best of three restores original profile and does not persist temporary duel life", () => {
  const { g, a, b } = arena();
  a.mode = b.mode = "ground";
  a.maxHp = 173;
  a.hp = 121;
  a.ki = 53;
  a.form = true;
  g.time = 10;
  const before = g.profile(a),
    m = g.duelBegin(a, b);
  assert.equal(g.profile(a).maxHp, before.maxHp);
  assert.equal(g.profile(a).hp, before.hp);
  for (let i = 0; i < 2; i++) {
    step(g, 92);
    g.damage(a, b, 999);
    step(g);
  }
  assert.equal(a.duelId, null);
  assert.equal(a.maxHp, 173);
  assert.equal(a.hp, 121);
  assert.equal(a.ki, 53);
  assert.equal(a.form, true);
  assert.deepEqual(a.duelResult.score, [2, 0]);
  assert.equal(a.duelResult.winner, a.id);
  assert.equal(g.duels.size, 0);
  assert.ok(g.duelRecords[0].events.length >= 4);
});
test("duel cannot damage spectators or absorb their projectiles", () => {
  const { g, a, b } = duel();
  const p = g.addPlayer("spectator");
  Object.assign(p, {
    world: "space",
    mode: "flight",
    x: a.x + 40,
    y: a.y,
    pvp: true,
    invuln: 0,
  });
  const hp = p.hp;
  g.damage(a, p, 99);
  g.damage(p, a, 99);
  assert.equal(p.hp, hp);
  assert.equal(a.hp, 600);
  g.act(a.id, "blast");
  step(g, 17);
  assert.ok(b.hp < 600);
  assert.equal(p.hp, hp);
});
test("three timed draws end the duel, and disconnect also restores the survivor", () => {
  const { g, a, b, m } = duel();
  for (let i = 0; i < 3; i++) {
    g.time = m.ends;
    step(g);
  }
  assert.equal(a.duelId, null);
  assert.equal(a.duelResult.winner, null);
  const next = g.duelBegin(a, b);
  g.players.delete(b.id);
  step(g);
  assert.equal(a.duelId, null);
  assert.equal(a.duelResult.winner, a.id);
  assert.equal(a.duelResult.reason, "Desconexão");
  assert.ok(!g.duels.has(next.id));
});
test("the opening stays calm and all story guidance points to the active persistent objective", () => {
  const g = new Engine(),
    p = g.addPlayer("new");
  step(g, 1350);
  assert.equal(
    g.enemies.filter((e) => !e.dead && e.world === "earth").length,
    0,
  );
  let s = g.snapshot(p.id).self;
  assert.equal(s.chapter, null);
  assert.equal(s.loreObjective, null);
  assert.equal(s.guide.objectiveId, "meet-bulma");
  p.x = Q.LANDMARKS.bulma.x;
  p.y = Q.LANDMARKS.bulma.y;
  const text = g.interact(p.id);
  assert.equal(typeof text, "string");
  s = g.snapshot(p.id).self;
  assert.equal(s.guide.objectiveId, "pilaf-intel");
  assert.equal(s.guide.targetX, Q.LANDMARKS.pilafNote1.x);
  assert.equal(s.storyJournal.filter((q) => q.status === "active").length, 1);
  assert.deepEqual(s.guide, s.storyObjective);
});
test("introductory patrol respawns for a late player after the previous player completed it", () => {
  const g = new Engine();
  g.enemies = [];
  g.nextExploration = 1e9;
  const p = g.addPlayer("first");
  p.x = Q.LANDMARKS.pilafTrail.x;
  p.y = Q.LANDMARKS.pilafTrail.y;
  p.storyState.objectiveIndex = 3;
  const kill = (player) => {
    player.lastStoryCheck = -1;
    g.storyTick(player);
    const e = g.enemies.find((e) => !e.dead && e.storyQuestId === "db-paozu");
    assert.ok(e);
    g.damage(player, e, 9999);
    g.time += 2.1;
  };
  for (let i = 0; i < 3; i++) kill(p);
  assert.equal(p.storyState.questId, "db-pilaf");
  const q = g.addPlayer("late");
  q.x = Q.LANDMARKS.pilafTrail.x;
  q.y = Q.LANDMARKS.pilafTrail.y;
  q.storyState.objectiveIndex = 3;
  for (let i = 0; i < 3; i++) kill(q);
  assert.equal(q.storyState.questId, "db-pilaf");
});

test("enemy punishes observed recovery only after its reaction delay", () => {
  const Brain = require("../src/combat-brain"),
    { g, a } = arena(),
    e = g.spawn("space", "Rival", "vegeta", a.x + 100, a.y, false, {
      hp: 1000,
      maxHp: 1000,
      mode: "flight",
      ai: { archetype: "duelist" },
      rank: "regular",
      effort: 100,
    });
  a.state = "idle";
  Brain.observe(e, a, 1, true);
  Brain.observe(e, a, 1.5, true);
  Brain.decide(e, a, 1.5, true, true);
  const baseline = e.brain.scores.strike;
  a.state = "recover";
  Brain.observe(e, a, 1.61, true);
  Brain.decide(e, a, 1.81, true, true);
  assert.equal(e.brain.seen.recovering, false);
  Brain.observe(e, a, 2.1, true);
  Brain.decide(e, a, 2.1, true, true);
  assert.equal(e.brain.seen.recovering, true);
  assert.ok(e.brain.scores.strike > baseline);
});
test("PvP perfect guard can return a projectile without unavoidable instant damage", () => {
  const { g, a, b } = duel();
  g.act(a.id, "blast");
  step(g, 2);
  assert.ok(g.shots.length);
  g.input(b.id, { x: 0, y: 0, angle: Math.PI, guard: true });
  step(g, 5);
  assert.equal(b.hp, 600);
  assert.ok(g.effects.some((e) => e.text === "DEVOLUÇÃO DE KI"));
  assert.ok(a.hp < 600 || g.shots.some((s) => s.owner === b.id));
});
