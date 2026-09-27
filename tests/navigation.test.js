const test = require("node:test"),
  assert = require("node:assert/strict");
const { Engine } = require("../src/engine");
const Nav = require("../shared/navigation");
function setup() {
  const game = new Engine();
  game.enemies = [];
  return { game, p: game.addPlayer("p", { name: "Piloto" }) };
}
function step(game, n, input = { x: 0, y: 0, angle: 0 }) {
  for (let i = 0; i < n; i++) {
    game.input("p", input);
    game.tick();
  }
}
test("surface, orbit, actual flight to another planet, descent and landing share one player", () => {
  const { game, p } = setup();
  const identity = p.id;
  assert.ok(game.route("p", "namek"));
  assert.ok(game.act("p", "orbit"));
  step(game, 190);
  assert.equal(p.world, "space");
  assert.equal(p.id, identity);
  const n = Nav.get("namek");
  let ticks = 0;
  while (Math.hypot(p.x - n.x, p.y - n.y) > n.radius + 300 && ticks++ < 1200) {
    const a = Math.atan2(n.y - p.y, n.x - p.x);
    step(game, 1, { x: Math.cos(a), y: Math.sin(a), angle: a, boost: true });
  }
  assert.ok(ticks < 1200);
  assert.ok(game.act("p", "flight"));
  assert.equal(p.world, "namek");
  assert.ok(p.visited.includes("namek"));
  step(game, 160);
  assert.equal(p.altitude, 0);
  assert.ok(game.act("p", "flight"));
  assert.equal(p.mode, "ground");
  const restored = game.addPlayer("q", game.profile(p));
  assert.equal(restored.world, "namek");
  assert.equal(restored.x, p.x);
});
test("surface has no former arena walls; movement is fast and reverses promptly", () => {
  const { game, p } = setup();
  p.x = 3300;
  step(game, 30, { x: 1, y: 0, angle: 0 });
  assert.ok(p.x > 4000);
  assert.ok(p.vx > 900);
  step(game, 12, { x: -1, y: 0, angle: Math.PI });
  assert.ok(p.vx < 0);
  assert.ok(game.toggleFlight("p"));
  assert.equal(p.mode, "ground");
  step(game, 10, { x: 1, y: 0, angle: 0 });
  assert.equal(p.mode, "ground");
});
test("teleport requires skill, discovery and ki; rejection never consumes resources", () => {
  const { game, p } = setup();
  assert.equal(game.teleport("p", "namek"), false);
  p.techniques.push("teleport");
  assert.equal(game.teleport("p", "namek"), false);
  p.visited.push("namek");
  p.ki = 39;
  assert.equal(game.teleport("p", "namek"), false);
  assert.equal(p.ki, 39);
  p.ki = 100;
  assert.equal(game.teleport("p", "namek"), true);
  assert.equal(p.ki, 60);
  assert.equal(p.world, "namek");
  assert.equal(game.teleport("p", "earth"), false);
});
test("ascent cancels on fresh damage and cannot be used to escape combat", () => {
  const { game, p } = setup();
  game.orbit("p");
  step(game, 20);
  p.lastHit = game.time;
  step(game, 40);
  assert.equal(p.world, "earth");
  assert.equal(p.ascent, false);
  assert.equal(game.orbit("p"), false);
});
test("untrusted routes and remote landings are rejected; space persistence stays finite", () => {
  const { game, p } = setup();
  assert.equal(game.route("p", { id: "namek" }), false);
  assert.equal(game.route("p", "__proto__"), false);
  p.world = "space";
  p.x = 70000;
  p.y = 80000;
  assert.equal(game.enterPlanet("p"), false);
  const q = game.addPlayer("q", game.profile(p));
  assert.equal(q.world, "space");
  assert.equal(q.x, 70000);
});
test("charged animation synchronizes, and cancelled or abandoned charge cannot remain stuck", () => {
  const { game, p } = setup();
  game.act("p", "blastStart");
  step(game, 20);
  assert.ok(game.snapshot("p").players[0].chargeRatio > 0.6);
  game.act("p", "cancelCharge");
  assert.equal(p.chargeAt, null);
  game.act("p", "blastStart");
  for (let i = 0; i < 12; i++) game.tick();
  assert.equal(p.chargeAt, null);
});
