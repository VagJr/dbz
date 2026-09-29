"use strict";

const Living = require("../shared/living-npcs");
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nowSeconds = engine => typeof engine.livingNpcClock === "function"
  ? engine.livingNpcClock() : Date.now() / 1000;

function safeState(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  const bonds = {};
  for (const [id, raw] of Object.entries(source.bonds || {}).slice(0, 96)) {
    if (!Living.byId[id] || !raw || typeof raw !== "object") continue;
    bonds[id] = {
      trust: clamp(Math.floor(Number(raw.trust) || 0), 0, 100),
      lastTalkDay: clamp(Math.floor(Number(raw.lastTalkDay) || -1), -1, 1e9),
      lastTrainAt: clamp(Number(raw.lastTrainAt) || 0, 0, 1e12),
      trainDay: clamp(Math.floor(Number(raw.trainDay) || -1), -1, 1e9),
      trainAttempts: clamp(Math.floor(Number(raw.trainAttempts) || 0), 0, 3),
    };
  }
  const companion = Living.byId[source.companion]?.canFollow ? source.companion : null;
  return { bonds, companion };
}

function bond(player, id) {
  return player.livingNpcs.bonds[id] ||= {
    trust: 0, lastTalkDay: -1, lastTrainAt: 0, trainDay: -1, trainAttempts: 0,
  };
}

function familiarity(player, id) {
  // Kuririn recognizes experienced defenders, including those heading to Namek.
  if (id === "krillin")
    return (player.level >= 6 ? 12 : 0) + (player.visited?.includes("namek") ? 15 : 0);
  if (["goku", "gohan", "piccolo", "dende"].includes(id))
    return player.visited?.includes("namek") ? 8 : 0;
  return 0;
}

function storyActor(engine, player) {
  const guide = engine.activeGuide?.(player);
  if (!guide?.skin || !guide.interactable || !Number.isFinite(guide.targetX) ||
      guide.world !== player.world || player.afterlife?.pending) return null;
  const npcId = guide.skin === "roshi" ? "roshi" : guide.skin;
  const identity = Living.byId[npcId];
  if (!identity) return null;
  return { id: "npc:" + npcId, characterId: npcId, name: guide.speaker,
    skin: guide.skin, role: identity.role, canFollow: false, canSpar: identity.canSpar,
    world: guide.world, x: guide.targetX, y: guide.targetY, angle: -Math.PI / 2,
    state: "idle", activity: "social", scripted: true };
}

function companionOwner(engine, npcId) {
  for (const p of engine.players.values())
    if (p.livingNpcs?.companion === npcId) return p;
  return null;
}

function viewFor(player, npcId, clock, engine) {
  const npc = Living.byId[npcId];
  if (!npc) return null;
  const owner = companionOwner(engine, npcId);
  if (owner) {
    const angle = owner.angle || 0;
    return {
      ...Living.derive(npcId, clock, { siteResolver: engine.livingNpcSiteResolver }),
      world: owner.world,
      x: Math.round(owner.x - Math.cos(angle) * 112 + Math.sin(angle) * 58),
      y: Math.round(owner.y - Math.sin(angle) * 112 - Math.cos(angle) * 58),
      angle,
      activity: "accompany",
      state: owner.state === "dead" ? "idle" : owner.mode === "flight" ? "fly" :
        Math.hypot(owner.vx, owner.vy) > 5 ? "run" : "idle",
      destination: owner.world,
      companion: true,
      companionOwner: owner.id,
    };
  }
  const scripted = storyActor(engine, player);
  if (scripted?.characterId === npcId) return scripted;
  const response = engine.livingNpcResponseActor?.(npcId);
  if (response) return response;
  return Living.derive(npcId, clock, { siteResolver: engine.livingNpcSiteResolver });
}

function nearest(engine, player, clock, radius = 170) {
  const options = { radius: Math.max(radius, 200), siteResolver: engine.livingNpcSiteResolver };
  const actors = Living.visible(player.world, player.x, player.y, clock, options)
    .filter(actor => !companionOwner(engine, actor.characterId) &&
      !engine.livingNpcResponseActor?.(actor.characterId));
  actors.push(...(engine.livingNpcResponseActors?.(player.world, player.x, player.y, radius) || []));
  const companion = player.livingNpcs.companion;
  if (companion) actors.push(viewFor(player, companion, clock, engine));
  const scripted = storyActor(engine, player);
  if (scripted) {
    const old = actors.findIndex(actor => actor.characterId === scripted.characterId);
    if (old >= 0) actors.splice(old, 1);
    actors.push(scripted);
  }
  let best = null, bestDistance = radius;
  for (const actor of actors) {
    if (actor.world !== player.world) continue;
    const range = distance(actor, player);
    if (range < bestDistance) { best = actor; bestDistance = range; }
  }
  return best;
}

module.exports = function installLivingNpcs(Engine) {
  if (Engine.prototype._livingNpcsInstalled) return;
  Object.defineProperty(Engine.prototype, "_livingNpcsInstalled", { value: true });
  const addPlayer = Engine.prototype.addPlayer;
  const profile = Engine.prototype.profile;
  const snapshot = Engine.prototype.snapshot;
  const interact = Engine.prototype.interact;
  const damage = Engine.prototype.damage;
  const act = Engine.prototype.act;
  const tick = Engine.prototype.tick;

  Engine.prototype.addPlayer = function (id, saved = {}) {
    const player = addPlayer.call(this, id, saved);
    player.livingNpcs = safeState(saved.livingNpcs);
    if (player.livingNpcs.companion && [...this.players.values()].some(p =>
        p.id !== player.id && p.livingNpcs?.companion === player.livingNpcs.companion))
      player.livingNpcs.companion = null;
    player.livingNpcAssistAt = -99;
    return player;
  };

  Engine.prototype.profile = function (player) {
    const base = profile.call(this, player);
    const state = player.livingNpcs || safeState();
    return { ...base, livingNpcs: {
      companion: state.companion,
      bonds: Object.fromEntries(Object.entries(state.bonds).map(([id, value]) => [id, { ...value }])),
    } };
  };

  Engine.prototype.snapshot = function (id) {
    const out = snapshot.call(this, id);
    if (!out) return out;
    const player = this.players.get(id);
    if (!player) return out;
    const clock = nowSeconds(this);
    const actors = Living.visible(player.world, player.x, player.y, clock, {
      radius: 1450, siteResolver: this.livingNpcSiteResolver,
    }).filter(actor => !companionOwner(this, actor.characterId) &&
      !this.livingNpcResponseActor?.(actor.characterId));
    actors.push(...(this.livingNpcResponseActors?.(player.world, player.x, player.y) || []));
    const companion = player.livingNpcs.companion;
    for (const owner of this.players.values()) {
      const npcId = owner.livingNpcs?.companion;
      if (!npcId) continue;
      const actor = viewFor(player, npcId, clock, this);
      if (actor.world === player.world && distance(actor, player) < 1450) actors.push(actor);
    }
    const scripted = storyActor(this, player);
    if (scripted && distance(scripted, player) < 1450) {
      const old = actors.findIndex(actor => actor.characterId === scripted.characterId);
      if (old >= 0) actors.splice(old, 1);
      actors.push(scripted);
    }
    const merged = new Map((out.npcs || []).map(actor => [actor.id, actor]));
    for (const actor of actors) {
      const key = actor.characterId === "kingkai" && merged.has("npc:kai") ? "npc:kai" : actor.id;
      const prior = merged.get(key);
      const scriptedPosition = prior?.scripted && !actor.companion
        ? { world: prior.world, x: prior.x, y: prior.y } : null;
      merged.set(key, prior ? { ...prior, ...actor, ...scriptedPosition,
        id: key, role: prior.role || actor.role } : actor);
    }
    out.npcs = [...merged.values()];
    out.self.npcCompanion = companion ? { id: companion, name: Living.byId[companion].name } : null;
    out.self.npcBonds = Object.fromEntries(Object.entries(player.livingNpcs.bonds)
      .map(([npcId, value]) => [npcId, clamp(value.trust + familiarity(player, npcId), 0, 100)]));
    return out;
  };

  Engine.prototype.livingNpcAction = function (playerId, npcId, action = "talk") {
    const player = this.players.get(playerId);
    const npc = Living.byId[npcId];
    if (!player || !npc) return "Personagem indisponível.";
    if (player.state === "dead" || player.afterlife?.pending) return "Conclua sua passagem pelo Outro Mundo.";
    if (action === "release") {
      if (player.livingNpcs.companion !== npcId) return "Esse personagem não está acompanhando você.";
      player.livingNpcs.companion = null;
      return npc.name + " se despede e volta à própria jornada.";
    }
    const clock = nowSeconds(this);
    const scripted = storyActor(this, player);
    const actor = scripted?.characterId === npcId ? scripted : viewFor(player, npcId, clock, this);
    if (actor.world !== player.world || distance(actor, player) > 185)
      return "Aproxime-se de " + npc.name + " para conversar.";
    const state = bond(player, npcId);
    const day = Math.floor(clock / Living.DAY_SECONDS);
    if (action === "talk") {
      if (state.lastTalkDay !== day) {
        state.lastTalkDay = day;
        state.trust = clamp(state.trust + (npc.role === "villain" ? 1 : 5), 0, 100);
      }
      if (actor.scripted) return interact.call(this, playerId);
      const extra = npc.id === "enma" ? " O julgamento de retorno exige autorização." :
        npc.canFollow && state.trust + familiarity(player, npcId) >= 25 ? " Pode convidá-lo para acompanhar sua viagem." : "";
      return npc.name + ": " + npc.dialogue + extra;
    }
    if (action === "follow") {
      if (!npc.canFollow) return npc.name + " mantém os próprios compromissos.";
      if (state.trust + familiarity(player, npcId) < 25)
        return "Construa confiança com " + npc.name + " antes de pedir companhia.";
      if (player.livingNpcs.companion && player.livingNpcs.companion !== npcId)
        return "Despeça-se do acompanhante atual antes de convidar outro.";
      const owner = companionOwner(this, npcId);
      if (owner && owner.id !== player.id) return npc.name + " já acompanha outro viajante.";
      if (actor.scripted) return npc.name + " precisa concluir este encontro primeiro.";
      player.livingNpcs.companion = npcId;
      return npc.name + " aceita viajar e apoiar você.";
    }
    if (action === "train") {
      if (!npc.canSpar || npc.role === "villain") return npc.name + " não oferece combate amistoso.";
      if (["sleep", "eat", "travel"].includes(actor.activity))
        return npc.name + " está ocupado agora. Volte durante o período de treino.";
      if (state.trust + familiarity(player, npcId) < 5)
        return "Converse com " + npc.name + " antes de treinar juntos.";
      if (state.trainDay !== day) { state.trainDay = day; state.trainAttempts = 0; }
      if (state.trainAttempts >= 3) return "Treinos diários com " + npc.name + " concluídos.";
      if (clock - state.lastTrainAt < 240) return "Espere alguns minutos antes de outro treino.";
      if (this.enemies.some(enemy => enemy.npcLifeSpar && enemy.practiceOwner === player.id && !enemy.dead))
        return "Conclua seu treino atual primeiro.";
      if (this.enemies.some(enemy => enemy.npcLifeSpar && enemy.npcLifeId === npcId && !enemy.dead))
        return npc.name + " está treinando com outro guerreiro.";
      state.trainAttempts++;
      state.lastTrainAt = clock;
      const maxHp = clamp(Math.round(player.maxHp * 0.85), 120, 1800);
      this.spawn(player.world, npc.name + " · treino", npc.skin,
        actor.x + 135, actor.y + 25, false, {
          hp: maxHp, maxHp, level: player.level,
          practiceOwner: player.id, npcLifeSpar: true, npcLifeId: npcId,
          npcLifeStartedAt: this.time, nonRespawn: true,
        });
      this.emit("notice", player, { text: "TREINO AMISTOSO · " + npc.name, playerId: player.id });
      return "Treino amistoso com " + npc.name + " iniciado. A luta termina sem morte.";
    }
    return "Ação desconhecida.";
  };

  Engine.prototype.interact = function (id) {
    const player = this.players.get(id);
    if (!player || player.afterlife?.pending || player.state === "dead") return interact.call(this, id);
    const map = this.maps[player.world];
    if (map?.mentor && distance(map.mentor, player) < 145) return interact.call(this, id);
    const nearby = nearest(this, player, nowSeconds(this), 155);
    if (!nearby) return interact.call(this, id);
    if (nearby.scripted) {
      const old = interact.call(this, id);
      const state = bond(player, nearby.characterId);
      const day = Math.floor(nowSeconds(this) / Living.DAY_SECONDS);
      if (state.lastTalkDay !== day) { state.lastTalkDay = day; state.trust = clamp(state.trust + 5, 0, 100); }
      return old;
    }
    return this.livingNpcAction(id, nearby.characterId, "talk");
  };

  Engine.prototype.damage = function (attacker, target, amount, heavy) {
    const wasAlive = !!target?.npcLifeSpar && !target.dead;
    const result = damage.call(this, attacker, target, amount, heavy);
    if (attacker?.npcLifeSpar && attacker.practiceOwner === target?.id &&
        target.state === "dead") {
      // A friendly spar ends at knockout, before the afterlife wrapper observes it.
      target.hp = Math.max(1, Math.round(target.maxHp * 0.6));
      target.state = "idle";
      target.stun = target.until = 0;
      target.invuln = this.time + 3;
      target.moveAction = null;
      target.input = { x: 0, y: 0, angle: target.angle };
      attacker.dead = true;
      attacker.npcLifeRewarded = true;
      this.emit("notice", target, { text: "TREINO ENCERRADO · TENTE OUTRO RITMO", playerId: target.id });
    }
    if (wasAlive && target.dead && !target.npcLifeRewarded) {
      target.npcLifeRewarded = true;
      const owner = this.players.get(target.practiceOwner);
      if (owner) {
        const state = bond(owner, target.npcLifeId);
        state.trust = clamp(state.trust + 4, 0, 100);
        this.reward(owner, clamp(25 + owner.level * 4, 25, 115));
        this.emit("complete", owner, { text: "TREINO CONCLUÍDO · " + Living.byId[target.npcLifeId].name,
          playerId: owner.id });
      }
    }
    return result;
  };

  Engine.prototype.act = function (id, name) {
    const result = act.call(this, id, name);
    const player = this.players.get(id);
    const npcId = player?.livingNpcs?.companion;
    if (!npcId || !["attack", "blast"].includes(name) || player.state === "dead" ||
        this.time - player.livingNpcAssistAt < 8 || result === false) return result;
    let target = null, best = 460;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.practiceOwner || enemy.world !== player.world) continue;
      const d = distance(enemy, player);
      if (d < best) { target = enemy; best = d; }
    }
    if (target) {
      player.livingNpcAssistAt = this.time;
      this.damage(player, target, clamp(8 + player.level * 2, 8, 40), false);
      this.emit("notice", target, { text: Living.byId[npcId].name + " AJUDOU", playerId: player.id });
    }
    return result;
  };

  Engine.prototype.tick = function (dt) {
    const result = tick.call(this, dt);
    if (this.time >= (this._livingNpcCleanupAt || 0)) {
      this._livingNpcCleanupAt = this.time + 30;
      this.enemies = this.enemies.filter(enemy => !enemy.npcLifeSpar ||
        (!enemy.dead && this.players.has(enemy.practiceOwner) &&
          this.players.get(enemy.practiceOwner).world === enemy.world &&
          this.time - enemy.npcLifeStartedAt < 300));
    }
    return result;
  };
};

module.exports.safeState = safeState;
