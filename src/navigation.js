"use strict";
const Nav = require("../shared/navigation");
module.exports = function install(Engine) {
  Engine.prototype.route = function (id, world) {
    const p = this.players.get(id);
    if (!p || !Nav.get(world)) return false;
    p.destination = world;
    return true;
  };
  Engine.prototype.orbit = function (id) {
    const p = this.players.get(id);
    if (!p || p.state === "dead" || p.stun > this.time) return false;
    if (p.world === "space") return this.enterPlanet(id);
    if (p.ascent) {
      p.ascent = false;
      return true;
    }
    if (this.time - p.lastHit < 4) {
      this.emit("notice", p, { text: "SAIA DO COMBATE PARA ENTRAR EM ÓRBITA" });
      return false;
    }
    p.mode = "flight";
    p.ascent = true;
    p.training = null;
    p.chargeAt = null;
    this.emit("takeoff", p, { text: "ASCENSÃO ORBITAL" });
    return true;
  };
  Engine.prototype.navigationTick = function (p, dt) {
    if (p.world === "space") {
      p.altitude = 1;
      const near = Nav.nearest(p);
      if (!near.realm && near.distance < 160 && this.time - (p.lastTravel || 0) > 3) this.enterPlanet(p.id);
      return;
    }
    if (p.ascent && this.time - p.lastHit < 4) p.ascent = false;
    p.altitude = Math.max(
      0,
      Math.min(1, (p.altitude || 0) + (p.ascent ? dt / 6 : -dt / 5)),
    );
    if (!p.ascent || p.altitude < 1) return;
    if (this.time - p.lastHit < 4) {
      p.ascent = false;
      return;
    }
    const node = Nav.get(p.world) || Nav.get("earth");
    const target = Nav.get(p.destination);
    const angle =
      target && target.id !== node.id
        ? Math.atan2(target.y - node.y, target.x - node.x)
        : p.angle;
    p.surface = { world: p.world, x: p.x, y: p.y };
    p.world = "space";
    p.ascent = false;
    p.mode = "flight";
    p.x = node.x + Math.cos(angle) * (node.radius + 350);
    p.y = node.y + Math.sin(angle) * (node.radius + 350);
    p.vx = Math.cos(angle) * 1100;
    p.vy = Math.sin(angle) * 1100;
    p.angle = angle;
    p.chargeAt = null;
    p.lastTravel = this.time;
  };
  Engine.prototype.enterPlanet = function (id) {
    const p = this.players.get(id);
    if (!p || p.world !== "space" || p.state === "dead") return false;
    const node = Nav.nearest(p);
    if (node.distance > Nav.entryRange) {
      this.emit("notice", p, { text: "APROXIME-SE DE UM PLANETA OU PORTAL" });
      return false;
    }
    if (!this.travel(id, node.id)) return false;
    if (p.surface?.world === node.id) {
      p.x = p.surface.x;
      p.y = p.surface.y;
    }
    p.altitude = 0.95;
    p.ascent = false;
    this.emit("land", p, { text: node.name.toUpperCase() });
    return true;
  };
  Engine.prototype.teleport = function (id, world) {
    const p = this.players.get(id);
    if (
      !p ||
      !Nav.get(world) ||
      !p.techniques.includes("teleport") ||
      !p.visited.includes(world) ||
      p.ki < 40 ||
      p.world === world
    )
      return false;
    if (!this.travel(id, world)) return false;
    p.ki -= 40;
    p.altitude = 0;
    p.ascent = false;
    this.emit("takeoff", p, { text: "TRANSMISSÃO INSTANTÂNEA" });
    return true;
  };
};
