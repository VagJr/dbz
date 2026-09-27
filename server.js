"use strict";
const path = require("node:path"),
  fs = require("node:fs"),
  http = require("node:http"),
  express = require("express");
const { Server } = require("socket.io");

// Load this checkout's ignored local settings without replacing explicit environment variables.
try {
  const localEnv = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const { Engine, cleanName } = require("./src/engine");
const { Store } = require("./src/store");
const Security = require("./src/security"),
  Beta = require("./shared/beta");
async function start(options = {}) {
  const cfg = Security.config(options),
    gate = new Security.Limiter(),
    connections = new Map();
  let paused = false,
    closing = false,
    lastTickMs = 0,
    maxTickMs = 0;
  const store = new Store(
    options.dataDir || process.env.DATA_DIR || path.join(__dirname, "data"),
  );
  await store.acquire();
  try {
    await store.init();
    await store.loadWorld();
  } catch (e) {
    await store.release();
    throw e;
  }
  const engine = new Engine(),
    app = express(),
    server = http.createServer(app),
    io = new Server(server, {
      maxHttpBufferSize: 4096,
      serveClient: true,
      allowRequest: (req, cb) =>
        cb(
          null,
          Security.originAllowed(req.headers.origin, req.headers.host, cfg),
        ),
    });
  engine.worldMemory = store.worldMemory;
  app.disable("x-powered-by");
  app.use(Security.headers);
  app.use((req, res, next) => {
    if (cfg.production)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.get("/health", (_, res) =>
    res
      .status(paused || closing ? 503 : 200)
      .json({
        ok: !paused && !closing,
        version: Beta.version,
        players: engine.players.size,
        payments: false,
      }),
  );
  app.get("/api/status", (_, res) =>
    res.json({
      version: Beta.version,
      mode: cfg.production ? "beta restrita" : "desenvolvimento local",
      saving: paused ? "indisponível" : "disponível",
      lastSavedAt: store.lastSavedAt,
      players: engine.players.size,
      capacity: cfg.maxPlayers,
      payments: false,
    }),
  );
  app.use("/shared", express.static(path.join(__dirname, "shared")));
  app.use("/audio", express.static(path.join(__dirname, "audio")));
  app.use(express.static(path.join(__dirname, "public")));
  const sessions = new Map();
  const capture = () => {
    for (const [key, id] of sessions) {
      const p = engine.players.get(id);
      if (p && store.get(key)) store.save(key, engine.profile(p));
    }
  };
  const persist = async () => {
    capture();
    try {
      await store.flush();
      paused = false;
    } catch (e) {
      paused = true;
      io.emit(
        "notice",
        "Mundo pausado: o salvamento falhou. Suas ações serão retomadas após recuperação.",
      );
      throw e;
    }
  };
  const audit = (p, action, result) => {
    const entries = (engine.worldMemory.audit ||= []);
    entries.push({
      at: Date.now(),
      citizen: p?.citizenId || null,
      action,
      ok: !!result.ok,
    });
    if (entries.length > 2000) entries.splice(0, entries.length - 2000);
  };
  io.on("connection", (socket) => {
    const ip = Security.clientIP(
      socket.handshake.address,
      socket.handshake.headers,
      cfg,
    );
    if (
      closing ||
      io.engine.clientsCount > cfg.maxConnections ||
      (connections.get(ip) || 0) >= cfg.maxPerIP ||
      !gate.allow("connect:" + ip, 30, 60000)
    ) {
      socket.disconnect(true);
      return;
    }
    connections.set(ip, (connections.get(ip) || 0) + 1);
    const authTimer = setTimeout(() => {
      if (!engine.players.has(socket.id)) socket.disconnect(true);
    }, 60000);
    authTimer.unref();
    socket.use(([event], next) => {
      if (paused || closing) {
        socket.emit("notice", "Mundo em manutenção. Aguarde antes de agir.");
        return;
      }
      if (!gate.allow("packets:" + socket.id, 160, 1000)) {
        socket.disconnect(true);
        return;
      }
      next();
    });
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
      if (
        joining ||
        token ||
        limited("join", 3, 10000) ||
        !gate.allow("join:" + ip, 12, 60000)
      )
        return;
      joining = true;
      try {
        if (!data || typeof data !== "object") return;
        if (cfg.invite && data.invite !== cfg.invite) {
          socket.emit("notice", "Esta beta exige um convite válido.");
          return;
        }
        if (engine.players.size >= cfg.maxPlayers) {
          socket.emit(
            "notice",
            "Servidor cheio. Tente novamente em instantes.",
          );
          return;
        }
        let profile = store.get(data.token);
        if (data.token && !profile) {
          socket.emit(
            "notice",
            "A chave de acesso expirou ou é inválida. Use a recuperação de conta.",
          );
          return;
        }
        if (profile?._account?.bannedUntil > Date.now()) {
          socket.emit(
            "notice",
            "Acesso suspenso. Consulte o operador da beta.",
          );
          return;
        }
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
          profile = {
            name: cleanName(data.name),
            origin: data.origin,
            creation:
              data.creation && typeof data.creation === "object"
                ? data.creation
                : undefined,
          };
          token = store.create(profile);
        }
        if (!socket.connected) return;
        const p = engine.addPlayer(socket.id, profile);
        clearTimeout(authTimer);
        sessions.set(token, socket.id);
        store.save(token, engine.profile(p));
        await persist();
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
    socket.on("sandbox", async (data, ack) => {
      if (!token || limited("sandbox", 5))
        return (
          typeof ack === "function" &&
          ack({ ok: false, message: "Aguarde antes de enviar outra ação." })
        );
      const result = engine.sandboxCommand(socket.id, data);
      audit(
        engine.players.get(socket.id),
        "sandbox:" + String(data?.action).slice(0, 24),
        result,
      );
      try {
        await persist();
        if (typeof ack === "function") ack(result);
        if (socket.connected)
          socket.emit("snapshot", engine.snapshot(socket.id));
      } catch {
        if (typeof ack === "function")
          ack({
            ok: false,
            message: "Salvamento indisponível. Mundo pausado.",
          });
      }
    });
    socket.on("beta", async (data, ack) => {
      if (!token || limited("beta", 3)) return;
      const result = engine.betaCommand(socket.id, data);
      audit(
        engine.players.get(socket.id),
        "beta:" + String(data?.action).slice(0, 24),
        result,
      );
      try {
        await persist();
        if (typeof ack === "function") ack(result);
      } catch {
        if (typeof ack === "function")
          ack({ ok: false, message: "Salvamento indisponível." });
      }
    });
    socket.on("account", async (data, ack) => {
      if (
        typeof ack !== "function" ||
        !data ||
        typeof data !== "object" ||
        !gate.allow("account:" + ip, 5, 60000)
      )
        return;
      const p = engine.players.get(socket.id);
      try {
        if (data.action === "recovery" && p && token) {
          capture();
          const code = store.recovery(token);
          await persist();
          ack({
            ok: true,
            code,
            message:
              "Guarde este código em local privado. Substitui o anterior e só pode ser usado uma vez.",
          });
          return;
        }
        if (data.action === "export" && p) {
          ack({ ok: true, profile: engine.profile(p) });
          return;
        }
        if (data.action === "restore" && !token) {
          capture();
          const recovered = store.recover(data.code);
          if (!recovered) {
            ack({ ok: false, message: "Código inválido ou já utilizado." });
            return;
          }
          for (const [key, id] of sessions)
            if (store.key(key) === recovered.oldKey) {
              sessions.delete(key);
              io.sockets.sockets.get(id)?.disconnect(true);
            }
          await persist();
          ack({
            ok: true,
            token: recovered.token,
            message:
              "Acesso recuperado. Entre novamente e gere outro código de recuperação.",
          });
          return;
        }
        ack({ ok: false, message: "Ação de conta indisponível." });
      } catch {
        paused = true;
        ack({
          ok: false,
          message: "Não foi possível salvar. O servidor foi pausado.",
        });
      }
    });
    socket.on("community", async (data, ack) => {
      if (
        !token ||
        typeof ack !== "function" ||
        !data ||
        typeof data !== "object" ||
        limited("community", 2, 10000)
      )
        return;
      const p = engine.players.get(socket.id),
        target = engine.players.get(data.target);
      if (!p) return;
      if (data.action === "block" && target && target.id !== p.id) {
        p.beta.blocked = [
          ...new Set([...p.beta.blocked, target.citizenId]),
        ].slice(-100);
      } else if (
        data.action === "report" &&
        typeof data.text === "string" &&
        data.text.trim().length >= 10
      ) {
        const reports = (engine.worldMemory.reports ||= []);
        if (reports.length >= 1000)
          return ack({
            ok: false,
            message: "Fila de relatos cheia. Contate o operador.",
          });
        reports.push({
          id: require("node:crypto").randomUUID(),
          at: Date.now(),
          from: p.citizenId,
          target: target?.citizenId || null,
          text: data.text.replace(/[<>\u0000-\u001f]/g, "").slice(0, 1000),
          status: "open",
        });
      } else
        return ack({
          ok: false,
          message: "Preencha um relato com pelo menos dez caracteres.",
        });
      try {
        await persist();
        ack({
          ok: true,
          message:
            data.action === "block"
              ? "Mensagens deste jogador silenciadas."
              : "Relato registrado para revisão do operador.",
        });
      } catch {
        ack({ ok: false, message: "Salvamento indisponível." });
      }
    });
    socket.on("input", (data) => {
      if (!limited("input", 100)) engine.input(socket.id, data);
    });
    socket.on("action", (action) => {
      if (!limited("action", 64) && typeof action === "string")
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
      if (p && !p.duelId && !limited("pvp", 1) && engine.time - p.lastHit > 5) {
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
        if (q.world === p.world && !q.beta?.blocked.includes(p.citizenId))
          io.to(q.id).emit("chat", {
            id: p.id,
            name: p.name,
            text: text.trim().slice(0, 160),
          });
    });
    socket.on("disconnect", () => {
      clearTimeout(authTimer);
      const left = (connections.get(ip) || 1) - 1;
      if (left > 0) connections.set(ip, left);
      else connections.delete(ip);
      gate.entries.delete("packets:" + socket.id);
      const p = engine.players.get(socket.id);
      if (p && token && store.get(token)) {
        store.save(token, engine.profile(p));
        persist().catch((e) =>
          console.error("Falha no salvamento:", e.message),
        );
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
    if (paused || closing) {
      last = now;
      accumulator = 0;
      return;
    }
    const tickStart = now;
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
    lastTickMs = performance.now() - tickStart;
    maxTickMs = Math.max(maxTickMs, lastTickMs);
  }, 1000 / 60);
  const save = setInterval(
    () =>
      persist().catch((e) =>
        console.error("Falha no checkpoint:", e.code || e.message),
      ),
    15000,
  );
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(
        options.port ?? process.env.PORT ?? 25565,
        options.host ||
          process.env.HOST ||
          (cfg.production ? "127.0.0.1" : "0.0.0.0"),
        resolve,
      );
    });
  } catch (e) {
    clearInterval(loop);
    clearInterval(save);
    await store.release();
    throw e;
  }
  const close = async () => {
    closing = true;
    clearInterval(loop);
    clearInterval(save);
    for (const [token, id] of sessions) {
      const p = engine.players.get(id);
      if (p) store.save(token, engine.profile(p));
    }
    await new Promise((resolve) => io.close(resolve));
    try {
      await store.flush();
    } finally {
      await store.release();
    }
  };
  return {
    server,
    io,
    engine,
    store,
    close,
    metrics: () => ({ lastTickMs, maxTickMs, paused }),
  };
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
