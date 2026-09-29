"use strict";

const Atlas = require("../shared/universe-atlas");
const World = require("../shared/open-world");
const cells = new Map();
for (const source of Atlas.SITES) {
  if (source.kind === "interior") continue;
  const site = World.getAtlasSite(source.id);
  if (!site) continue;
  const key = site.world + ":" + Math.floor(site.x / World.CHUNK) + ":" + Math.floor(site.y / World.CHUNK);
  const list = cells.get(key) || [];
  list.push(site);
  cells.set(key, list);
}

module.exports = function installUniverseWorld(Engine) {
  const add = Engine.prototype.addPlayer;
  const profile = Engine.prototype.profile;
  const snapshot = Engine.prototype.snapshot;
  const tick = Engine.prototype.tick;

  Engine.prototype.addPlayer = function (id, saved = {}) {
    const p = add.call(this, id, saved);
    const site = typeof saved.surfaceRoute === "string" ? World.getAtlasSite(saved.surfaceRoute) : null;
    p.surfaceRoute = site?.world === p.world ? site.id : null;
    // Older profiles stored atlas landmarks in the manual survey ledger.
    const atlasFromSurvey = p.sandbox.discoveries
      .filter(key => key.startsWith("atlas:")).map(key => key.slice(6))
      .filter(id => Atlas.SITE_BY_ID[id]);
    p.sandbox.discoveries = p.sandbox.discoveries.filter(key => !key.startsWith("atlas:"));
    p.universeDiscoveries = [...new Set([
      ...(Array.isArray(saved.universeDiscoveries) ? saved.universeDiscoveries : []),
      ...atlasFromSurvey,
    ].filter(id => Atlas.SITE_BY_ID[id]))].slice(0, 1000);
    p.universeDiscoverAt = 0;
    this.economyRankRefresh(p);
    return p;
  };
  Engine.prototype.profile = function (p) {
    return { ...profile.call(this, p), surfaceRoute: p.surfaceRoute || null,
      universeDiscoveries: [...p.universeDiscoveries] };
  };
  Engine.prototype.surfaceRoute = function (id, siteId) {
    const p = this.players.get(id);
    if (!p || p.afterlife?.pending || p.state === "dead")
      return { ok: false, message: "Conclua sua recuperação antes de marcar uma rota." };
    if (siteId === "") {
      p.surfaceRoute = null;
      return { ok: true, message: "Rota local removida." };
    }
    const site = siteId.length <= 70 ? World.getAtlasSite(siteId) : null;
    if (!site || site.world !== p.world || site.kind === "interior")
      return { ok: false, message: "Marque um local na superfície do mundo onde você está." };
    p.surfaceRoute = site.id;
    return { ok: true, message: "Rota marcada: " + site.name + ". Siga o marcador azul." };
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    const result = tick.call(this, dt);
    for (const p of this.players.values()) {
      if (p.world === "space" || p.state === "dead" || p.afterlife?.pending ||
          this.time < p.universeDiscoverAt) continue;
      p.universeDiscoverAt = this.time + 1;
      const cx = Math.floor(p.x / World.CHUNK), cy = Math.floor(p.y / World.CHUNK);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const site of cells.get(p.world + ":" + (cx + dx) + ":" + (cy + dy)) || []) {
          const range = Math.min(500, Math.max(180, site.radius * .15));
          if (Math.hypot(p.x - site.x, p.y - site.y) > range || p.universeDiscoveries.includes(site.id)) continue;
          p.universeDiscoveries.push(site.id);
          this.sandboxLog(p, "Descoberta: " + site.name);
          this.economyRewardActivity(p.id, {
            id: "discovery:" + site.id, kind: "discovery", world: p.world,
            level: Math.min(p.level, site.level || 1), contribution: 1, serverVerified: true,
          });
          this.emit("notice", p, { text: "DESCOBERTO · " + site.name, playerId: p.id });
          if (p.surfaceRoute === site.id) p.surfaceRoute = null;
        }
      }
    }
    return result;
  };
  Engine.prototype.snapshot = function (id) {
    const out = snapshot.call(this, id);
    if (!out) return out;
    const p = this.players.get(id), site = World.getAtlasSite(p.surfaceRoute);
    out.self.surfaceRoute = site?.world === p.world && !p.afterlife?.pending ? {
      siteId: site.id, name: site.name, world: site.world, x: site.x, y: site.y,
      distance: Math.round(Math.hypot(p.x - site.x, p.y - site.y)),
    } : null;
    out.self.universeSites = [...p.universeDiscoveries];
    return out;
  };
};
