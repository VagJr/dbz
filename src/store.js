"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
class Store {
  constructor(directory) {
    this.directory = directory;
    this.accounts = {};
    this.worldMemory = {};
    this.queue = Promise.resolve();
    this.waiters = [];
    this.revision = 0;
    this.lastSavedAt = 0;
    this.lastError = null;
  }
  async acquire() {
    await fs.mkdir(this.directory, { recursive: true });
    const lock = path.join(this.directory, "server.lock");
    try {
      this.lock = await fs.open(lock, "wx", 0o600);
      await this.lock.writeFile(
        JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      );
    } catch (e) {
      if (e.code === "EEXIST")
        throw Error(
          "Há um server.lock neste diretório. Encerre a instância anterior ou verifique o PID antes de remover um lock obsoleto.",
        );
      throw e;
    }
  }
  async release() {
    if (this.lock) {
      await this.lock.close();
      this.lock = null;
      await fs.unlink(path.join(this.directory, "server.lock"));
    }
  }
  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const c = JSON.parse(
        await fs.readFile(path.join(this.directory, "checkpoint.json"), "utf8"),
      );
      if (![1, 2].includes(c.version) || !c.accounts || !c.world)
        throw Error("Checkpoint inválido");
      if (
        c.version === 2 &&
        c.checksum !==
          digest(JSON.stringify({ accounts: c.accounts, world: c.world }))
      )
        throw Error(
          "Checksum do checkpoint inválido; restaure uma cópia verificada.",
        );
      this.accounts = c.accounts;
      this.worldMemory = c.world;
      this.checkpointLoaded = true;
      this.lastSavedAt = c.savedAt || 0;
      return;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    try {
      this.accounts = JSON.parse(
        await fs.readFile(path.join(this.directory, "profiles.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT")
        throw Error("Arquivo de perfis inválido. Restaure o backup.", {
          cause: e,
        });
    }
  }
  async loadWorld() {
    if (this.checkpointLoaded) return;
    try {
      this.worldMemory = JSON.parse(
        await fs.readFile(path.join(this.directory, "world.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  key(token) {
    return digest(token);
  }
  get(token) {
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? this.accounts[this.key(token)] || null
      : null;
  }
  create(profile) {
    const token = crypto.randomBytes(32).toString("hex");
    this.accounts[this.key(token)] = profile;
    return token;
  }
  save(token, profile) {
    const key = this.key(token),
      old = this.accounts[key];
    this.accounts[key] = {
      ...profile,
      ...(old?._account ? { _account: old._account } : {}),
    };
  }
  recovery(token) {
    const p = this.get(token);
    if (!p) return null;
    const code = crypto.randomBytes(32).toString("hex");
    p._account = {
      ...(p._account || {}),
      recovery: digest(code),
      updatedAt: Date.now(),
    };
    return code;
  }
  recover(code) {
    if (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code)) return null;
    const hash = digest(code),
      entry = Object.entries(this.accounts).find(
        ([, p]) => p._account?.recovery === hash,
      );
    if (!entry) return null;
    const [oldKey, p] = entry,
      token = crypto.randomBytes(32).toString("hex");
    delete this.accounts[oldKey];
    this.accounts[this.key(token)] = {
      ...p,
      _account: { ...p._account, recovery: null, updatedAt: Date.now() },
    };
    return { token, oldKey };
  }
  flush() {
    const revision = ++this.revision;
    this.pending = {
      revision,
      accounts: JSON.stringify(this.accounts),
      world: JSON.stringify(this.worldMemory),
    };
    const promise = new Promise((resolve, reject) =>
      this.waiters.push({ revision, resolve, reject }),
    );
    if (!this.writing) this.drain();
    this.queue = promise;
    return promise;
  }
  async atomic(name, text) {
    const file = path.join(this.directory, name),
      handle = await fs.open(file + ".tmp", "w", 0o600);
    try {
      await handle.writeFile(text);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(file + ".tmp", file);
  }
  async drain() {
    this.writing = true;
    try {
      while (this.pending) {
        const job = this.pending;
        this.pending = null;
        const savedAt = Date.now(),
          data = '{"accounts":' + job.accounts + ',"world":' + job.world + "}",
          checkpoint =
            '{"version":2,"savedAt":' +
            savedAt +
            ',"checksum":' +
            JSON.stringify(digest(data)) +
            "," +
            data.slice(1);
        // The prior checkpoint is a bounded local recovery aid. Restoration is explicit.
        try {
          await fs.copyFile(
            path.join(this.directory, "checkpoint.json"),
            path.join(this.directory, "checkpoint.previous.json"),
          );
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        await this.atomic("checkpoint.json", checkpoint);
        this.lastSavedAt = savedAt;
        this.lastError = null;
        // Compatibility mirrors are not the authority; a mirror failure cannot undo a committed checkpoint.
        try {
          await this.atomic("profiles.json", job.accounts);
          await this.atomic("world.json", job.world);
        } catch (e) {
          this.mirrorError = e.code || "mirror-write";
        }
        const done = this.waiters.filter((w) => w.revision <= job.revision);
        this.waiters = this.waiters.filter((w) => w.revision > job.revision);
        done.forEach((w) => w.resolve());
      }
    } catch (e) {
      this.lastError = e.code || "checkpoint-write";
      this.pending = null;
      const waiters = this.waiters.splice(0);
      waiters.forEach((w) => w.reject(e));
    } finally {
      this.writing = false;
    }
  }
}
module.exports = { Store };
