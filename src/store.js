"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
class Store {
  constructor(directory) {
    this.directory = directory;
    this.accounts = {};
    this.worldMemory = {};
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      this.accounts = JSON.parse(
        await fs.readFile(path.join(this.directory, "profiles.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT")
        throw new Error(
          "Arquivo de perfis inválido. Restaure o backup antes de iniciar.",
          { cause: e },
        );
    }
  }
  async loadWorld() {
    try { this.worldMemory = JSON.parse(await fs.readFile(path.join(this.directory, "world.json"), "utf8")); }
    catch(e) { if(e.code !== "ENOENT") throw e; }
  }
  key(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
  get(token) {
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? this.accounts[this.key(token)]
      : null;
  }
  create(profile) {
    const token = crypto.randomBytes(32).toString("hex");
    this.accounts[this.key(token)] = profile;
    return token;
  }
  save(token, profile) {
    this.accounts[this.key(token)] = profile;
  }
  flush() {
    const snapshot = JSON.stringify(this.accounts);
    const worldSnapshot = JSON.stringify(this.worldMemory);
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        const file = path.join(this.directory, "profiles.json");
        await fs.writeFile(file + ".tmp", snapshot, { mode: 0o600 });
        await fs.rename(file + ".tmp", file);
        const worldFile = path.join(this.directory, "world.json");
        await fs.writeFile(worldFile + ".tmp", worldSnapshot);
        await fs.rename(worldFile + ".tmp", worldFile);
      });
    return this.queue;
  }
}
module.exports = { Store };
