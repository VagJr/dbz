"use strict";
const {
  WORLDS,
  ORIGINS,
  CAMPAIGNS,
  SIZE,
  worldData,
  TECHNIQUES,
  getWorld,
} = require("../shared/content");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const Movement = require("../shared/movement");
const cleanName = (v) =>
  typeof v === "string"
    ? v
        .replace(/[<>\u0000-\u001f]/g, "")
        .trim()
        .slice(0, 20)
    : "";
const EnemyTactics = require("./enemy-tactics");
const CombatBrain = require("./combat-brain");
const EnemyMotor = require("./enemy-motor");
class Engine {
  constructor() {
    this.time = 0;
    this.players = new Map();
    this.enemies = [];
    this.shots = [];
    this.effects = [];
    this.serial = 0;
    this.maps = Object.fromEntries(WORLDS.map((w) => [w.id, worldData(w.id)]));
    this.maps.space = worldData("space");
    this.eventAt = 90;
    this.event = null;
    // Stream encounters from world compositions; story encounters own the protected arrival area.
  }
  spawn(world, name, skin, x, y, boss = false, extra = {}) {
    const e = {
      id: `e${++this.serial}`,
      world,
      name,
      skin,
      x,
      y,
      homeX: x,
      homeY: y,
      hp: boss ? 640 : 120,
      maxHp: boss ? 640 : 120,
      boss,
      angle: 0,
      state: "idle",
      until: 0,
      attackAt: 0,
      cooldown: this.time + 1,
      stun: 0,
      dead: false,
      ai: EnemyTactics.identity(skin, this.serial, world),
      ...extra,
    };
    e.combatStyle = e.ai?.archetype || "brawler";
    this.enemies.push(e);
    return e;
  }
  addPlayer(id, profile = {}) {
    const o = ORIGINS.find((o) => o.id === profile.origin) || ORIGINS[0];
    const p = {
      id,
      name: cleanName(profile.name) || "Guerreiro",
      origin: o.id,
      skin: o.skin,
      world:
        profile.world === "space" ||
        WORLDS.some((w) => w.id === profile.world) ||
        /^rift:[0-9]{1,18}$/.test(profile.world || "")
          ? profile.world
          : "earth",
      x: Number.isFinite(profile.x) ? clamp(profile.x, -1e8, 1e8) : 1700,
      y: Number.isFinite(profile.y) ? clamp(profile.y, -1e8, 1e8) : 1740,
      altitude: profile.world === "space" ? 1 : 0,
      ascent: false,
      destination:
        typeof profile.destination === "string" ? profile.destination : "earth",
      vx: 0,
      vy: 0,
      mode: "flight",
      boosting: false,
      hp: o.hp,
      maxHp: o.hp,
      ki: 100,
      maxKi: 100,
      level: Math.max(1, Math.floor(Number(profile.level) || 1)),
      xp: Math.max(0, Number(profile.xp) || 0),
      zenni: Math.max(0, Number(profile.zenni) || 0),
      angle: 0,
      state: "idle",
      input: { x: 0, y: 0, angle: 0 },
      inputAt: 0,
      until: 0,
      stun: 0,
      invuln: 0,
      combo: 0,
      comboAt: -10,
      cooldowns: { attack: 0, blast: 0, dash: 0, form: 0 },
      guardAt: -10,
      chargeAt: null,
      lastHit: -10,
      form: false,
      formUntil: 0,
      focus: 0,
      pvp: false,
      kills: 0,
      progress:
        profile.progress && typeof profile.progress === "object"
          ? profile.progress
          : {},
      campaign: CAMPAIGNS.some((c) => c.id === profile.campaign)
        ? profile.campaign
        : "db",
      questPhase: 0,
      questKills: 0,
      orbs: Array.isArray(profile.orbs)
        ? [
            ...new Set(
              profile.orbs.filter(
                (n) => Number.isInteger(n) && n >= 1 && n <= 7,
              ),
            ),
          ]
        : [],
      wishCount: Number(profile.wishCount) || 0,
      visited: Array.isArray(profile.visited)
        ? profile.visited.filter(
            (v) =>
              WORLDS.some((w) => w.id === v) || /^rift:[0-9]{1,18}$/.test(v),
          )
        : ["earth"],
      lastTravel: -10,
    };
    p.power = /^\d{1,200}$/.test(String(profile.power))
      ? String(profile.power)
      : "500";
    if (p.world.startsWith("rift:") && !this.maps[p.world]) {
      this.maps[p.world] = worldData(p.world);
      const world = getWorld(p.world);
      for (let i = 0; i < 12; i++)
        this.spawn(
          p.world,
          world.enemy,
          world.enemySkin,
          1700 + Math.cos(i) * 700,
          1700 + Math.sin(i) * 700,
        );
    }
    p.stats = { force: 0, spirit: 0, vitality: 0, ...profile.stats };
    p.points = Math.max(0, Number(profile.points) || 0);
    p.techniques = Array.isArray(profile.techniques)
      ? profile.techniques.filter((id) => TECHNIQUES.some((t) => t.id === id))
      : ["ki"];
    if (!p.techniques.includes("ki")) p.techniques.push("ki");
    p.equipped =
      profile.equipped !== "teleport" && p.techniques.includes(profile.equipped)
        ? profile.equipped
        : "ki";
    p.mastery = profile.mastery || {};
    p.training = null;
    p.maxHp += (p.level - 1) * 12 + p.stats.vitality * 18;
    p.hp = p.maxHp;
    this.players.set(id, p);
    return p;
  }
  profile(p) {
    return Object.fromEntries(
      [
        "name",
        "origin",
        "world",
        "x",
        "y",
        "destination",
        "level",
        "xp",
        "zenni",
        "progress",
        "campaign",
        "orbs",
        "wishCount",
        "visited",
        "power",
        "stats",
        "points",
        "techniques",
        "equipped",
        "mastery",
      ].map((k) => [k, p[k]]),
    );
  }
  emit(type, e, extra = {}) {
    this.effects.push({
      id: ++this.serial,
      type,
      world: e.world,
      x: e.x,
      y: e.y,
      skin: e.skin,
      appearance: e.appearance,
      name: e.name,
      ...extra,
    });
  }
  input(id, data) {
    const p = this.players.get(id);
    if (!p || !data || typeof data !== "object") return;
    let x = Number(data.x),
      y = Number(data.y),
      angle = Number(data.angle);
    if (![x, y, angle].every(Number.isFinite)) return;
    const n = Math.max(1, Math.hypot(x, y));
    if (data.guard === true && !p.input.guard) {
      p.guardPressedAt =
        this.time >= (p.nextPerfectGuard || 0) ? this.time : -99;
      p.nextPerfectGuard = this.time + 0.6;
    }
    p.input = {
      x: x / n,
      y: y / n,
      angle: angleDiff(angle, 0),
      guard: data.guard === true,
      charge: data.charge === true,
      boost: data.boost === true,
      manualAim:data.manualAim===true,
    };
    p.inputAt = this.time;
    p.aimReceived = true;
  }
  chapter(p) {
    const c = CAMPAIGNS.find((c) => c.id === p.campaign) || CAMPAIGNS[0];
    return (
      c.chapters[
        clamp(Math.floor(Number(p.progress[c.id]) || 0), 0, c.chapters.length)
      ] || null
    );
  }
  target(p, range) {
    return this.enemies
      .concat(
        [...this.players.values()].filter(
          (q) => p.pvp && q.pvp && q.id !== p.id,
        ),
      )
      .filter(
        (e) =>
          e.world === p.world &&
          !e.dead &&
          e.state !== "dead" &&
          distance(e, p) < range,
      )
      .sort(
        (a, b) =>
          distance(a, p) +
          Math.abs(angleDiff(Math.atan2(a.y - p.y, a.x - p.x), p.angle)) * 65 -
          (distance(b, p) +
            Math.abs(angleDiff(Math.atan2(b.y - p.y, b.x - p.x), p.angle)) *
              65),
      )[0];
  }
  act(id, action) {
    const p = this.players.get(id),
      t = this.time;
    if (!p || p.state === "dead" || p.stun > t) return false;
    if (action === "flight") return this.toggleFlight(id);
    if (action === "orbit") return this.orbit(id);
    if (action === "cancelCharge") {
      p.chargeAt = null;
      return true;
    }
    if (p.training && action === "attack") {
      const delta = Math.abs(t - p.training.beat);
      if (delta < 0.2) {
        p.training.hits++;
        this.reward(p, 12);
        p.power = (BigInt(p.power) + 25n).toString();
        this.emit("parry", p, { text: "BOM TIMING +25 BP" });
      } else {
        this.emit("break", p, { text: "BUSQUE O RITMO" });
      }
      p.training.beat = t + 1.4;
      p.training.attempts++;
      if (p.training.attempts >= 8) p.training = null;
      return true;
    }
    if (action === "blastStart") {
      if (p.chargeAt === null) {
        p.chargeAt = t;
        this.emit("chargeStart", p);
      }
      return true;
    }
    if (action === "form") {
      if (p.focus < 100 || p.cooldowns.form > t) return false;
      p.focus = 0;
      p.form = true;
      p.formUntil = t + 15;
      p.cooldowns.form = t + 20;
      this.emit("transform", p, {
        text: ORIGINS.find((o) => o.id === p.origin).form,
      });
      return true;
    }
    if (
      !["attack", "blast", "dash"].includes(action) ||
      p.cooldowns[action] > t
    )
      return false;
    if (action === "dash") {
      if (p.ki < 14) return false;
      p.ki -= 14;
      p.invuln = t + 0.22;
      p.cooldowns.dash = t + 0.75;
      p.state = "dash";
      p.until = t + 0.16;
      const a =
        Math.hypot(p.input.x, p.input.y) > 0.1
          ? Math.atan2(p.input.y, p.input.x)
          : p.angle;
      this.emit("dash", p, { angle: a });
      const dashSpeed = p.mode === "flight" ? 1450 : 600;
      p.vx = Math.cos(a) * dashSpeed;
      p.vy = Math.sin(a) * dashSpeed;
      return true;
    }
    if (action === "attack") {
      if (p.state === "guard") return false;
      const target = this.target(p, p.heavyStrike ? 360 : 280);
      p.combo = t - p.comboAt < 0.7 ? (p.combo % 3) + 1 : 1;
      p.comboAt = t;
      p.cooldowns.attack =
        t + (p.heavyStrike ? 0.62 : p.combo === 3 ? 0.5 : 0.28);
      p.state = "attack";
      p.until = t + 0.2;
      if (target) {
        p.angle = Math.atan2(target.y - p.y, target.x - p.x);
        const d = distance(p, target);
        if (d > 52)
          this.move(
            p,
            Math.cos(p.angle) * Math.min(260, d - 52),
            Math.sin(p.angle) * Math.min(260, d - 52),
          );
        if (p.mode === "flight") {
          p.vx += Math.cos(p.angle) * 380;
          p.vy += Math.sin(p.angle) * 380;
        }
      }
      this.emit("slash", p, { angle: p.angle, combo: p.combo });
      if (target && distance(p, target) < 115 && this.clearSight(p, target)) {
        const counter = p.counterUntil > t ? 1.7 : 1;
        p.counterUntil = 0;
        this.damage(
          p,
          target,
          (p.heavyStrike ? 62 : p.combo === 3 ? 38 : 22) *
            (p.form ? 1.4 : 1) *
            counter +
            (p.level - 1) * 1.2 +
            p.stats.force * 2,
          p.combo === 3 || p.heavyStrike,
        );
        p.focus = clamp(p.focus + 6, 0, 100);
        p.ki = clamp(p.ki + 4, 0, 100);
      }
      return true;
    }
    const charge = p.chargeAt === null ? 0 : clamp(t - p.chargeAt, 0, 1.2);
    p.chargeAt = null;
    const charged = charge >= 0.45,
      technique = TECHNIQUES.find((k) => k.id === p.equipped) || TECHNIQUES[0],
      cost =
        (charged ? 35 : 16) *
        (p.origin === "earthling" ? 0.75 : 1) *
        (technique.id === "galick" ? 1.3 : 1);
    if (p.ki < cost) return false;
    p.ki -= cost;
    p.cooldowns.blast = t + (charged ? 1 : 0.35);
    p.state = "blast";
    p.until = t + 0.25;
    const target = this.target(p, 620);
    if (target) p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    this.shots.push({
      id: `s${++this.serial}`,
      owner: p.id,
      world: p.world,
      mode: p.mode,
      originX: p.x,
      originY: p.y,
      x: p.x,
      y: p.y,
      angle: p.angle,
      speed:
        technique.id === "genki"
          ? 360
          : technique.id === "divine"
            ? 1100
            : technique.id === "makan"
              ? 1650
              : charged
                ? 1560
                : 1050,
      r: technique.id === "genki" ? 42 : charged ? 19 : 8,
      damage:
        ((charged ? 95 : 25) * (p.form ? 1.4 : 1) +
          p.level * 2 +
          p.stats.spirit * 3) *
        technique.multiplier *
        (1 + Math.min(0.3, (p.mastery[p.equipped] || 0) / 1000)),
      life: technique.id === "genki" ? 1.6 : charged ? 1.35 : 0.95,
      pierce: charged || technique.id === "makan",
      hits: [],
      skin: p.skin,
      technique: technique.id,
    });
    p.mastery[p.equipped] = (p.mastery[p.equipped] || 0) + 1;
    this.emit("cast", p, {
      angle: p.angle,
      charged,
      technique: technique.id,
      techniqueName: technique.name,
    });
    return true;
  }
  onGround(p) {
    return p.world !== "space";
  }
  toggleFlight(id) {
    const p = this.players.get(id);
    if (!p || p.state === "dead") return false;
    if (p.world === "space") return this.enterPlanet(id);
    p.ascent = false;
    if (p.mode === "flight") {
      if (!this.onGround(p)) {
        this.emit("notice", p, { text: "POUSE NUMA ILHA OU ARENA" });
        return false;
      }
      p.mode = "ground";
      p.vx *= 0.18;
      p.vy *= 0.18;
      this.emit("land", p, { text: "POUSO" });
    } else {
      p.mode = "flight";
      p.vx += Math.cos(p.angle) * 240;
      p.vy += Math.sin(p.angle) * 240;
      this.emit("takeoff", p, { text: "VOO LIVRE" });
    }
    return true;
  }
  move(e, dx, dy) {
    let x = clamp(e.x + dx, -1e8, 1e8),
      y = clamp(e.y + dy, -1e8, 1e8);
    for (const b of e.mode === "ground" ? this.maps[e.world].buildings : []) {
      if (Math.abs(x - b.x) < 70 && Math.abs(y - b.y) < 60) {
        if (Math.abs(e.x - b.x) >= 70) x = e.x;
        else y = e.y;
      }
    }
    e.x = x;
    e.y = y;
  }
  onboardingProtected(p, enemy) {
    return p.world === "earth" && p.storyState?.questId === "db-paozu" &&
      (enemy.cell || enemy.ambient && (p.storyState.objectiveIndex || 0) < 3) &&
      !enemy.practiceOwner && enemy.provokedBy !== p.id;
  }
  damage(attacker, target, amount, heavy = false) {
    if (
      (target.practiceOwner && attacker.id !== target.practiceOwner) ||
      (attacker.practiceOwner && target.id !== attacker.practiceOwner)
    )
      return;
    if (attacker.practiceOwner)
      amount = Math.min(amount, Math.max(0, target.hp - 1));
    if (target.dead || target.state === "dead" || target.invuln > this.time)
      return;
    const t = this.time,
      isPlayer = this.players.has(target.id);
    if (!isPlayer && this.players.has(attacker.id)) {
      // The fighter remembers actual contact; choices still wait for observations.
      target.recentPressure = t - (target.pressureHitAt ?? -99) < 1.1
        ? Math.min(3, (target.recentPressure || 0) + 1) : 1;
      target.pressureHitAt = t;
      const facing = Math.abs(angleDiff(
        Math.atan2(attacker.y - target.y, attacker.x - target.x),
        target.angle || 0,
      )) < 1.25;
      if (target.state === "evade" && target.until > t) {
        this.emit("dodge", target, { text: "ESQUIVA" });
        return;
      }
      if (target.state === "guard" && target.guardUntil > t && facing &&
          (target.guardMeter ?? 0) > 0) {
        const perfect = t - (target.guardAt || -99) < 0.14 && !heavy;
        const drain = heavy ? 42 : 21;
        target.guardMeter = Math.max(0, target.guardMeter - drain);
        target.effort = Math.max(0, (target.effort ?? 100) - (heavy ? 13 : 7));
        if (perfect) {
          target.counterReadyUntil = t + 0.7;
          target.guardUntil = t;
          target.cooldown = Math.min(target.cooldown || t, t);
          target.nextOpening = Math.min(target.nextOpening || t, t);
          this.emit("parry", target, { text: "CONTRA!" });
          return;
        }
        if (!target.guardMeter) {
          target.guardBrokenUntil = t + 1.15;
          target.guardUntil = t;
          target.stun = t + 0.4;
          this.emit("break", target, { text: "GUARDA QUEBRADA" });
        } else {
          amount *= heavy ? 0.42 : 0.16;
          this.emit("guard", target, { text: "BLOQUEIO" });
        }
      }
    }
    if (isPlayer) {
      target.lastHit = t;
      target.training = null;
      const facing =
        Math.abs(
          angleDiff(
            Math.atan2(attacker.y - target.y, attacker.x - target.x),
            target.angle,
          ),
        ) < 1.4;
      if (target.state === "guard" && facing && target.ki > 0) {
        if (t - target.guardAt <= 0.133) {
          target.counterUntil = t + 0.75;
          target.ki = Math.max(0, target.ki - 8);
          target.focus = clamp(target.focus + 20, 0, 100);
          target.lastParryAt = t;
          if (!attacker.projectile) attacker.stun = t + 0.65;
          this.emit("parry", target, { text: "PERFEITO" });
          return;
        }
        target.ki =
          attacker.heavyStrike || attacker.guardBreak
            ? 0
            : Math.max(0, target.ki - (heavy ? 42 : 18));
        amount *= 0.2;
        if (!target.ki) {
          target.stun = t + 0.7;
          this.emit("break", target, { text: "GUARDA QUEBRADA" });
        }
      }
    }
    target.hp = Math.max(0, target.hp - amount);
    target.stun = Math.max(target.stun || 0, t + (heavy ? 0.2 : 0.075));
    this.emit("hit", target, {
      amount: Math.round(amount),
      heavy,
      combo: attacker.combo || attacker.motorMove?.stage || 0,
      projectile: !!attacker.projectile,
      technique: attacker.technique,
    });
    if (heavy) {
      const a = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      this.move(target, Math.cos(a) * 50, Math.sin(a) * 50);
    }
    if (target.hp > 0) return;
    if (isPlayer) {
      target.state = "dead";
      target.until = t + 3;
      target.input = { x: 0, y: 0, angle: 0 };
      target.form = false;
      this.emit("down", target);
      return;
    }
    target.dead = true;
    target.respawnAt = t + 18;
    if (target.practiceOwner) return;
    this.onEnemyDefeated?.(attacker, target);
    if (this.players.has(attacker.id)) {
      const kiReward = target.boss
        ? 12
        : Math.min(8, 4 + Math.floor((target.maxHp || 0) / 500));
      attacker.ki = clamp(attacker.ki + kiReward, 0, 100);
      const hpReward = Math.max(
        1,
        Math.round((attacker.maxHp || 100) * (target.boss ? 0.04 : 0.02)),
      );
      attacker.hp = Math.min(attacker.maxHp || 100, attacker.hp + hpReward);
    }
    if (target.ecologyKey) {
      this.worldMemory ??= {};
      this.worldMemory[target.ecologyKey] = {
        defeatedUntil: Date.now() + 18000,
        defeats: (this.worldMemory[target.ecologyKey]?.defeats || 0) + 1,
      };
    }
    for (const p of this.players.values()) {
      if (target.storyEncounter) {
        if (
          target.storyParticipants?.has(p.id) &&
          p.world === target.world &&
          distance(p, target) <= 850
        )
          p.kills++;
        continue;
      }
      if (p.world !== target.world || distance(p, target) > 850) continue;
      this.reward(p, target.rewardXP ?? (target.boss ? 100 : 28));
      p.kills++;
      const c = this.chapter(p);
      if (c && p.world === c.world && p.questPhase === 1 && !target.boss) {
        p.questKills++;
        if (p.questKills >= 3) {
          p.questPhase = 2;
          this.ensureBoss(p);
        }
      }
      if (c && p.questPhase === 2 && target.chapterId === c.id) {
        p.progress[p.campaign] = (Number(p.progress[p.campaign]) || 0) + 1;
        p.questPhase = 0;
        p.questKills = 0;
        this.reward(p, c.reward);
        this.emit("complete", p, {
          text: "CAPÍTULO CONCLUÍDO",
          playerId: p.id,
        });
      }
    }
    if (target.event && this.event) {
      this.event = null;
      this.eventAt = t + 180;
    }
  }
  reward(p, xp) {
    p.xp += xp;
    p.power = (BigInt(p.power) + BigInt(Math.ceil(xp * 2))).toString();
    p.zenni += Math.ceil(xp / 2);
    while (p.xp >= p.level * 130) {
      p.xp -= p.level * 130;
      p.level++;
      p.points += 3;
      p.maxHp += 12;
      p.hp = p.maxHp;
      this.emit("level", p, { text: `NÍVEL ${p.level}` });
    }
  }
  ensureBoss(p) {
    const c = this.chapter(p);
    if (!c) return;
    let boss = this.enemies.find((e) => e.chapterId === c.id && !e.dead);
    if (!boss) {
      const a = this.maps[c.world].arena;
      boss = this.spawn(c.world, c.boss, c.skin, a.x, a.y, true, {
        chapterId: c.id,
        hp: 550 + c.index * 80,
        maxHp: 550 + c.index * 80,
      });
    }
    return boss;
  }
  interact(id) {
    const p = this.players.get(id);
    if (p?.world === "space")
      return "Aproxime-se de um planeta e use F para entrar na atmosfera.";
    if (!p || p.state === "dead") return "Aguarde para retornar.";
    const map = this.maps[p.world];
    if (
      p.world === "earth" &&
      p.orbs.length === 7 &&
      distance(p, map.spawn) < 180
    ) {
      p.orbs = [];
      p.wishCount++;
      this.reward(p, 700);
      this.emit("wish", p, { text: "SEU DESEJO FOI ATENDIDO" });
      return "Shenlong concedeu 700 XP. As esferas se espalharam novamente.";
    }
    if (distance(p, map.mentor) < 135) {
      p.hp = p.maxHp;
      p.ki = 100;
      const c = this.chapter(p);
      if (!c) return "Esta campanha foi concluída. Escolha outra nas Crônicas.";
      if (c.world !== p.world)
        return `Seu próximo encontro está em ${this.maps[c.world].world.name}. Abra o atlas.`;
      if (p.questPhase === 0) {
        p.questPhase = 1;
        p.questKills = 0;
        return `${c.story} Derrote 3 patrulheiros e enfrente ${c.boss}.`;
      }
      return p.questPhase === 1
        ? `Derrote os patrulheiros: ${p.questKills}/3.`
        : `${c.boss} aguarda na clareira a nordeste.`;
    }
    if (p.world === "earth") {
      const orb = map.orbs.find(
        (o) => !p.orbs.includes(o.id) && distance(p, o) < 95,
      );
      if (orb) {
        p.orbs.push(orb.id);
        this.emit("orb", p, { text: `ESFERA ${orb.id} / 7` });
        return "Esfera encontrada!";
      }
    }
    return "Aproxime-se de um mestre ou de uma esfera. Use o radar.";
  }
  travel(id, world) {
    const p = this.players.get(id);
    if (
      typeof world !== "string" ||
      (!this.maps[world] && !/^rift:[0-9]{1,18}$/.test(world))
    )
      return false;
    if (!this.maps[world]) {
      if (Object.keys(this.maps).length >= 32) {
        const unused = Object.keys(this.maps).find(
          (id) =>
            id.startsWith("rift:") &&
            ![...this.players.values()].some((q) => q.world === id),
        );
        if (!unused) return false;
        delete this.maps[unused];
        this.enemies = this.enemies.filter((e) => e.world !== unused);
      }
      this.maps[world] = worldData(world);
      const w = getWorld(world);
      for (let i = 0; i < 12; i++)
        this.spawn(
          world,
          w.enemy,
          w.enemySkin,
          1700 + Math.cos(i) * 700,
          1700 + Math.sin(i) * 700,
        );
    }
    if (
      !p ||
      p.state === "dead" ||
      this.time - p.lastHit < 4 ||
      this.time - p.lastTravel < 2
    )
      return false;
    p.training = null;
    p.ascent = false;
    p.altitude = 0;
    p.world = world;
    p.x = 1700;
    p.y = 1740;
    p.vx = 0;
    p.vy = 0;
    p.mode = "flight";
    p.lastTravel = this.time;
    p.input = { x: 0, y: 0, angle: 0 };
    p.chargeAt = null;
    if (!p.visited.includes(world)) {
      p.visited.push(world);
      this.reward(p, 60);
    }
    if (p.questPhase === 2) this.ensureBoss(p);
    return true;
  }
  campaign(id, campaign) {
    const p = this.players.get(id);
    if (
      !p ||
      !CAMPAIGNS.some((c) => c.id === campaign) ||
      this.time - p.lastHit < 4 ||
      p.state === "dead"
    )
      return false;
    p.campaign = campaign;
    p.questPhase = 0;
    p.questKills = 0;
    return true;
  }
  tick(dt = 1 / 30) {
    this.time += dt;
    const t = this.time;
    for (const p of this.players.values()) {
      if (p.state === "dead") {
        if (t >= p.until) {
          p.hp = p.maxHp;
          p.ki = 100;
          p.x = 1700;
          p.y = 1740;
          p.vx = 0;
          p.vy = 0;
          p.mode = "flight";
          p.state = "glide";
          p.invuln = t + 2;
        }
        continue;
      }
      if (p.clashId) {
        p.state = "clash";
        p.vx = p.vy = 0;
        continue;
      }
      if (p.training && t > p.training.beat + 0.4) {
        p.training.attempts++;
        p.training.beat = t + 1.4;
        if (p.training.attempts >= 8) p.training = null;
      }
      if (p.form && t > p.formUntil) p.form = false;
      const stale = t - p.inputAt > 0.25;
      if (stale) {
        p.input = { x: 0, y: 0, angle: p.angle };
        p.chargeAt = null;
        p.meleeAt = null;
      }
      this.navigationTick(p, dt);
      if (p.stun > t) {
        p.state = "stun";
        continue;
      }
      const input = p.input,
        locked =
          !!p.moveAction ||
          p.roundLocked ||
          (p.until > t && ["attack", "blast", "dash"].includes(p.state));
      p.boosting = p.mode === "flight" && input.boost && p.ki > 0;
      if (!locked) {
        p.angle = input.angle;
        if (input.guard && p.ki > 1) {
          if (p.state !== "guard") p.guardAt = p.guardPressedAt ?? -99;
          p.state = "guard";
          p.ki = Math.max(0, p.ki - dt * 7);
        } else if (input.charge) {
          p.state = "charge";
          p.ki = Math.min(
            100,
            p.ki + dt * (t - (p.lastCombatAt || 0) < 4 ? 24 : 38),
          );
        } else if (p.meleeAt != null) {
          p.state = "meleeCharge";
        } else if (p.chargeAt !== null) {
          p.state = "chargeAim";
        } else {
          p.state =
            Math.hypot(input.x, input.y) > 0.1
              ? p.mode === "flight"
                ? "fly"
                : "run"
              : p.mode === "flight"
                ? "glide"
                : "idle";
        }
      }
      if (p.training && Math.hypot(input.x, input.y) > 0.2) p.training = null;
      Movement.velocity(p, input, dt, t,
        ORIGINS.find((o) => o.id === p.origin).speed, stale);
      if (p.boosting) p.ki = Math.max(0, p.ki - dt * 16);
      this.move(p, p.vx * dt, p.vy * dt);
      if (p.mode === "ground" && !this.onGround(p)) {
        p.mode = "flight";
        this.emit("takeoff", p, { text: "VOO LIVRE" });
      }
      if (!p.moveAction && !input.guard && !input.charge && p.stun <= t)
        p.ki = clamp(
          p.ki + dt * (t - (p.lastCombatAt ?? -99) < 5 ? 2 : 5),
          0,
          100,
        );
      if (!p.duelId && t - Math.max(p.lastHit, p.lastCombatAt ?? -99) > 12)
        p.hp = Math.min(p.maxHp, p.hp + dt * (p.origin === "majin" ? 15 : 7));
    }
    if (!this.nextExploration || t >= this.nextExploration) {
      this.nextExploration = t + 1;
      this.explorationTick();
    }
    for (const e of this.enemies) {
      if (e.dead) {
        if (
          !e.chapterId &&
          !e.event &&
          !e.storyEncounter &&
          !e.nonRespawn &&
          t > e.respawnAt
        ) {
          e.dead = false;
          e.hp = e.maxHp;
          e.returning = false;
          e.guardUntil = 0;
          e.recoveryUntil = 0;
          e.attackCount = 0;
          e.brain = null;
          e.motorMove = null;
          e.confirmedHits = 0;
          e.chainUntil = 0;
          e.recentPressure = 0;
          e.pressureHitAt = -99;
          e.nextOpening = 0;
          e.nextGuard = 0;
          e.nextEvade = 0;
          e.effort = 100;
          e.guardMeter = 70;
          e.counterReadyUntil = 0;
          e.pressureUntil = 0;
          e.x = e.homeX;
          e.y = e.homeY;
          e.state = "idle";
        }
        continue;
      }
      if (e.clashId) {
        e.state = "clash";
        continue;
      }
      CombatBrain.maintain(e, dt);
      const priorTarget = this.players.get(e.combatTargetId);
      let target = null, nearest = Infinity;
      const aggro = e.world === "space" ? 1100 : e.ai?.aggroRange || (e.boss ? 650 : 390);
      for (const p of this.players.values()) {
        // Early exploration is peaceful; deliberately attacking still provokes.
        if (this.onboardingProtected(p,e) || p.duelId ||
          (e.practiceOwner && e.practiceOwner !== p.id) || p.world !== e.world || p.state === "dead") continue;
        const d = distance(p,e), score = d - (p === priorTarget ? 140 : 0);
        if (d < aggro && score < nearest) { target=p;nearest=score; }
      }
      e.combatTargetId = target?.id || null;
      const visible = !!target && this.clearSight(e, target);
      CombatBrain.observe(e, target, t, visible);
      if (e.stun > t) {
        e.state = "stun";
        continue;
      }
      // A patrol cannot chase a player indefinitely or fire through a reset.
      if (
        !e.storyEncounter &&
        !e.boss &&
        Math.hypot(e.x - e.homeX, e.y - e.homeY) > 1100
      )
        e.returning = true;
      if (e.returning) {
        e.state = "return";
        e.guardUntil = 0;
        e.observedThreatAt = null;
        e.pressureUntil = 0;
        const hx = e.homeX - e.x,
          hy = e.homeY - e.y,
          hd = Math.hypot(hx, hy);
        if (hd < 65) {
          e.returning = false;
          e.hp = e.maxHp;
          e.cooldown = t + 1;
        } else
          this.tacticalStep(
            e,
            { x: e.homeX, y: e.homeY },
            { x: hx / hd, y: hy / hd },
            dt,
            260,
          );
        continue;
      }
      if (e.state === "evade" && e.until > t) {
        this.tacticalStep(
          e,
          target || e,
          { x: Math.cos(e.evadeAngle), y: Math.sin(e.evadeAngle) },
          dt,
          e.world === "space" ? 1350 : 500,
        );
        continue;
      }
      if (e.state === "windup") {
        if (t >= e.attackAt) {
          const m =
            e.motorMove ||
            (e.motorMove = EnemyMotor.prepare(e, e.windupAt || t));
          e.state = "attack";
          e.until = t + m.active;
          e.recoveryUntil = e.until + m.recovery;
          e.cooldown = e.nextOpening = e.recoveryUntil;
          const impactAt = e.attackAt,
            attackAngle = e.angle,
            pattern = e.pattern;
          const attackRange = e.telegraphRadius || e.ai?.meleeRange || 125;
          const resolve = () => {
            this.emit("enemyAttack", e, {
              angle: attackAngle,
              radius: attackRange,
              pattern,
              projectile: pattern === "beam",
              counter: !!e.counterStrike,
              combo: m.stage,
            });
            if (pattern === "beam") {
              const speed = e.world === "space" ? 1400 : 760;
              this.shots.push({
                id: "s" + ++this.serial,
                owner: e.id,
                hostile: true,
                world: e.world,
                mode: e.mode,
                originX: e.x,
                originY: e.y,
                x: e.x,
                y: e.y,
                angle: attackAngle,
                speed,
                r: 14,
                damage: (e.damage || 24) * (m.charged ? 1.6 : 1),
                life: attackRange / speed,
                charged: !!m.charged,
                initialAngle: attackAngle,
                steerUntil: 0,
                pierce: !!m.charged,
                hits: [],
                technique: "hostile",
                skin: e.skin,
              });
              e.pressureUntil = t + attackRange / speed;
              EnemyMotor.finish(e, t, false);
              return;
            }
            // A short physical step closes contact; aim stays locked from startup.
            this.move(
              e,
              Math.cos(attackAngle) * 14,
              Math.sin(attackAngle) * 14,
            );
            let hit = false;
            e.attackData = { stun: m.stun, posture: m.heavy ? 30 : 12 };
            for (const p of this.players.values()) {
              if (
                p.world !== e.world ||
                p.state === "dead" ||
                !this.clearSight(e, p)
              )
                continue;
              const d = distance(p, e),
                a = Math.abs(
                  angleDiff(Math.atan2(p.y - e.y, p.x - e.x), attackAngle),
                );
              if (
                d < attackRange &&
                (pattern === "ring" || a < (pattern === "rush" ? 0.55 : 0.85))
              ) {
                const hp = p.hp,
                  guarded =
                    p.state === "guard" &&
                    Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - p.angle) > 0.35;
                this.damage(
                  e,
                  p,
                  (e.damage || (e.boss ? 48 : 18)) *
                    (e.counterStrike ? 1.15 : 1) *
                    (m.finisher ? 1.2 : 1),
                  m.heavy,
                );
                hit ||= p.hp < hp && !guarded;
              }
            }
            e.attackData = null;
            EnemyMotor.finish(e, t, hit);
          };
          if (this.combatIntents)
            this.combatIntents.push({
              source: e,
              at: impactAt,
              melee: pattern === "cone" && !m.heavy,
              resolve,
            });
          else resolve();
        }
        continue;
      }
      if (e.state === "attack" && e.until > t) continue;
      if (e.recoveryUntil > t) {
        e.state = "recover";
        continue;
      }
      if (e.guardUntil > t) {
        e.state = "guard";
        continue;
      }
      if (!target) {
        e.state = "idle";
        const a = t * 0.3 + Number(e.id.slice(1));
        this.move(
          e,
          (e.homeX + Math.cos(a) * 35 - e.x) * dt * 0.5,
          (e.homeY + Math.sin(a) * 35 - e.y) * dt * 0.5,
        );
        continue;
      }
      const d = distance(e, target);
      const canAttack =
        (t >= e.cooldown || e.counterReadyUntil > t) &&
        EnemyTactics.canCommit(e, this.enemies, target, t);
      const choice = CombatBrain.decide(e, target, t, canAttack, visible);
      e.angle = Math.atan2(target.y - e.y, target.x - e.x);
      if (choice === "guard") {
        e.state = "guard";
        e.guardAt = t;
        e.guardUntil = t + (e.ai?.guardDuration || 0.55);
        e.nextGuard = t + EnemyMotor.profile(e).guardRetry;
        e.effort -= 8;
        continue;
      }
      if (choice === "evade") {
        e.state = "evade";
        e.until = t + 0.26;
        e.evadeAngle = e.angle + ((e.ai?.orbit || 1) * Math.PI) / 2;
        e.nextEvade = t + EnemyMotor.profile(e).evadeRetry;
        e.effort -= 26;
        this.emit("dash", e, { angle: e.evadeAngle, text: "PASSO LATERAL" });
        continue;
      }
      if (["strike", "projectile", "counter"].includes(choice)) {
        e.state = "windup";
        e.counterStrike = choice === "counter";
        if (e.counterStrike) e.counterReadyUntil = 0;
        e.windupAt = t;
        e.attackCount = (e.attackCount || 0) + 1;
        e.pattern =
          choice === "projectile"
            ? "beam"
            : e.counterStrike
              ? "cone"
              : EnemyTactics.attackPattern(e, d);
        // A ranged archetype in contact still uses a short, readable melee strike.
        if (choice === "strike" && e.pattern === "beam") e.pattern = "cone";
        e.motorMove = EnemyMotor.prepare(e, t);
        e.motorMove.motion=require("./combat-motion")(e,e.motorMove.finisher?"finisher":"jab",e.attackCount,{x:Math.cos(e.angle),y:Math.sin(e.angle),boost:EnemyMotor.profile(e).pace>.75});
        e.effort -= e.motorMove.cost;
        e.attackAt = t + e.motorMove.startup;
        e.nextOpening = e.attackAt + e.motorMove.active + e.motorMove.recovery;
        e.telegraphRadius =
          e.pattern === "beam"
            ? e.ai?.rangedRange || 920
            : e.pattern === "rush"
              ? e.ai?.rushRange || 225
              : e.ai?.meleeRange || (e.boss ? 175 : 125);
        e.pressureUntil = e.attackAt + 0.3;
      } else {
        e.state = choice === "breathe" ? "breathe" : "run";
        let steering = EnemyTactics.steering(e, target, this.enemies, t);
        if (choice === "retreat" || choice === "breathe")
          steering = {
            x: -Math.cos(e.angle) * 0.7,
            y: -Math.sin(e.angle) * 0.7,
          };
        const speed =
          (e.world === "space"
            ? 1250
            : e.mode === "flight"
              ? 580
              : e.boss
                ? 230
                : 250) * (e.ai?.moveSpeed || 1);
        this.tacticalStep(e, target, steering, dt, speed);
      }
    }
    this.advanceBeams?.(dt);
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      const ox = s.x,
        oy = s.y;
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;
      s.life -= dt;
      const owner = s.hostile
        ? this.enemies.find((e) => e.id === s.owner && !e.dead && !e.returning)
        : this.players.get(s.owner);
      if (!owner) {
        s.life = 0;
        continue;
      }
      if (
        !this.clearSight(
          { world: s.world, x: ox, y: oy, mode: s.mode },
          { world: s.world, x: s.x, y: s.y, mode: s.mode },
        )
      ) {
        s.life = 0;
        this.emit("impact", s, { tier: "low" });
        continue;
      }
      const targets = s.hostile
        ? [...this.players.values()]
        : this.enemies.concat(
            [...this.players.values()].filter(
              (p) => p.id !== owner.id && p.pvp && owner.pvp,
            ),
          );
      for (const e of targets) {
        if (
          ((owner.duelId || e.duelId) && owner.duelId !== e.duelId) ||
          (e.practiceOwner && e.practiceOwner !== owner.id) ||
          (owner.practiceOwner && owner.practiceOwner !== e.id) ||
          e.world !== s.world ||
          e.dead ||
          s.hits.includes(e.id) ||
          e.state === "dead"
        )
          continue;
        const vx = s.x - ox,
          vy = s.y - oy;
        const f = clamp(
          ((e.x - ox) * vx + (e.y - oy) * vy) / (vx * vx + vy * vy || 1),
          0,
          1,
        );
        if (Math.hypot(e.x - (ox + vx * f), e.y - (oy + vy * f)) < s.r + 20) {
          s.hits.push(e.id);
          const priorParry = e.lastParryAt;
          this.damage(
            {
              ...owner,
              x: ox,
              y: oy,
              projectile: true,
              technique: s.technique,
              kiWeave: !!s.weave,
              guardBreak: !!s.charged,
              attackData: {
                posture: s.charged ? 80 : s.posture || 15,
                stun: 0.2,
              },
            },
            e,
            s.damage,
            s.pierce,
          );
          if (
            (s.reflections || 0) < 3 &&
            e.lastParryAt !== priorParry &&
            e.lastParryAt === t
          ) {
            s.reflections = (s.reflections || 0) + 1;
            s.owner = e.id;
            s.hostile = false;
            s.angle += Math.PI;
            s.steerUntil = 0;
            s.trail = [];
            s.initialAngle = s.angle;
            s.life = 0.75;
            s.speed *= 1.15;
            s.damage *= 0.8;
            s.hits = [];
            s.technique = "divine";
            s.pressureUntil = 0;
            this.emit("parry", e, { text: "DEVOLUÇÃO DE KI" });
            break;
          }
          if (!s.pierce) {
            s.life = 0;
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    this.enemies = this.enemies.filter(
      (e) =>
        !e.dead ||
        (!e.chapterId && !e.event && !e.storyEncounter) ||
        t < e.respawnAt,
    );
    if (
      !this.event &&
      t > this.eventAt &&
      [...this.players.values()].some(
        (p) => p.storyState?.completedQuests.length >= 3 && !p.duelId,
      )
    ) {
      const p = [...this.players.values()].find(
          (p) => p.storyState?.completedQuests.length >= 3 && !p.duelId,
        ),
        e = this.spawn(p.world, "Invasor de elite", "ginyu", 2400, 1950, true, {
          event: true,
          maxHp: 950,
          hp: 950,
        });
      this.event = { world: p.world, id: e.id, endsAt: t + 150 };
    }
    if (this.event && t > this.event.endsAt) {
      this.enemies = this.enemies.filter((e) => e.id !== this.event.id);
      this.event = null;
      this.eventAt = t + 180;
    }
  }
  train(id) {
    const p = this.players.get(id);
    if (p?.world === "space")
      return "Encontre um mestre na superfície para treinar.";
    if (
      !p ||
      p.state === "dead" ||
      distance(p, this.maps[p.world].mentor) > 150
    )
      return "Aproxime-se do mestre para treinar.";
    if (p.training)
      return "Treino em andamento: golpeie quando o indicador chegar ao centro.";
    p.training = { beat: this.time + 1.4, hits: 0, attempts: 0 };
    return "Treino de precisão: pressione Golpe no centro do ritmo. 8 tentativas.";
  }
  learn(id, technique) {
    const p = this.players.get(id),
      tech = TECHNIQUES.find((t) => t.id === technique);
    if (!p || !tech) return "Técnica desconhecida.";
    if (p.techniques.includes(technique))
      return "Você já conhece esta técnica.";
    if (
      p.state === "dead" ||
      p.world !== tech.world ||
      distance(p, this.maps[p.world].mentor) > 150
    )
      return "Encontre o mestre no mundo indicado.";
    if (p.level < tech.level || p.zenni < tech.cost)
      return "Nível ou zenni insuficientes.";
    p.zenni -= tech.cost;
    p.techniques.push(technique);
    if (technique === "teleport")
      return (
        tech.name +
        " aprendida! Use a navegação para retornar a destinos descobertos."
      );
    p.equipped = technique;
    return tech.name + " aprendida e equipada!";
  }
  equip(id, technique) {
    const p = this.players.get(id);
    if (p && technique !== "teleport" && p.techniques.includes(technique))
      p.equipped = technique;
  }
  attribute(id, stat) {
    const p = this.players.get(id);
    if (!p || !["force", "spirit", "vitality"].includes(stat) || p.points < 1)
      return false;
    p.points--;
    p.stats[stat]++;
    if (stat === "vitality") {
      p.maxHp += 18;
      p.hp += 18;
    }
    return true;
  }
  snapshot(id) {
    const p = this.players.get(id);
    if (!p) return null;
    for (const q of this.players.values())
      q.chargeRatio =
        q.chargeAt === null ? 0 : clamp((this.time - q.chargeAt) / 0.85, 0, 1);
    const publicPlayer = (q) =>
      Object.fromEntries(
        [
          "id",
          "name",
          "origin",
          "skin",
          "world",
          "x",
          "y",
          "vx",
          "vy",
          "mode",
          "region",
          "altitude",
          "ascent",
          "destination",
          "equipped",
          "chargeRatio",
          "boosting",
          "hp",
          "maxHp",
          "ki",
          "maxKi",
          "level",
          "angle",
          "state",
          "combo",
          "form",
          "pvp",
        ].map((k) => [k, q[k]]),
      );
    return {
      time: this.time,
      online: this.players.size,
      self: {
        ...publicPlayer(p),
        chargeRatio:
          p.chargeAt === null
            ? 0
            : clamp((this.time - p.chargeAt) / 0.85, 0, 1),
        xp: p.xp,
        zenni: p.zenni,
        focus: p.focus,
        cooldowns: p.cooldowns,
        progress: p.progress,
        campaign: p.campaign,
        questPhase: p.questPhase,
        questKills: p.questKills,
        orbs: p.orbs,
        visited: p.visited,
        chapter: this.chapter(p),
        until: p.until,
        power: p.power,
        stats: p.stats,
        points: p.points,
        techniques: p.techniques,
        equipped: p.equipped,
        mastery: p.mastery,
        training: p.training,
        lastCombatAt: p.lastCombatAt ?? -99,
        stun: p.stun,
        roundLocked: !!p.roundLocked,
        duelId: p.duelId || null,
        launch: p.launch || null,
      },
      players: [...this.players.values()]
        .filter((q) => q.world === p.world && distance(p, q) < 1450)
        .map(publicPlayer),
      enemies: this.enemies
        .filter((e) => !e.dead && e.world === p.world && distance(p, e) < 1450)
        .map((e) => {
          const out = {};
          for (const key of [
            "id", "name", "skin", "world", "x", "y", "vx", "vy", "mode",
            "hp", "maxHp", "angle", "state", "boss", "rank", "level", "form",
            "attackAt", "windupAt", "telegraphRadius", "pattern",
            "counterStrike", "combatTargetId", "guardMeter", "effort", "until", "dead",
            "practiceOwner", "combatStyle", "storyEncounter", "storyBossId",
            "storyPhaseIndex", "phaseName",
          ]) if (e[key] !== undefined) out[key] = e[key];
          if (e.ai) out.ai = { archetype: e.ai.archetype };
          return out;
        }),
      shots: this.shots.filter(
        (s) => s.world === p.world && distance(p, s) < 1700,
      ),
      effects: this.effects.filter(
        (e) =>
          e.world === p.world &&
          distance(p, e) < 1600 &&
          (!e.playerId || e.playerId === id),
      ),
      event: this.event,
    };
  }
}
require("./navigation")(Engine);
require("./open-world")(Engine);
require("./lore")(Engine);
require("./combat-flow")(Engine);
require("./quests")(Engine);
require("./sandbox")(Engine);
require("./beta")(Engine);
require("./combat-space")(Engine);
require("./combat-rhythm")(Engine);
require("./combat-clash")(Engine);
require("./duels")(Engine);
require("./story-guide")(Engine);
module.exports = { Engine, cleanName, distance };
