"use strict";
const path = require("node:path"),
  http = require("node:http"),
  express = require("express");
const { Server } = require("socket.io");
const { Engine, cleanName } = require("./src/engine");
const { Store } = require("./src/store");
async function start(options = {}) {
  const store = new Store(
    options.dataDir || process.env.DATA_DIR || path.join(__dirname, "data"),
  );
  await store.init();
  await store.loadWorld();
  const engine = new Engine(),
    app = express(),
    server = http.createServer(app),
    io = new Server(server, { maxHttpBufferSize: 4096, serveClient: true });
  engine.worldMemory = store.worldMemory;
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.get("/health", (_, res) =>
    res.json({ ok: true, version: "3.0.0", players: engine.players.size }),
  );
  app.use("/shared", express.static(path.join(__dirname, "shared")));
  app.use("/audio", express.static(path.join(__dirname, "audio")));
  app.use(express.static(path.join(__dirname, "public")));
  const sessions = new Map();
  io.on("connection", (socket) => {
    const rates = new Map();
    let token = null,
      joining = false;
    const limited = (name, count, windowMs = 1000) => {
      const now = Date.now(),
        r = rates.get(name) || { at: now, n: 0 };
      if (now - r.at >= windowMs) {
        r.at = now;
        r.n = 0;
      }
      r.n++;
      rates.set(name, r);
      return r.n > count;
    };
    socket.on("join", async (data) => {
      if (joining || token || limited("join", 3, 10000)) return;
      joining = true;
      try {
        if (!data || typeof data !== "object") return;
        let profile = store.get(data.token);
        if (
          !profile &&
          (!cleanName(data.name) ||
            !["saiyan", "earthling", "namekian", "majin"].includes(data.origin))
        ) {
          socket.emit("notice", "Escolha um nome e uma origem.");
          return;
        }
        if (profile) {
          token = data.token;
          const previous = sessions.get(token);
          if (previous) {
            const old = engine.players.get(previous);
            if (old) {
              store.save(token, engine.profile(old));
              profile = store.get(token);
            }
            io.sockets.sockets.get(previous)?.disconnect(true);
          }
        } else {
          profile = { name: cleanName(data.name), origin: data.origin };
          token = store.create(profile);
        }
        const p = engine.addPlayer(socket.id, profile);
        sessions.set(token, socket.id);
        store.save(token, engine.profile(p));
        await store.flush();
        if (socket.connected) {
          socket.emit("joined", { id: socket.id, token });
          socket.emit("snapshot", engine.snapshot(socket.id));
        }
      } catch (e) {
        console.error("Falha ao salvar perfil:", e.message);
        socket.emit(
          "notice",
          "Não foi possível salvar o perfil. Tente novamente.",
        );
        socket.disconnect(true);
      } finally {
        joining = false;
      }
    });
    socket.on("input", (data) => {
      if (!limited("input", 50)) engine.input(socket.id, data);
    });
    socket.on("action", (action) => {
      if (!limited("action", 16) && typeof action === "string")
        engine.act(socket.id, action);
    });
    socket.on("interact", () => {
      if (!limited("interact", 2)) {
        const message = engine.interact(socket.id);
        if (message) socket.emit("notice", message);
      }
    });
    socket.on("route", (world) => {
      if (!limited("route", 3) && engine.route(socket.id, world))
        socket.emit(
          "notice",
          "Rota marcada. Use V para subir à órbita e siga a bússola. Perto do destino, use F para descer.",
        );
    });
    socket.on("travel", (world) => {
      if (!limited("travel", 2))
        socket.emit(
          "notice",
          (
            typeof world === "string" && /^rift:[0-9]{1,18}$/.test(world)
              ? engine.travel(socket.id, world)
              : engine.teleport(socket.id, world)
          )
            ? "Viagem concluída."
            : "Teleporte exige a técnica de Yardrat, destino descoberto, 40 de ki e estar fora de combate.",
        );
    });
    socket.on("campaign", (id) => {
      if (!limited("campaign", 2))
        socket.emit(
          "notice",
          engine.campaign(socket.id, id)
            ? "Campanha selecionada. Encontre o mestre no mundo indicado."
            : "Aguarde o fim do combate.",
        );
    });
    socket.on("train", () => {
      if (!limited("train", 2)) socket.emit("notice", engine.train(socket.id));
    });
    socket.on("learn", (id) => {
      if (!limited("learn", 2))
        socket.emit("notice", engine.learn(socket.id, id));
    });
    socket.on("equip", (id) => {
      if (!limited("equip", 2)) engine.equip(socket.id, id);
    });
    socket.on("attribute", (id) => {
      if (!limited("attribute", 4)) engine.attribute(socket.id, id);
    });
    socket.on("pvp", () => {
      const p = engine.players.get(socket.id);
      if (p && !limited("pvp", 1) && engine.time - p.lastHit > 5) {
        p.pvp = !p.pvp;
        socket.emit(
          "notice",
          p.pvp
            ? "Duelos ativados com outros jogadores que também aceitaram."
            : "Duelos desativados.",
        );
      }
    });
    socket.on("chat", (text) => {
      const p = engine.players.get(socket.id);
      if (!p || typeof text !== "string" || limited("chat", 2) || !text.trim())
        return;
      for (const q of engine.players.values())
        if (q.world === p.world)
          io.to(q.id).emit("chat", {
            name: p.name,
            text: text.trim().slice(0, 160),
          });
    });
    socket.on("disconnect", () => {
      const p = engine.players.get(socket.id);
      if (p && token) {
        store.save(token, engine.profile(p));
        store
          .flush()
          .catch((e) => console.error("Falha no salvamento:", e.message));
        if (sessions.get(token) === socket.id) sessions.delete(token);
      }
      engine.players.delete(socket.id);
    });
  });
  let ticks = 0,
    last = performance.now(),
    accumulator = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(0.2, (now - last) / 1000);
    last = now;
    while (accumulator >= 1 / 30) {
      engine.tick();
      accumulator -= 1 / 30;
      ticks++;
      if (ticks % 2 === 0) {
        for (const id of engine.players.keys())
          io.to(id).emit("snapshot", engine.snapshot(id));
        engine.effects = [];
      }
    }
  }, 1000 / 60);
  const save = setInterval(() => {
    for (const [token, id] of sessions) {
      const p = engine.players.get(id);
      if (p) store.save(token, engine.profile(p));
    }
    store.flush().catch((e) => {
      console.error("Falha no salvamento:", e.message);
      io.emit(
        "notice",
        "O salvamento está indisponível. Mantenha a sessão aberta.",
      );
    });
  }, 15000);
  await new Promise((resolve) =>
    server.listen(options.port ?? process.env.PORT ?? 3000, "0.0.0.0", resolve),
  );
  const close = async () => {
    clearInterval(loop);
    clearInterval(save);
    for (const [token, id] of sessions) {
      const p = engine.players.get(id);
      if (p) store.save(token, engine.profile(p));
    }
    await new Promise((resolve) => io.close(resolve));
    await store.flush();
  };
  return { server, io, engine, store, close };
}
if (require.main === module)
  start()
    .then((app) => {
      console.log(`UNIVERSE Z · http://localhost:${app.server.address().port}`);
      let closing = false;
      for (const signal of ["SIGINT", "SIGTERM"])
        process.on(signal, async () => {
          if (closing) return;
          closing = true;
          await app.close();
          process.exit(0);
        });
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
module.exports = { start };
