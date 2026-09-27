"use strict";

const Content = require("../shared/quests");
const Lore = require("../shared/lore");
const OpenWorld = require("../shared/open-world");
const { TECHNIQUES } = require("../shared/content");

const ROOT_QUEST = Content.SAGAS["dragon-ball"].firstQuest;
const ITEM_IDS = new Set(["pilafIntel", "redRibbonIntel", "namekDragonBall", "namekDragonBalls"]);
const FLAG_IDS = new Set([
  "cell_saga_complete", "buu_saga_complete", "pilaf_expedition_stopped", "red_ribbon_defeated", "earth_dragonball_complete",
  "kaio_training_complete", "saiyan_saga_complete", "namek_potential_unlocked",
  "ginyu_force_defeated", "frieza_defeated", "namek_saga_complete",
]);
const LANDMARKS = Content.LANDMARK_BY_ID;
const QUESTS = Content.QUEST_BY_ID;
const BOSSES = Content.BOSSES;
const profiles = Content.ENEMY_PROFILES;
const defaultWorld = { androids:"earth", buu:"earth", "dragon-ball": "earth", saiyan: "earth", namek: "namek" };
const dialogue = {
  bulma: "Bulma: O rastreador captou uma trilha irregular. Veja onde ela termina.",
  kameHouse: "Mestre Kame: Primeiro controle seu ritmo; a força vem com disciplina.",
  babaArena: "Baba: A próxima prova exige atenção aos movimentos do adversário.",
  namekVillage: "Dende: As patrulhas avançam pelo vale. Podemos levar os feridos pelas encostas, mas precisamos que você abra uma passagem.",
  namekElder: "Dende: O Patriarca pede que protejamos nosso povo. As esferas podem devolver esperança; não podemos entregá-las a quem só deseja dominar.",
};

function boundedList(value, allowed, max = 96) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && allowed.has(item)))].slice(-max);
}

function initialState(saved, lore = {}) {
  const old = saved && typeof saved === "object" && saved.version === 1;
  const completed = boundedList(saved?.completedQuests, new Set(QUESTS.keys()));
  const rewards = boundedList(saved?.rewardsClaimed, new Set(QUESTS.keys()));
  let questId = old && (saved.questId === null || QUESTS.has(saved.questId)) ? saved.questId : ROOT_QUEST;
  if (!old) questId = ROOT_QUEST;
  if(old&&questId===null&&completed.includes("namek-escape")&&!completed.includes("android-warning"))questId="android-warning";
  const completedSet = new Set(completed);
  let hops = 0;
  while (questId && completedSet.has(questId) && hops++ < QUESTS.size) questId = QUESTS.get(questId)?.next || null;
  let q = questId ? QUESTS.get(questId) : null;
  const objectiveIndex = q ? Math.max(0, Math.min(q.objectives.length, Math.floor(Number(saved?.objectiveIndex) || 0))) : 0;
  const objective = q?.objectives[objectiveIndex];
  const sequenceIndex = objective?.type === "sequence"
    ? Math.max(0, Math.min(Math.max(0, objective.steps.length - 1), Math.floor(Number(saved?.sequenceIndex) || 0)))
    : 0;
  const items = {};
  for (const key of ITEM_IDS) {
    const n = Math.floor(Number(saved?.items?.[key]) || 0);
    if (n > 0) items[key] = Math.min(999, n);
  }
  const collectedItems = boundedList(saved?.collectedItems, Content.COLLECTIBLE_IDS, 64);
  const bosses = {};
  if (saved?.bosses && typeof saved.bosses === "object") {
    for (const id of Object.keys(BOSSES)) {
      const n = Math.floor(Number(saved.bosses[id]));
      if (Number.isFinite(n) && n >= 0) bosses[id] = Math.min(BOSSES[id].phases.length - 1, n);
    }
  }
  const leaf = objective?.type === "sequence" ? objective.steps[sequenceIndex] : objective;
  const progressLimit = leaf ? Math.max(1, Math.floor(Number(leaf.count || leaf.required) || 1)) : 0;
  return {
    version: 1,
    saga: q?.saga || (old && saved.saga in Content.SAGAS ? saved.saga : "dragon-ball"),
    questId,
    objectiveIndex,
    sequenceIndex,
    progress: Math.max(0, Math.min(progressLimit, Math.floor(Number(saved?.progress) || 0))),
    completedQuests: completed,
    rewardsClaimed: rewards,
    flags: boundedList(saved?.flags, FLAG_IDS),
    items,
    collectedItems,
    bosses,
    objectiveStartedAt: 0,
    migration: old ? "v1" : "legacy-profile",
  };
}

function questFor(p) {
  return p?.storyState?.questId ? QUESTS.get(p.storyState.questId) || null : null;
}

function currentObjective(p) {
  const q = questFor(p), state = p?.storyState;
  if (!q || !state) return null;
  const parent = q.objectives[state.objectiveIndex];
  if (!parent) return null;
  if (parent.type === "sequence") {
    const step = parent.steps[state.sequenceIndex];
    return step ? { ...step, sequenceParent: parent, parentId: parent.id } : null;
  }
  return parent;
}

function markerFor(objective) {
  if (objective?.target && LANDMARKS.has(objective.target)) return LANDMARKS.get(objective.target);
  const spawnAt = objective?.encounter?.spawnAt;
  return spawnAt && LANDMARKS.has(spawnAt) ? LANDMARKS.get(spawnAt) : null;
}

function objectiveWorld(p, q, objective) {
  if (objective?.world) return objective.world;
  const marker = markerFor(objective);
  if (marker) return marker.world;
  if (["loreCheckpoint", "loreBubbles"].includes(objective?.type)) return "otherworld";
  if (objective?.type === "train" && objective.loreId) return Lore.sites.find((site) => site.id === objective.loreId)?.world || defaultWorld[q.saga];
  if (objective?.type === "travel" && objective.target === "space") return "space";
  if (objective?.type === "travel" && objective.target) return objective.target;
  return defaultWorld[q.saga] || "earth";
}

function objectiveSummary(p) {
  const q = questFor(p), o = currentObjective(p), s = p?.storyState;
  if (!q || !o || !s) return q ? { saga: q.saga, questId: q.id, title: q.title, text: "Capítulo concluído.", progress: 0, required: 0, complete: true } : null;
  let required = Math.max(1, Number(o.count || o.required || (o.sequenceParent ? o.sequenceParent.steps.length : 1)) || 1);
  const marker = markerFor(o);
  const collectible = o.type === "collect" ? (o.collectibles || (o.target ? [o.target] : [])).map((id) => LANDMARKS.get(id)).find((m) => m && !s.collectedItems.includes(m.id)) : null;
  const point = collectible || marker;
  let progress = s.progress;
  if (o.sequenceParent) progress = s.sequenceIndex;
  if (o.type === "bossPhase") progress = (s.bosses[o.bossId] || 0) >= o.phaseIndex ? 1 : 0;
  if (o.type === "train" && o.loreId && p.lore?.done?.includes(o.loreId)) progress = 1;
  return {
    saga: q.saga,
    sagaTitle: Content.SAGAS[q.saga]?.title || q.saga,
    questId: q.id,
    title: q.title,
    description: q.description,
    objectiveId: o.id,
    type: o.type,
    objective: o.text,
    text: o.text,
    progress: Math.max(0, Math.min(required, progress)),
    required,
    world: objectiveWorld(p, q, o),
    targetX: point?.x,
    targetY: point?.y,
  };
}

function addUnique(list, id) {
  if (!list.includes(id)) list.push(id);
}

module.exports = Engine => {
  const addPlayer = Engine.prototype.addPlayer;
  const profile = Engine.prototype.profile;
  const snapshot = Engine.prototype.snapshot;
  const tick = Engine.prototype.tick;
  const damage = Engine.prototype.damage;
  const interact = Engine.prototype.interact;
  const travel = Engine.prototype.travel;
  const chapter = Engine.prototype.chapter;

  Engine.prototype.addPlayer = function(id, data = {}) {
    const p = addPlayer.call(this, id, data);
    p.storyState = initialState(data.storyState, p.lore);
    p.storyState.objectiveStartedAt = this.time;
    p.lastStoryCheck = -1;
    this.storyEncounterRuntime ||= new Map();
    if (!data.storyState) this.emit("complete", p, { text: "NOVA JORNADA · " + (QUESTS.get(p.storyState.questId)?.title || "Aventura da Terra"), playerId: p.id });
    return p;
  };

  Engine.prototype.profile = function(p) {
    const saved = profile.call(this, p);
    saved.storyState = JSON.parse(JSON.stringify(p.storyState));
    return saved;
  };

  Engine.prototype.storyObjective = function(p) { return objectiveSummary(p); };

  Engine.prototype.snapshot = function(id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id);
    s.self.storyObjective = objectiveSummary(p);
    s.self.dialogue=p.lastDialogue||null;
    s.self.storyItems = { ...(p.storyState?.items || {}) };
    s.enemies = s.enemies.map(enemy => {
      if (!enemy.storyEncounter) return enemy;
      const { storyEncounter, storyQuestId, storyObjectiveId, storyEncounterKey, storyBossId, storyPhaseIndex, storyParticipants, ai, ...publicEnemy } = enemy;
      return publicEnemy;
    });
    return s;
  };

  Engine.prototype.chapter = function(p) {
    // Keep the original chapter API for the legacy campaigns and old clients.
    return chapter.call(this, p);
  };

  Engine.prototype.storyCurrent = currentObjective;

  Engine.prototype.storyNotify = function(p, text, type = "orb") {
    if (p && text) this.emit(type, p, { text: String(text).slice(0, 180), playerId: p.id });
  };

  Engine.prototype.storyAdvanceObjective = function(p, text) {
    const q = questFor(p), state = p?.storyState, o = currentObjective(p);
    if (!q || !state || !o) return false;
    if (o.sequenceParent) {
      state.sequenceIndex++;
      state.progress = 0;
      if (state.sequenceIndex < o.sequenceParent.steps.length) {
        state.objectiveStartedAt = this.time;
        this.storyNotify(p, text || o.sequenceParent.text + " · " + state.sequenceIndex + "/" + o.sequenceParent.steps.length);
        return true;
      }
      state.sequenceIndex = 0;
    }
    state.objectiveIndex++;
    state.progress = 0;
    state.sequenceIndex = 0;
    state.objectiveStartedAt = this.time;
    if (state.objectiveIndex < q.objectives.length) {
      const next = currentObjective(p);
      this.storyNotify(p, text || "OBJETIVO · " + (next?.text || "prossima etapa"));
      return true;
    }
    this.storyCompleteQuest(p, q);
    return true;
  };

  Engine.prototype.storyReward = function(p, q) {
    const state = p.storyState, r = q.rewards || {};
    if (state.rewardsClaimed.includes(q.id)) return false;
    state.rewardsClaimed.push(q.id);
    if (r.xp > 0) this.reward(p, Math.floor(r.xp));
    if (r.zenni > 0) p.zenni += Math.floor(r.zenni);
    if (r.power && /^\d{1,200}$/.test(String(r.power))) {
      const maximum = 10n ** 200n - 1n;
      const combined = BigInt(p.power) + BigInt(r.power);
      p.power = (combined > maximum ? maximum : combined).toString();
    }
    if (r.points > 0) p.points += Math.floor(r.points);
    for (const [id, amount] of Object.entries(r.items || {})) {
      if (!ITEM_IDS.has(id)) continue;
      state.items[id] = Math.min(999, (state.items[id] || 0) + Math.max(0, Math.floor(amount)));
    }
    for (const id of r.techniques || []) if (TECHNIQUES.some(t => t.id === id) && !p.techniques.includes(id)) p.techniques.push(id);
    for (const flag of r.flags || []) if (FLAG_IDS.has(flag)) addUnique(state.flags, flag);
    if (r.restore) { p.hp = p.maxHp; p.ki = p.maxKi; }
    return true;
  };

  Engine.prototype.storyCompleteQuest = function(p, q) {
    const state = p?.storyState;
    if (!state || state.questId !== q.id) return false;
    addUnique(state.completedQuests, q.id);
    const rewarded = this.storyReward(p, q);
    state.saga = q.saga;
    state.objectiveIndex = 0;
    state.sequenceIndex = 0;
    state.progress = 0;
    const next = q.next && QUESTS.get(q.next);
    if (next && (!next.prerequisites || next.prerequisites.every(flag => state.flags.includes(flag)))) {
      state.questId = next.id;
      state.saga = next.saga;
      state.objectiveStartedAt = this.time;
      this.storyNotify(p, "CAPÍTULO CONCLUÍDO · " + q.title + " · NOVA MISSÃO: " + next.title, "complete");
    } else {
      state.questId = null;
      this.storyNotify(p, "SAGA CONCLUÍDA · " + q.title, "complete");
    }
    return rewarded;
  };

  Engine.prototype.storyProgress = function(p, amount = 1, text) {
    const o = currentObjective(p), state = p?.storyState;
    if (!o || !state) return false;
    const required = Math.max(1, Math.floor(Number(o.count || o.required) || 1));
    state.progress = Math.min(required, state.progress + Math.max(1, Math.floor(amount)));
    if (state.progress >= required) return this.storyAdvanceObjective(p, text || o.text);
    this.storyNotify(p, (text || o.text) + " · " + state.progress + "/" + required);
    return true;
  };

  Engine.prototype.storySetBossPhase = function(enemy, index, contributors) {
    const boss = BOSSES[enemy.storyBossId];
    if (!boss) return;
    let next = Math.max(0, enemy.storyPhaseIndex ?? 0);
    const ratio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 0;
    while (next + 1 < boss.phases.length && ratio <= boss.phases[next + 1].hpThreshold) next++;
    if (index != null) next = Math.max(next, Math.min(boss.phases.length - 1, index));
    if (next <= (enemy.storyPhaseIndex ?? 0) && !enemy.dead) return;
    const first = enemy.storyPhaseIndex == null || enemy.storyPhaseIndex < 0;
    enemy.storyPhaseIndex = next;
    const phase = boss.phases[next];
    const base = profiles[phase.profile || boss.profile] || profiles.balanced;
    enemy.ai = { ...base };
    enemy.combatStyle = base.archetype;
    enemy.damage = boss.damage * (base.damageMultiplier || 1);
    if (!first) {
      const text = boss.name.toUpperCase() + " · " + phase.name;
      this.emit("transform", enemy, { text });
      for (const player of contributors) {
        if (!this.storyParticipantEligible(player, enemy)) continue;
        player.storyState.bosses[boss.id] = Math.max(player.storyState.bosses[boss.id] || 0, next);
        this.storyNotify(player, text, "transform");
        let o = currentObjective(player), guard = 0;
        while (o?.type === "bossPhase" && o.bossId === boss.id && o.phaseIndex <= next && guard++ < 8) {
          this.storyProgress(player, 1, o.text);
          o = currentObjective(player);
        }
      }
    }
  };

  Engine.prototype.storyParticipantEligible = function(p, enemy) {
    const range = p ? Math.hypot(p.x - enemy.x, p.y - enemy.y) : Infinity;
    if (!p || p.world !== enemy.world || range > 850) return false;
    const q = questFor(p), o = currentObjective(p);
    if (!q || q.id !== enemy.storyQuestId || !o || objectiveWorld(p, q, o) !== enemy.world) return false;
    const sameBoss = enemy.storyBossId && ["boss", "bossPhase"].includes(o.type) && o.bossId === enemy.storyBossId;
    const sameWave = !enemy.storyBossId && o.id === enemy.storyObjectiveId && ["kill", "killCount", "defeatWave"].includes(o.type);
    if (!sameBoss && !sameWave) return false;
    const participants = this.storyEncounterRuntime?.get(enemy.storyEncounterKey)?.participants;
    return !!(enemy.storyParticipants?.has(p.id) || participants?.has(p.id) || range <= 320);
  };

  Engine.prototype.storyDeath = function(enemy) {
    const runtime = this.storyEncounterRuntime;
    if (runtime && enemy.storyEncounterKey) runtime.set(enemy.storyEncounterKey, { ...(runtime.get(enemy.storyEncounterKey) || {}), cooldownUntil: this.time + (enemy.storyQuestId === "db-paozu" ? 2 : 10) });
    const participants = [...this.players.values()].filter(p => this.storyParticipantEligible(p, enemy));
    if (enemy.storyBossId) {
      const bossId = enemy.storyBossId;
      for (const p of participants) {
        let o = currentObjective(p), guard = 0;
        while (o?.type === "bossPhase" && o.bossId === bossId && guard++ < 8) {
          p.storyState.bosses[bossId] = Math.max(p.storyState.bosses[bossId] || 0, enemy.storyPhaseIndex || 0);
          this.storyProgress(p, 1, o.text);
          o = currentObjective(p);
        }
        if (o?.type === "boss" && o.bossId === bossId) this.storyProgress(p, 1, o.text);
      }
      return;
    }
    for (const p of participants) {
      const o = currentObjective(p);
      if (!o || p.storyState.questId !== enemy.storyQuestId || o.id !== enemy.storyObjectiveId) continue;
      if (!["kill", "killCount", "defeatWave"].includes(o.type)) continue;
      if (o.target && o.target !== enemy.storyTarget && o.target !== enemy.storyWaveId) continue;
      this.storyProgress(p, 1, o.text);
    }
  };

  Engine.prototype.damage = function(attacker, target, amount, heavy = false) {
    const wasDead = !!target?.dead;
    const oldHp = Number(target?.hp);
    damage.call(this, attacker, target, amount, heavy);
    if (!target?.storyEncounter || wasDead || !(target.hp < oldHp)) return;
    if (attacker && this.players.has(attacker.id)) {
      target.storyParticipants ||= new Set();
      target.storyParticipants.add(attacker.id);
      const runtime = this.storyEncounterRuntime?.get(target.storyEncounterKey);
      if (runtime) { runtime.participants ||= new Set(); runtime.participants.add(attacker.id); }
    }
    if (target.storyBossId) this.storySetBossPhase(target, null, [...this.players.values()].filter(p => this.storyParticipantEligible(p, target)));
    if (target.dead) this.storyDeath(target);
  };

  Engine.prototype.storyEnsureEncounter = function(p, q, o) {
    const encounter = o?.encounter;
    if (!encounter || !p || p.state === "dead") return;
    const place = LANDMARKS.get(encounter.spawnAt);
    if (!place || p.world !== place.world || Math.hypot(p.x - place.x, p.y - place.y) > 1700) return;
    const key = encounter.kind === "boss" ? q.id + ":boss:" + encounter.bossId : q.id + ":objective:" + o.id;
    this.storyEncounterRuntime ||= new Map();
    const prior = this.storyEncounterRuntime.get(key);
    if (prior?.enemies?.some(e => !e.dead) || (!prior?.enemies && this.enemies.some(e => e.storyEncounterKey === key && !e.dead))) return;
    if (prior?.cooldownUntil > this.time) return;
    if (encounter.kind === "boss") {
      const def = BOSSES[encounter.bossId];
      if (!def) return;
      const enemy = this.spawn(place.world, def.name, def.skin, place.x + 230, place.y + 70, true, {
        hp: def.hp, maxHp: def.hp, damage: def.damage, rewardXP: 0,
        storyEncounter: true, storyQuestId: q.id, storyObjectiveId: o.id,
        storyEncounterKey: key, storyBossId: def.id, storyPhaseIndex: -1,
        storyParticipants: new Set(), ai: { ...(profiles[def.profile] || profiles.balanced) },
        storyRespawnAt: null,
      });
      enemy.storyPhaseIndex = -1;
      this.storySetBossPhase(enemy, 0, []);
      this.storyEncounterRuntime.set(key, { enemyId: enemy.id, enemies: [enemy], cooldownUntil: 0 });
      this.storyNotify(p, "ENCONTRO · " + def.name.toUpperCase(), "complete");
      return;
    }
    if (encounter.kind !== "wave") return;
    const enemies = encounter.enemies || [];
    let index = 0;
    const spawned = [];
    for (const group of enemies) {
      for (let n = 0; n < (q.id==='db-paozu'?1:Math.max(1, Math.min(10, Math.floor(group.count || 1)))); n++) {
        const angle = index * 2.399;
        const radius = 240 + Math.floor(index / 6) * 75;
        const hp = Math.max(65, Math.min(500, Math.floor(group.hp || 170 + (group.level || 1) * 25)));
        const enemy = this.spawn(place.world, group.name, group.skin, place.x + Math.cos(angle) * radius, place.y + Math.sin(angle) * radius, false, {
          hp, maxHp: hp, level: Math.max(1, Math.floor(group.level || 1)), damage: group.damage || 16,
          storyEncounter: true, storyQuestId: q.id, storyObjectiveId: o.id,
          storyEncounterKey: key, storyWaveId: o.target || o.id, storyTarget: o.target || o.id,
          storyParticipants: new Set(), ai: { ...(profiles[group.profile] || profiles.aggressive) }, rewardXP: 0,
        });
        spawned.push(enemy);
                index++;
      }
    }
    this.storyEncounterRuntime.set(key, { enemyIds: index, enemies: spawned, defeated:prior?.defeated||0,cooldownUntil: 0 });
    for(const e of spawned)e.cooldown=this.time+(q.id==='db-paozu'?2:1);
    this.storyNotify(p, "AMEAÇA · " + o.text, "complete");
  };

  Engine.prototype.storyCondition = function(p, q, o) {
    const state = p.storyState, world = objectiveWorld(p, q, o);
    if (o.type === "reach" || o.type === "returnTo") {
      const marker = markerFor(o);
      return !!marker && p.world === marker.world && Math.hypot(p.x - marker.x, p.y - marker.y) <= (o.radius || marker.radius);
    }
    if (o.type === "visitRegion") {
      if (p.world !== world) return false;
      const region = OpenWorld.region(p.world, p.x, p.y);
      return region.name === o.target || region.name.startsWith(String(o.target) + " ·") || region.name.startsWith(String(o.target) + " ");
    }
    if (o.type === "travel") {
      if (o.target === "space") return p.world === "space" && (!o.from || p.surface?.world === o.from || state.flags.includes("frieza_defeated"));
      return p.world === o.target && p.visited.includes(o.target) || p.visited.includes(o.target) && o.allowPreviouslyVisited !== false;
    }
    if (o.type === "train") return !!o.loreId && p.lore?.done?.includes(o.loreId);
    if (o.type === "loreBubbles") return p.world === "otherworld" && !!p.lore?.bubbles;
    if (o.type === "loreCheckpoint") return p.world === "otherworld" && (p.lore?.snake || 0) >= o.checkpoint;
    if (o.type === "survive") {const marker=markerFor(o);const inside=p.world===world&&(!marker||Math.hypot(p.x-marker.x,p.y-marker.y)<=(o.radius||marker.radius));if(!inside){state.objectiveStartedAt=this.time;return false;}return this.time-state.objectiveStartedAt>=Math.max(1,Number(o.seconds)||1);}
    return false;
  };

  Engine.prototype.storyAutoProgress = function(p) {
    let count = 0;
    while (p?.storyState?.questId && count++ < 32) {
      const q = questFor(p), o = currentObjective(p);
      if (!q || !o || !this.storyCondition(p, q, o)) break;
      if (o.type === "sequence") break;
      if (o.type === "bossPhase" || o.type === "boss" || o.type === "kill" || o.type === "killCount" || o.type === "defeatWave" || o.type === "collect" || o.type === "talk" || o.type === "interact") break;
      if (o.type === "sequence") break;
      this.storyAdvanceObjective(p, o.text);
    }
  };

  Engine.prototype.storyTick = function(p) {
    if (!p || p.state === "dead" || !p.storyState) return;
    if (this.time - p.lastStoryCheck < 0.45) return;
    p.lastStoryCheck = this.time;
    p.region = OpenWorld.region(p.world, p.x, p.y);
    this.storyAutoProgress(p);
    const q = questFor(p), o = currentObjective(p);
    if (!q || !o) return;
    if (o.type === "sequence") {
      const step = currentObjective(p);
      if (step && this.storyCondition(p, q, step)) this.storyAdvanceObjective(p, step.text);
    } else if (["reach", "returnTo", "visitRegion", "travel", "train", "loreBubbles", "loreCheckpoint", "survive"].includes(o.type) && this.storyCondition(p, q, o)) {
      this.storyAdvanceObjective(p, o.text);
    }
    const nextQ = questFor(p), nextO = currentObjective(p);
    if (nextQ && nextO) this.storyEnsureEncounter(p, nextQ, nextO);
  };

  Engine.prototype.storyInteract = function(p) {
    const q = questFor(p), o = currentObjective(p);
    if (!q || !o || p.state === "dead") return null;
    const marker = markerFor(o);
    if (["talk", "interact"].includes(o.type) && marker && p.world === marker.world && Math.hypot(p.x - marker.x, p.y - marker.y) <= (o.radius || marker.radius)) {
      const text = o.reply || dialogue[o.target] || (o.target==='capsuleLab'?'Bulma: Os sinais mudaram. Encontre a origem, proteja as rotas de saída e volte quando a área estiver segura.':q.description);
      const skin=o.target==='bulma'||o.target==='capsuleLab'?'bulma':o.target==='kameHouse'?'roshi':o.target.startsWith('namek')?'dende':p.skin;
      const split=text.indexOf(':');
      p.lastDialogue={id:q.id+':'+o.id+':'+this.time,title:q.title,skin,speaker:split>0?text.slice(0,split):'Registro de missão',text:split>0?text.slice(split+1).trim():text};
      this.storyAdvanceObjective(p, o.text);
      return text;
    }
    if (o.type === "collect") {
      const ids = o.collectibles || (o.target ? [o.target] : []);
      for (const id of ids) {
        const item = LANDMARKS.get(id);
        if (!item || p.world !== item.world || p.storyState.collectedItems.includes(id) || Math.hypot(p.x - item.x, p.y - item.y) > (o.radius || item.radius)) continue;
        addUnique(p.storyState.collectedItems, id);
        const itemId = item.item || o.item;
        if (ITEM_IDS.has(itemId)) {
          p.storyState.items[itemId] = Math.min(999, (p.storyState.items[itemId] || 0) + 1);
          if (itemId === "namekDragonBall") p.storyState.items.namekDragonBalls = p.storyState.items.namekDragonBall;
        }
        const msg = itemId === "namekDragonBall" ? "ESFERA NAMEKUSEIJIN · " + p.storyState.items.namekDragonBalls + "/7" : "INFORMAÇÃO RECUPERADA · " + p.storyState.items[itemId];
        this.storyProgress(p, 1, msg);
        return msg;
      }
    }
    return null;
  };

  Engine.prototype.interact = function(id) {
    const p = this.players.get(id);
    if (p) {
      const result = this.storyInteract(p);
      if (result) return result;
    }
    return interact.call(this, id);
  };

  Engine.prototype.tick = function(dt = 1 / 30) {
    for (const enemy of this.enemies) {
      if (enemy.storyBossId && !enemy.dead) {
        const def = BOSSES[enemy.storyBossId];
        const phase = def?.phases[Math.max(0, enemy.storyPhaseIndex || 0)];
        const ai = profiles[phase?.profile || def?.profile] || profiles.balanced;
        enemy.ai = { ...ai };
        enemy.combatStyle = ai.archetype;
        enemy.damage = def.damage * ai.damageMultiplier;
      }
    }
    tick.call(this, dt);
    for (const p of this.players.values()) this.storyTick(p);
  };

  Engine.prototype.travel = function(id, world) {
    const result = travel.call(this, id, world);
    if (result) {
      const p = this.players.get(id);
      if (p) this.storyTick(p);
    }
    return result;
  };

};
