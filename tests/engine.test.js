const test = require("node:test");
const assert = require("node:assert/strict");
const { Engine, distance } = require("../src/engine");
const { CAMPAIGNS, worldData } = require("../shared/content");
function setup() {
  const game = new Engine();
  game.enemies = [];
  const p = game.addPlayer("p", { name: "Goku", origin: "saiyan" });
  return { game, p };
}
function advance(game, seconds, input) {
  for (let i = 0; i < Math.round(seconds * 30); i++) {
    if (input) game.input("p", input);
    game.tick();
  }
}
test("movement is normalized, clock-based, and insensitive to packet spam", () => {
  const { game, p } = setup();
  const start = { ...p };
  for (let n = 0; n < 500; n++) game.input("p", { x: 9, y: 9, angle: 0 });
  assert.equal(p.x, start.x);
  game.tick();
  const diagonalDistance = distance(p, start);
  const cardinal = setup();
  cardinal.game.input("p", { x: 1, y: 0, angle: 0 });
  cardinal.game.tick();
  assert.ok(Math.abs(diagonalDistance - distance(cardinal.p, start)) < 0.001);
  assert.ok(diagonalDistance > 0 && diagonalDistance < 920 / 30);
  advance(game, 1);
  const after = { ...p };
  advance(game, 1);
  assert.ok(Math.abs(p.x - after.x) < 0.1);
});
test("malformed inputs never poison the authoritative state", () => {
  const { game, p } = setup();
  for (const bad of [
    null,
    {},
    "hello",
    { x: Infinity, y: 0, angle: 0 },
    { x: 0, y: NaN, angle: 0 },
  ])
    game.input("p", bad);
  game.tick();
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
test("three-hit combo requires impacts and recovery, with real ki costs", () => {
  const { game, p } = setup();
  p.mode = "flight";
  const e = game.spawn("earth", "Alvo", "soldier", p.x + 75, p.y, false, {
    hp: 1000,
    maxHp: 1000,
    stun: 999,
  });
  for (const seconds of [.14,.14,.17]) {
    e.x = p.x + 75;
    e.y = p.y;
    assert.equal(game.act("p", "attack"), true);
    const hp = e.hp;
    assert.equal(e.hp, hp);
    advance(game, seconds);
  }
  assert.equal(p.combo, 3);
  assert.ok(e.hp < 950 && e.hp > 900);
  assert.ok(p.ki < 87);
});

test("perfect guard prevents damage and enables a timed counter", () => {
  const { game, p } = setup(),
    e = game.spawn("earth", "Rival", "vegeta", p.x + 60, p.y);
  game.input("p", { x: 0, y: 0, angle: 0, guard: true });
  game.tick();
  game.damage(e, p, 50);
  assert.equal(p.hp, p.maxHp);
  assert.ok(p.counterUntil > game.time);
  assert.ok(e.stun > game.time);
  assert.equal(p.focus, 20);
});
test("guard facing matters; delayed guard reduces damage and costs ki", () => {
  const { game, p } = setup(),
    e = game.spawn("earth", "Rival", "vegeta", p.x + 60, p.y);
  game.input("p", { x: 0, y: 0, angle: 0, guard: true });
  advance(game, 0.3, { x: 0, y: 0, angle: 0, guard: true });
  game.damage(e, p, 50);
  assert.equal(p.hp, p.maxHp - 10);
  assert.ok(p.ki < 85);
  p.stun = 0;
  p.angle = Math.PI;
  game.damage(e, p, 50);
  assert.equal(p.hp, p.maxHp - 60);
});
test("dash grants a short invulnerability window and cannot be spammed", () => {
  const { game, p } = setup();
  const e = game.spawn("earth", "Rival", "vegeta", 1800, 1740);
  game.act("p", "dash");
  game.damage(e, p, 99);
  assert.equal(p.hp, p.maxHp);
  assert.equal(game.act("p", "dash"), false);
  advance(game, 0.3);
  game.damage(e, p, 99);
  assert.equal(p.hp, p.maxHp - 99);
});
test("charged blast requires hold and startup then collides along its path", () => {
  const { game, p } = setup();
  const e = game.spawn("earth", "Alvo", "soldier", p.x + 80, p.y, false, {
    stun: 999,
  });
  game.act("p", "blastStart");
  advance(game, 0.6, { x: 0, y: 0, angle: 0 });
  game.act("p", "blast");
  assert.equal(game.shots.length, 0);
  assert.ok(p.ki < 70);
  advance(game, 0.47);
  assert.ok(game.shots[0].pierce);
  advance(game, 0.1);
  assert.ok(e.hp < 60);
});

test("PvP damage requires mutual consent", () => {
  const { game, p } = setup(),
    q = game.addPlayer("q", { name: "Vegeta" });
  q.x = p.x + 50;
  q.pvp = true;
  game.act("p", "attack");
  assert.equal(q.hp, q.maxHp);
  p.pvp = true;
  advance(game, 0.3);
  game.act("p", "attack");
  assert.ok(q.hp < q.maxHp);
});
test("campaign has acceptance, three patrol kills, a boss, one completion reward", () => {
  const { game, p } = setup();
  Object.assign(p, game.maps.earth.mentor);
  p.legacyCampaign = true;
  game.interact("p");
  assert.equal(p.questPhase, 1);
  for (let n = 0; n < 3; n++) {
    const e = game.spawn("earth", "Soldado", "soldier", p.x + 20, p.y);
    game.damage(p, e, 999);
  }
  assert.equal(p.questPhase, 2);
  const boss = game.enemies.find((e) => e.chapterId === "db-0");
  assert.ok(boss);
  p.x = boss.x;
  p.y = boss.y;
  game.damage(p, boss, 99999);
  assert.equal(p.progress.db, 1);
  const xp = p.xp;
  game.damage(p, boss, 99999);
  assert.equal(p.xp, xp);
  assert.equal(p.questPhase, 0);
});
test("every campaign chapter resolves to a world and can spawn its unique boss", () => {
  const { game, p } = setup();
  p.legacyCampaign = true;
  for (const c of CAMPAIGNS)
    for (let n = 0; n < c.chapters.length; n++) {
      p.campaign = c.id;
      p.progress[c.id] = n;
      const ch = game.chapter(p),
        boss = game.ensureBoss(p);
      assert.ok(game.maps[ch.world]);
      assert.equal(boss.name, ch.boss);
      assert.equal(boss.chapterId, ch.id);
    }
});
test("technique learning requires mentor proximity, level, and currency", () => {
  const { game, p } = setup();
  p.level = 5;
  p.world = "vegeta";
  p.zenni = 360;
  assert.match(game.learn("p", "galick"), /mestre/);
  Object.assign(p, game.maps.vegeta.mentor);
  game.learn("p", "galick");
  assert.ok(p.techniques.includes("galick"));
  assert.equal(p.zenni, 100);
  assert.equal(p.equipped, "galick");
  game.learn("p", "galick");
  assert.equal(p.zenni, 100);
});
test("training rewards precise actions and ends after eight attempts", () => {
  const { game, p } = setup();
  Object.assign(p, game.maps.earth.mentor);
  game.train("p");
  const initial = BigInt(p.power);
  for (let i = 0; i < 8; i++) {
    game.time = p.training.beat;
    game.act("p", "attack");
  }
  assert.equal(p.training, null);
  assert.ok(BigInt(p.power) > initial);
  assert.ok(p.xp > 0);
});
test("attributes consume earned points and cannot be forged by property names", () => {
  const { game, p } = setup();
  assert.equal(game.attribute("p", "force"), false);
  game.reward(p, 150);
  assert.equal(p.points, 3);
  assert.equal(game.attribute("p", "__proto__"), false);
  assert.equal(game.attribute("p", "vitality"), true);
  assert.equal(p.points, 2);
  assert.equal(p.stats.vitality, 1);
});
test("power uses arbitrary precision; progression survives profile serialization", () => {
  const { game, p } = setup();
  p.power = "90071992547409931234567";
  game.reward(p, 100);
  assert.equal(p.power, "90071992547409931234767");
  p.techniques.push("kame");
  p.equipped = "kame";
  const restored = game.addPlayer(
    "restored",
    JSON.parse(JSON.stringify(game.profile(p))),
  );
  assert.equal(restored.power, p.power);
  assert.equal(restored.equipped, "kame");
  assert.equal(restored.level, p.level);
});
test("procedural travel is deterministic and bounded in resident memory", () => {
  assert.deepEqual(worldData("rift:243"), worldData("rift:243"));
  assert.notDeepEqual(
    worldData("rift:243").objects,
    worldData("rift:244").objects,
  );
  const { game, p } = setup();
  for (let n = 1; n < 60; n++) {
    game.time += 3;
    assert.equal(game.travel("p", "rift:" + n), true);
  }
  assert.ok(Object.keys(game.maps).length <= 32);
  assert.ok(game.enemies.length < 400);
  assert.equal(game.travel("p", "../../secret"), false);
});
test("snapshots never expose another player profile or session information", () => {
  const { game, p } = setup();
  game.addPlayer("q", { name: "Other", power: "88888", zenni: 500 });
  const snap = game.snapshot("p");
  assert.equal(snap.players.find((p) => p.id === "q").zenni, undefined);
  assert.equal(snap.players.find((p) => p.id === "q").power, undefined);
  assert.ok(!JSON.stringify(snap).includes("token"));
});
test("seven distinct spheres grant one wish then reset the collection", () => {
  const { game, p } = setup();
  for (const orb of game.maps.earth.orbs) {
    p.x = orb.x;
    p.y = orb.y;
    game.interact("p");
    game.interact("p");
  }
  assert.equal(p.orbs.length, 7);
  p.x = 1700;
  p.y = 1740;
  game.interact("p");
  assert.equal(p.wishCount, 1);
  assert.equal(p.orbs.length, 0);
  game.interact("p");
  assert.equal(p.wishCount, 1);
});
test("defeat revives at the village, without input movement during defeat", () => {
  const { game, p } = setup();
  game.damage({ x: 1800, y: 1700 }, p, 9999);
  assert.equal(p.state, "dead");
  advance(game, 3.1);
  assert.equal(p.state, "glide");
  assert.equal(p.hp, p.maxHp);
  assert.equal(p.x, 1700);
});
