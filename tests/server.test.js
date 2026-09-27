const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { io } = require("socket.io-client");
const { start } = require("../server");
const { Store } = require("../src/store");
const once = (socket, event) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout: " + event)),
      4000,
    );
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
test(
  "two clients join, synchronize, isolate worlds, and restore a persisted profile",
  { timeout: 15000 },
  async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "uz-test-"));
    const app = await start({ port: 0, dataDir });
    const url = "http://localhost:" + app.server.address().port;
    const a = io(url, { transports: ["websocket"] }),
      b = io(url, { transports: ["websocket"] });
    try {
      await Promise.all([once(a, "connect"), once(b, "connect")]);
      const joinedA = once(a, "joined"),
        joinedB = once(b, "joined");
      a.emit("join", { name: "Alice", origin: "saiyan" });
      b.emit("join", { name: "Bob", origin: "namekian" });
      const [aa, bb] = await Promise.all([joinedA, joinedB]);
      assert.notEqual(aa.token, bb.token);
      const snapshot = await once(a, "snapshot");
      assert.equal(snapshot.online, 2);
      assert.ok(snapshot.players.some((p) => p.name === "Bob"));
      const p = app.engine.players.get(aa.id);
      app.engine.reward(p, 150);
      a.emit("input", { x: 1, y: 0, angle: 0 });
      await once(a, "snapshot");
      assert.ok(app.engine.players.get(aa.id).x > 1700);
      const bob = app.engine.players.get(bb.id);
      b.emit("travel", "namek");
      await once(b, "notice");
      assert.equal(
        bob.world,
        "earth",
        "undiscovered destinations cannot bypass travel",
      );
      bob.techniques.push("teleport");
      bob.visited.push("namek");
      b.emit("travel", "namek");
      await once(b, "snapshot");
      const earth = await once(a, "snapshot");
      assert.ok(!earth.players.some((p) => p.name === "Bob"));
      a.disconnect();
      const a2 = io(url, { transports: ["websocket"] });
      try {
        await once(a2, "connect");
        const joined = once(a2, "joined");
        a2.emit("join", { token: aa.token });
        await joined;
        const restored = await once(a2, "snapshot");
        assert.equal(restored.self.level, 2);
        assert.equal(restored.self.points, 3);
        assert.equal((await fetch(url + "/server.js")).status, 404);
        assert.equal((await fetch(url + "/data/profiles.json")).status, 404);
        assert.equal((await fetch(url + "/health")).status, 200);
      } finally {
        a2.disconnect();
      }
    } finally {
      a.disconnect();
      b.disconnect();
      await app.close();
    }
    const store = new Store(dataDir);
    await store.init();
    assert.equal(Object.keys(store.accounts).length, 2);
  },
);
test(
  "malformed socket payloads do not crash the process",
  { timeout: 10000 },
  async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "uz-invalid-"));
    const app = await start({ port: 0, dataDir }),
      socket = io("http://localhost:" + app.server.address().port);
    try {
      await once(socket, "connect");
      for (const event of [
        "input",
        "action",
        "travel",
        "campaign",
        "chat",
        "learn",
        "attribute",
      ]) {
        socket.emit(event, null);
        socket.emit(event, { unexpected: true });
      }
      await once(socket, "connect_error").catch(() => {});
      assert.ok(app.server.listening);
    } finally {
      socket.disconnect();
      await app.close();
    }
  },
);
