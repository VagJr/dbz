"use strict";
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { monitorEventLoopDelay } = require("node:perf_hooks");
const { start } = require("../server"),
  { io } = require("socket.io-client");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const clients = Math.max(
      1,
      Math.min(12, Number(process.env.UZ_LOAD_CLIENTS) || 12),
    ),
    seconds = Math.max(
      5,
      Math.min(60, Number(process.env.UZ_LOAD_SECONDS) || 20),
    );
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "uz-load-")),
    app = await start({ port: 0, dataDir, maxPerIP: 16 }),
    sockets = [],
    errors = [],
    latencies = [],
    ticks = [];
  let bytes = 0,
    snapshots = 0,
    driver;
  const delay = monitorEventLoopDelay({ resolution: 10 });
  try {
    for (let i = 0; i < clients; i++) {
      const s = io("http://localhost:" + app.server.address().port, {
        transports: ["websocket"],
        reconnection: false,
      });
      sockets.push(s);
      s.on("connect_error", (e) => errors.push(e.message));
      s.on("snapshot", (snap) => {
        bytes += Buffer.byteLength(JSON.stringify(snap));
        snapshots++;
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("join timeout")), 5000);
        s.once("joined", () => {
          clearTimeout(timer);
          resolve();
        });
        s.once("connect", () =>
          s.emit("join", { name: "Carga " + i, origin: "saiyan" }),
        );
      });
      const p = app.engine.players.get(s.id);
      p.storyState.questId = "db-pilaf";
      p.world = ["earth", "namek", "future"][i % 3];
      p.x = 10000 + (i % 4) * 600;
      p.y = 10000;
      p.invuln = 1e9;
      p.mode = "ground";
    }
    delay.enable();
    const initial = app.engine.time;
    let frame = 0;
    driver = setInterval(() => {
      frame++;
      for (let i = 0; i < sockets.length; i++) {
        const s = sockets[i];
        s.emit("input", {
          x: Math.cos(frame * 0.1 + i),
          y: Math.sin(frame * 0.1 + i),
          angle: frame * 0.1,
        });
        if (frame % 8 === 0) s.emit("action", "attack");
      }
      ticks.push(app.metrics().lastTickMs);
    }, 100);
    for (let i = 0; i < seconds; i++) {
      const begin = performance.now();
      const response = await fetch(
        "http://localhost:" + app.server.address().port + "/health",
      );
      latencies.push(performance.now() - begin);
      assert.equal(response.status, 200);
      await wait(1000);
    }
    clearInterval(driver);
    delay.disable();
    assert.deepEqual(errors, []);
    assert.equal(app.engine.players.size, clients);
    assert.equal(app.metrics().paused, false);
    assert.ok(app.engine.time - initial >= seconds * 0.75, "simulation drift");
    const percentile = (values, p) =>
      values.toSorted((a, b) => a - b)[
        Math.min(values.length - 1, Math.floor(values.length * p))
      ];
    const report = {
      at: new Date().toISOString(),
      clients,
      seconds,
      worlds: 3,
      enemies: app.engine.enemies.length,
      snapshots,
      averageSnapshotBytes: Math.round(bytes / snapshots),
      perClientKBps: Math.round(bytes / clients / seconds / 1024),
      httpP95Ms: +percentile(latencies, 0.95).toFixed(2),
      loopP95Ms: +(delay.percentile(95) / 1e6).toFixed(2),
      sampledTickP95Ms: +percentile(ticks, 0.95).toFixed(2),
      maxTickMs: +app.metrics().maxTickMs.toFixed(2),
      errors,
      scope:
        "Teste local sintético; não certifica escala pública ou latência WAN.",
    };
    await fs.mkdir(".preview-data/beta", { recursive: true });
    await fs.writeFile(
      ".preview-data/beta/load-report.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    clearInterval(driver);
    delay.disable();
    for (const s of sockets) s.disconnect();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
