const test = require("node:test"),
  assert = require("node:assert/strict"),
  { Engine } = require("../src/engine"),
  W = require("../shared/open-world");
function setup() {
  const e = new Engine(),
    p = e.addPlayer("p");
  e.enemies = [];
  e.nextExploration = 1e9;
  return { e, p };
}
function step(e, p, n, input = { x: 0, y: 0, angle: 0 }) {
  for (let i = 0; i < n; i++) {
    e.input(p.id, input);
    e.tick();
  }
}
test("early input buffers one followup and distant targets are not magnetized", () => {
  const { e, p } = setup();
  p.mode = "flight";
  const a = e.spawn("earth", "A", "soldier", p.x + 240, p.y, false, {
    hp: 1000,
    maxHp: 1000,
    stun: 999,
  });
  e.act("p", "target:" + a.id);
  const x = p.x;
  e.act("p", "attack");
  for (let i = 0; i < 50; i++) e.act("p", "attack");
  step(e, p, 20);
  assert.equal(a.hp, 1000);
  assert.ok(p.x - x <= 37);
  assert.equal(p.combo, 1);
  assert.equal(p.moveAction, null);
  a.x = p.x + 70;
  e.act("p", "attack");
  step(e, p, 1);
  for (let i = 0; i < 50; i++) e.act("p", "attack");
  step(e, p, 4);
  assert.equal(p.combo, 2);
  assert.ok(a.hp < 1000);
  e.act("p", "target:missing");
  assert.equal(p.targetId, null);
});

test("ki aiming allows movement but the committed release has recovery", () => {
  const { e, p } = setup();
  e.act("p", "blastStart");
  const x = p.x;
  step(e, p, 10, { x: 1, y: 0, angle: 0 });
  assert.ok(p.x > x + 80);
  e.act("p", "blast");
  assert.equal(e.shots.length, 0);
  const before = p.x;
  step(e, p, 3, { x: 1, y: 0, angle: 0 });
  assert.ok(p.x < before + 30);
  e.act("p", "blastStart");
  e.act("p", "blast");
  assert.equal(p.chargeAt, null);
  step(e, p, 7);
  assert.ok(e.shots.length > 0);
});

test("holding melee prepares one heavy attack and precise defense prevents launch", () => {
  const { e, p } = setup();
  p.mode = "flight";
  const foe = e.spawn("earth", "A", "soldier", p.x + 80, p.y, false, {
    hp: 1000,
    maxHp: 1000,
    stun: 999,
  });
  e.act("p", "attackStart");
  step(e, p, 16);
  assert.equal(foe.hp, 1000);
  const ki = p.ki;
  e.act("p", "attackRelease");
  step(e, p, 14);
  // Successful heavy contact refunds 4 Ki from its 18 Ki commitment.
  assert.ok(p.ki < ki - 11 && p.ki > ki - 18);
  assert.equal(foe.launch.tier, "high");
  const q = e.addPlayer("q");
  p.pvp = q.pvp = true;
  q.x = p.x + 40;
  q.y = p.y;
  q.state = "guard";
  q.angle = Math.PI;
  q.guardAt = e.time;
  q.ki = 100;
  e.damage(p, q, 90, true);
  assert.equal(q.launch, undefined);
  assert.equal(q.hp, q.maxHp);
});

test("high impact destroys shared terrain once and snapshots synchronize debris", () => {
  const { e, p } = setup(),
    q = e.addPlayer("q");
  const feature = W.features("earth", 5, 5).find(
    (o) => o.kind === "prop" || o.kind === "rock",
  );
  p.x = q.x = feature.x;
  p.y = q.y = feature.y;
  e.impactTerrain(p, "high");
  const n = Object.keys(e.worldMemory).length;
  e.impactTerrain(p, "high");
  assert.equal(Object.keys(e.worldMemory).length, n);
  assert.ok(n > 0);
  assert.deepEqual(e.snapshot("p").self.debris, e.snapshot("q").self.debris);
  assert.ok(e.snapshot("p").self.debris.some((d) => d.id === feature.id));
});
