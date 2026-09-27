"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { Store } = require("../src/store"),
  { Engine } = require("../src/engine"),
  B = require("../shared/beta"),
  W = require("../shared/open-world"),
  S = require("../src/security"),
  { start } = require("../server"),
  { io } = require("socket.io-client");
const event = (s, name) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Timeout " + name)), 5000);
    s.once(name, (v) => {
      clearTimeout(timer);
      resolve(v);
    });
  });
const ack = (s, name, data) =>
  new Promise((resolve, reject) =>
    s.timeout(5000).emit(name, data, (e, r) => (e ? reject(e) : resolve(r))),
  );
const dir = () => fs.mkdtemp(path.join(os.tmpdir(), "uz-beta-"));
const session = async (app, name = "Beta") => {
  const s = io("http://localhost:" + app.server.address().port, {
    transports: ["websocket"],
    reconnection: false,
  });
  await event(s, "connect");
  const ready = event(s, "joined");
  s.emit("join", { name, origin: "saiyan" });
  const joined = await ready;
  return { s, joined, p: app.engine.players.get(joined.id) };
};
test("production refuses missing HTTPS origins and exact origin matching rejects suffix tricks", () => {
  assert.throws(() => S.config({ production: true }));
  const c = S.config({ production: true, origins: "https://game.example" });
  assert.equal(S.originAllowed("https://game.example", "localhost", c), true);
  for (const origin of [
    undefined,
    "https://game.example.attacker.org",
    "http://game.example",
    "null",
  ])
    assert.equal(S.originAllowed(origin, "localhost", c), false);
});
test("coalesced checkpoint flush remains readable, preserves previous recovery point, detects corruption", async () => {
  const directory = await dir(),
    store = new Store(directory);
  await store.init();
  const token = store.create({ name: "Beta", zenni: 1 });
  await store.flush();
  store.save(token, { name: "Beta", zenni: 9 });
  await Promise.all(Array.from({ length: 12 }, () => store.flush()));
  const restored = new Store(directory);
  await restored.init();
  assert.equal(restored.get(token).zenni, 9);
  const previous = JSON.parse(
    await fs.readFile(path.join(directory, "checkpoint.previous.json")),
  );
  assert.ok([1, 9].includes(Object.values(previous.accounts)[0].zenni));
  const c = JSON.parse(
    await fs.readFile(path.join(directory, "checkpoint.json")),
  );
  Object.values(c.accounts)[0].zenni = 999;
  await fs.writeFile(
    path.join(directory, "checkpoint.json"),
    JSON.stringify(c),
  );
  await assert.rejects(new Store(directory).init(), /Checksum/);
});
test("single writer lock prevents concurrent server ownership", async () => {
  const directory = await dir(),
    a = new Store(directory),
    b = new Store(directory);
  await a.acquire();
  await assert.rejects(b.acquire(), /server.lock/);
  await a.release();
  await b.acquire();
  await b.release();
});
test("cosmetic entitlement is authoritative, persisted and never modifies gameplay stats", () => {
  const e = new Engine(),
    p = e.addPlayer("p");
  e.enemies = [];
  const before = {
    stats: { ...p.stats },
    hp: p.maxHp,
    ki: p.maxKi,
    zenni: p.zenni,
    xp: p.xp,
  };
  assert.equal(
    e.betaCommand("p", { action: "claim", item: "trail-cyan" }).ok,
    false,
  );
  p.sandbox.discoveries = ["a", "b"];
  assert.equal(
    e.betaCommand("p", { action: "claim", item: "trail-cyan" }).ok,
    true,
  );
  assert.equal(
    e.betaCommand("p", { action: "claim", item: "trail-cyan" }).ok,
    false,
  );
  assert.equal(
    e.betaCommand("p", { action: "style", item: "trail-cyan" }).ok,
    true,
  );
  assert.deepEqual(
    { stats: p.stats, hp: p.maxHp, ki: p.maxKi, zenni: p.zenni, xp: p.xp },
    before,
  );
  const q = e.addPlayer("q", e.profile(p));
  assert.equal(q.beta.equipped.trail, "trail-cyan");
  assert.equal(
    e.betaCommand("p", { action: "style", item: "trail-gold" }).ok,
    false,
  );
});
test("expedition enforces location and level, advances two waves and rewards once", () => {
  const e = new Engine(),
    p = e.addPlayer("p"),
    def = B.expeditions[0];
  e.nextExploration = 1e9;
  e.enemies = [];
  assert.equal(
    e.betaCommand("p", { action: "expedition", id: def.id }).ok,
    false,
  );
  p.level = 5;
  p.x = def.x;
  p.y = def.y;
  p.world = def.world;
  p.invuln = 1e9;
  assert.equal(
    e.betaCommand("p", { action: "expedition", id: def.id }).ok,
    true,
  );
  assert.equal(
    e.betaCommand("p", { action: "expedition", id: def.id }).ok,
    false,
  );
  const xp = p.xp;
  for (let i = 0; i < 2; i++) {
    for (const foe of e.enemies.filter((x) => x.expeditionOwner === p.id))
      e.damage(p, foe, 99999);
    if (i === 0) assert.equal(p.xp, xp);
    e.tick();
  }
  assert.equal(p.beta.completed, 1);
  assert.equal(p.expedition, null);
  const z = p.zenni;
  e.tick();
  assert.equal(p.zenni, z);
  assert.equal(
    e.betaCommand("p", { action: "expedition", id: def.id }).ok,
    false,
  );
});
test("ground cover blocks movement and sight until destroyed while flight traverses it", () => {
  const e = new Engine();
  let o;
  for (let x = 2; x < 8 && !o; x++)
    o = W.features("earth", x, 5).find(
      (o) => o.kind === "prop" && o.sheet === "nature",
    );
  assert.ok(o);
  const a = { world: "earth", x: o.x - 160, y: o.y, mode: "ground" },
    b = { world: "earth", x: o.x + 160, y: o.y, mode: "ground" };
  assert.equal(e.clearSight(a, b), false);
  e.move(a, 320, 0);
  assert.ok(a.x < o.x);
  a.mode = "flight";
  e.move(a, 320, 0);
  assert.ok(a.x > o.x);
  e.worldMemory ??= {};
  e.worldMemory["debris:" + o.id] = {};
  const c = { world: "earth", x: o.x - 80, y: o.y, mode: "ground" },
    d = { world: "earth", x: o.x + 80, y: o.y, mode: "ground" };
  assert.equal(e.clearSight(c, d), true);
});
test("account recovery rotates access, preserves recent progress and cannot be replayed", async () => {
  const app = await start({ port: 0, dataDir: await dir() });
  let a, r;
  try {
    a = await session(app);
    const result = await ack(a.s, "account", { action: "recovery" });
    assert.match(result.code, /^[a-f0-9]{64}$/);
    a.p.zenni = 875;
    r = io("http://localhost:" + app.server.address().port, {
      transports: ["websocket"],
      reconnection: false,
    });
    await event(r, "connect");
    const restored = await ack(r, "account", {
      action: "restore",
      code: result.code,
    });
    assert.equal(restored.ok, true);
    assert.equal(app.store.get(a.joined.token), null);
    assert.equal(app.store.get(restored.token).zenni, 875);
    assert.equal(
      (await ack(r, "account", { action: "restore", code: result.code })).ok,
      false,
    );
    const ready = event(r, "joined");
    r.emit("join", { token: restored.token });
    await ready;
    const exported = await ack(r, "account", { action: "export" });
    assert.equal(exported.profile.zenni, 875);
    assert.equal(exported.profile._account, undefined);
    const disk = await fs.readFile(
      path.join(app.store.directory, "checkpoint.json"),
      "utf8",
    );
    assert.ok(!disk.includes(result.code));
    assert.ok(!disk.includes(restored.token));
  } finally {
    a?.s.disconnect();
    r?.disconnect();
    await app.close();
  }
});
test("cross-origin websocket and invalid resume tokens are denied without account creation", async () => {
  const app = await start({ port: 0, dataDir: await dir() });
  const url = "http://localhost:" + app.server.address().port,
    bad = io(url, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Origin: "https://attacker.example" },
    }),
    normal = io(url, { transports: ["websocket"], reconnection: false });
  try {
    await event(bad, "connect_error");
    await event(normal, "connect");
    const notice = event(normal, "notice");
    normal.emit("join", {
      token: "0".repeat(64),
      name: "Intruso",
      origin: "saiyan",
    });
    assert.match(await notice, /inválida/);
    assert.equal(app.engine.players.size, 0);
    assert.equal(Object.keys(app.store.accounts).length, 0);
  } finally {
    bad.disconnect();
    normal.disconnect();
    await app.close();
  }
});
test("a checkpoint failure pauses simulation and health fails closed until persistence resumes", async () => {
  const app = await start({ port: 0, dataDir: await dir() });
  let a;
  try {
    a = await session(app);
    const flush = app.store.flush.bind(app.store);
    app.store.flush = () => Promise.reject(Error("disk unavailable"));
    const r = await ack(a.s, "beta", { action: "claim", item: "trail-cyan" });
    assert.equal(r.ok, false);
    assert.equal(app.metrics().paused, true);
    const t = app.engine.time;
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(app.engine.time, t);
    assert.equal(
      (await fetch("http://localhost:" + app.server.address().port + "/health"))
        .status,
      503,
    );
    app.store.flush = flush;
  } finally {
    a?.s.disconnect();
    await app.close();
  }
});
test("community reports are bounded and blocking removes delivery without changing gameplay", async () => {
  const app = await start({ port: 0, dataDir: await dir() });
  let a, b;
  try {
    a = await session(app, "Alice");
    b = await session(app, "Bob");
    const block = await ack(a.s, "community", {
      action: "block",
      target: b.joined.id,
    });
    assert.equal(block.ok, true);
    let heard = false;
    a.s.on("chat", () => (heard = true));
    b.s.emit("chat", "Mensagem de teste");
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(heard, false);
    const report = await ack(a.s, "community", {
      action: "report",
      target: b.joined.id,
      text: "Relato de teste de moderação.",
    });
    assert.equal(report.ok, true);
    assert.equal(app.engine.worldMemory.reports[0].target, b.p.citizenId);
  } finally {
    a?.s.disconnect();
    b?.s.disconnect();
    await app.close();
  }
});
test("trusted proxy address is explicit and spoofed client IP headers are ignored", () => {
  const c = S.config({ trustedProxyIPs: "127.0.0.1" });
  assert.equal(
    S.clientIP("203.0.113.8", { "x-real-ip": "8.8.8.8" }, c),
    "203.0.113.8",
  );
  assert.equal(
    S.clientIP("::ffff:127.0.0.1", { "x-real-ip": "203.0.113.9" }, c),
    "203.0.113.9",
  );
  assert.equal(
    S.clientIP("127.0.0.1", { "x-real-ip": "1.2.3.4, 8.8.8.8" }, c),
    "127.0.0.1",
  );
});
test("operator backup, report resolution and suspension use an offline lock and preserve private credentials", async () => {
  const { run } = require("../tools/beta-ops.cjs"),
    directory = await dir(),
    s = new Store(directory);
  await s.init();
  const token = s.create({ name: "Beta", citizenId: "c1" });
  s.worldMemory.reports = [{ id: "r1", status: "open", text: "Um problema" }];
  await s.flush();
  await s.acquire();
  await assert.rejects(run(["status"], directory), /server.lock/);
  await s.release();
  const status = await run(["status"], directory);
  assert.equal(status.accounts, 1);
  assert.ok(!JSON.stringify(status).includes(token));
  const backup = await run(["backup"], directory);
  assert.equal(backup.verified, true);
  assert.ok((await fs.stat(backup.backup)).size > 0);
  await run(["resolve", "r1", "reviewed", "Problema corrigido"], directory);
  await run(["suspend", "c1", "24", "Teste de moderação"], directory);
  const r = new Store(directory);
  await r.init();
  assert.equal(r.worldMemory.reports[0].status, "reviewed");
  assert.ok(r.get(token)._account.bannedUntil > Date.now());
  await run(["resume", "c1", "Revisão concluída"], directory);
  const active = new Store(directory);
  await active.init();
  assert.equal(active.get(token)._account.bannedUntil, 0);
});
