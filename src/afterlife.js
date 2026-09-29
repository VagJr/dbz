"use strict";

// The afterlife is a persistent player journey. The combat engine still owns
// the three-second knockout; this layer redirects its recovery to Enma's realm.
const ARRIVAL = Object.freeze({ world: "otherworld", x: 1700, y: 1740 });
const ENMA = Object.freeze({ world: "otherworld", x: 2450, y: 1740, radius: 155 });
const MAX_COORD = 1e8;
const coordinate = (value, fallback) =>
  Number.isFinite(value) ? Math.max(-MAX_COORD, Math.min(MAX_COORD, value)) : fallback;

function restore(data, maps) {
  if (!data || data.pending !== true || !maps[data.originWorld]) return null;
  return {
    pending: true,
    originWorld: data.originWorld,
    originX: coordinate(data.originX, 1700),
    originY: coordinate(data.originY, 1740),
    deaths: Math.max(1, Math.min(999999, Math.floor(Number(data.deaths) || 1))),
  };
}

module.exports = function installAfterlife(Engine) {
  const addPlayer = Engine.prototype.addPlayer;
  const profile = Engine.prototype.profile;
  const damage = Engine.prototype.damage;
  const tick = Engine.prototype.tick;
  const interact = Engine.prototype.interact;
  const travel = Engine.prototype.travel;
  const orbit = Engine.prototype.orbit;
  const snapshot = Engine.prototype.snapshot;
  const sandboxCommand = Engine.prototype.sandboxCommand;
  const betaCommand = Engine.prototype.betaCommand;

  function rememberDeath(engine, p) {
    if (!p || p.state !== "dead") return;
    if (p.afterlife?.pending) {
      if (p.world === ARRIVAL.world) p.afterlife.deaths++;
      return;
    }
    p.afterlife = {
      pending: true,
      originWorld: engine.maps[p.world] ? p.world : "earth",
      originX: coordinate(p.x, 1700),
      originY: coordinate(p.y, 1740),
      deaths: 1,
    };
  }

  Engine.prototype.addPlayer = function (id, data = {}) {
    const p = addPlayer.call(this, id, data);
    p.afterlife = restore(data.afterlife, this.maps);
    if (p.afterlife?.pending) {
      p.world = ARRIVAL.world;
      p.x = Number.isFinite(data.x) && data.world === ARRIVAL.world
        ? coordinate(data.x, ARRIVAL.x) : ARRIVAL.x;
      p.y = Number.isFinite(data.y) && data.world === ARRIVAL.world
        ? coordinate(data.y, ARRIVAL.y) : ARRIVAL.y;
      p.ascent = false;
      p.altitude = 0;
      p.hp = p.maxHp;
    }
    return p;
  };

  Engine.prototype.profile = function (p) {
    return { ...profile.call(this, p), afterlife: p.afterlife?.pending ? { ...p.afterlife } : null };
  };

  Engine.prototype.damage = function (attacker, target, amount, heavy) {
    if (target?.afterlife?.pending && target.world === ARRIVAL.world &&
        Math.hypot(target.x - ARRIVAL.x, target.y - ARRIVAL.y) < 1100) return;
    const wasDead = target?.state === "dead";
    const result = damage.call(this, attacker, target, amount, heavy);
    if (!wasDead && this.players.has(target?.id) && !target.duelId && target.state === "dead")
      rememberDeath(this, target);
    return result;
  };

  Engine.prototype.tick = function (dt = 1 / 30) {
    const nextTime = this.time + dt;
    for (const p of this.players.values()) {
      if (p.state !== "dead" || p.duelId) continue;
      if (!p.afterlife?.pending) rememberDeath(this, p);
      if (nextTime < p.until) continue;
      p.world = ARRIVAL.world;
      p.x = ARRIVAL.x;
      p.y = ARRIVAL.y;
      p.vx = p.vy = 0;
      p.ascent = false;
      p.altitude = 0;
      p.destination = ARRIVAL.world;
      p.training = null;
    }
    const result = tick.call(this, dt);
    return result;
  };

  Engine.prototype.interact = function (id) {
    const p = this.players.get(id);
    if (!p?.afterlife?.pending) return interact.call(this, id);
    if (p.state === "dead") return "Aguarde sua chegada ao Outro Mundo.";
    if (p.world !== ENMA.world || Math.hypot(p.x - ENMA.x, p.y - ENMA.y) > ENMA.radius)
      return "Siga até o tribunal de Enma e peça permissão para voltar.";
    const origin = p.afterlife;
    p.afterlife = null;
    p.world = this.maps[origin.originWorld] ? origin.originWorld : "earth";
    p.x = origin.originX;
    p.y = origin.originY;
    p.vx = p.vy = 0;
    p.ascent = false;
    p.altitude = 0;
    p.mode = "flight";
    p.state = "glide";
    p.hp = p.maxHp;
    p.ki = p.maxKi;
    p.invuln = this.time + 8;
    p.lastTravel = this.time;
    p.lastHit = -99;
    p.input = { x: 0, y: 0, angle: p.angle };
    p.lastDialogue = {
      id: "enma-return",
      title: "Permissão para retornar",
      speaker: "Enma",
      skin: "enma",
      text: "Seu pedido foi aceito. Volte ao lugar da queda e continue sua jornada.",
    };
    this.emit("wish", p, { text: "RETORNO AUTORIZADO" });
    return p.lastDialogue.text;
  };

  Engine.prototype.travel = function (id, world) {
    if (this.players.get(id)?.afterlife?.pending) return false;
    return travel.call(this, id, world);
  };

  Engine.prototype.orbit = function (id) {
    if (this.players.get(id)?.afterlife?.pending) return false;
    return orbit.call(this, id);
  };
  Engine.prototype.sandboxCommand = function (id, data) {
    if (this.players.get(id)?.afterlife?.pending && data?.action !== "cancel")
      return { ok: false, message: "Peça permissão a Enma para retomar suas atividades." };
    return sandboxCommand.call(this, id, data);
  };
  Engine.prototype.betaCommand = function (id, data) {
    if (this.players.get(id)?.afterlife?.pending)
      return { ok: false, message: "Conclua sua passagem pelo Outro Mundo primeiro." };
    return betaCommand.call(this, id, data);
  };

  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id);
    s.self.afterlife = p.afterlife?.pending
      ? { pending: true, enmaX: ENMA.x, enmaY: ENMA.y,
          distance: Math.round(Math.hypot(p.x - ENMA.x, p.y - ENMA.y)) }
      : null;
    s.self.halo = !!p.afterlife?.pending;
    if (p.afterlife?.pending) {
      const guide = {
        questId: "afterlife", objectiveId: "enma-return", world: ENMA.world,
        targetX: ENMA.x, targetY: ENMA.y, radius: ENMA.radius,
        interactable: true, speaker: "Enma", skin: "enma", type: "talk",
        title: "Passagem pelo Outro Mundo", objective: "Encontre Enma e peça permissão para retornar.",
        text: "Encontre Enma e peça permissão para retornar.", progress: 0, required: 1,
      };
      s.self.guide = guide;
      s.self.storyObjective = guide;
      s.self.loreObjective = null;
    }
    for (const q of s.players)
      q.halo = !!this.players.get(q.id)?.afterlife?.pending;
    return s;
  };
};
