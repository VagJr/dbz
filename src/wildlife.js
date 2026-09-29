"use strict";

const Wildlife = require("../shared/wildlife");
const OpenWorld = require("../shared/open-world");
const Physics = require("../shared/physics");
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (low, high) => low + Math.random() * (high - low);
const activeWorld = world => !!Wildlife.byWorld[world];
const waterDistance = (world, x, y) => world === "namek"
  ? Math.abs(x - OpenWorld.riverX(world, y)) : Infinity;

function combatThreats(engine) {
  const players = [...engine.players.values()].filter(p =>
    activeWorld(p.world) && p.state !== "dead" &&
    (engine.time - Math.max(p.lastCombatAt ?? -99, p.lastHit ?? -99) < 4 ||
      ["attack", "blast", "dash", "windup", "melee", "clash"].includes(p.state)));
  const enemies = engine.enemies.filter(e => activeWorld(e.world) && !e.dead &&
    (e.combatTargetId || ["attack", "blast", "dash", "windup"].includes(e.state)));
  return players.concat(enemies);
}

function chooseSpecies(world, x, y) {
  const pool = Wildlife.byWorld[world];
  if (world === "namek") {
    if (waterDistance(world, x, y) <= 145)
      return pool[Math.floor(Math.random() * 2)];
    return pool[2 + Math.floor(Math.random() * 2)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function newAnimal(engine, player) {
  const angle = rand(-Math.PI, Math.PI), radius = rand(300, 1080);
  let x = player.x + Math.cos(angle) * radius;
  const y = player.y + Math.sin(angle) * radius;
  if (player.world === "namek" && Math.random() < 0.4) {
    const river = OpenWorld.riverX("namek", y);
    if (Math.abs(river - player.x) < 1050) x = river + rand(-62, 62);
  }
  const species = chooseSpecies(player.world, x, y);
  const def = Wildlife.species[species];
  // Fish stay inside the illustrated river, including when the player walks away.
  if (def.kind === "fish") x = OpenWorld.riverX("namek", y) + rand(-52, 52);
  return {
    id: `wild:${++engine.wildlifeSerial}`,
    world: player.world, species, x, y, homeX: x, homeY: y,
    targetX: x, targetY: y, angle: rand(-Math.PI, Math.PI),
    state: def.kind === "bird" ? "fly" : def.kind === "fish" ? "swim" : "graze",
    mode: def.kind === "bird" ? "flight" : "ground",
    z: def.kind === "bird" ? 80 : 0,
    grounded: def.kind !== "bird",
    phase: rand(0, Math.PI * 2), nextGoalAt: engine.time + rand(0.5, 2),
    restUntil: 0, fleeUntil: 0,
  };
}

function pickGoal(animal, engine) {
  const def = Wildlife.species[animal.species];
  const heading = rand(-Math.PI, Math.PI), radius = rand(80, def.kind === "bird" ? 460 : 280);
  let x = animal.homeX + Math.cos(heading) * radius;
  const y = animal.homeY + Math.sin(heading) * radius;
  if (def.kind === "fish") x = OpenWorld.riverX("namek", y) + rand(-62, 62);
  animal.targetX = x;
  animal.targetY = y;
  animal.nextGoalAt = engine.time + rand(3, 7);
  animal.restUntil = 0;
  animal.state = def.kind === "bird" ? "fly" : def.kind === "fish" ? "swim" :
    def.kind === "amphibian" ? "hop" : "wander";
}

function updateAnimal(animal, engine, threats, dt) {
  const def = Wildlife.species[animal.species];
  animal.phase += dt * (def.kind === "bird" ? 13 : def.kind === "fish" ? 8 : 5);
  let nearest = null, nearestDist = 310;
  for (const threat of threats) {
    if (threat.world !== animal.world) continue;
    const d = distance(threat, animal);
    if (d < nearestDist) { nearest = threat; nearestDist = d; }
  }
  if (nearest) {
    const away = Math.atan2(animal.y - nearest.y, animal.x - nearest.x);
    animal.targetX = animal.x + Math.cos(away) * 350;
    animal.targetY = animal.y + Math.sin(away) * 350;
    animal.fleeUntil = engine.time + 1.8;
    animal.state = "flee";
  } else if (engine.time >= animal.fleeUntil &&
      (engine.time >= animal.nextGoalAt || distance(animal, { x: animal.targetX, y: animal.targetY }) < 26)) {
    if (animal.restUntil > engine.time) {
      animal.state = waterDistance(animal.world, animal.x, animal.y) < 210 ? "drink" : "graze";
      return;
    }
    if (def.kind !== "bird" && def.kind !== "fish" && Math.random() < 0.38) {
      animal.restUntil = engine.time + rand(1.2, 3.4);
      animal.nextGoalAt = animal.restUntil;
      animal.state = waterDistance(animal.world, animal.x, animal.y) < 210 ? "drink" : "graze";
      return;
    }
    pickGoal(animal, engine);
  }
  let dx = animal.targetX - animal.x, dy = animal.targetY - animal.y;
  if (def.kind === "fish") {
    const river = OpenWorld.riverX("namek", animal.y);
    dx += (river - animal.x) * 0.55;
  }
  const length = Math.hypot(dx, dy);
  if (length < 4) return;
  const speed = def.speed * (animal.state === "flee" ? 2.8 : 1);
  Physics.ensure(animal);
  const blend = 1 - Math.exp(-10 * dt);
  animal.vx += (dx / length * speed - animal.vx) * blend;
  animal.vy += (dy / length * speed - animal.vy) * blend;
  if (def.kind === "amphibian" && animal.state === "hop" && animal.grounded && (animal.nextHop || 0) <= engine.time) {
    if (Physics.jump(animal)) animal.vz = 120;
    animal.nextHop = engine.time + .8;
  }
  engine.move(animal, animal.vx * dt, animal.vy * dt);
  if (def.kind === "fish") {
    const river = OpenWorld.riverX("namek", animal.y);
    animal.x = clamp(animal.x, river - 94, river + 94);
  }
  animal.angle = Math.atan2(dy, dx);
}

function wildlifeStep(engine, dt) {
  if (!Array.isArray(engine.wildlife)) engine.wildlife = [];
  const players = [...engine.players.values()].filter(p => activeWorld(p.world) && p.state !== "dead");
  engine.wildlife = engine.wildlife.filter(animal =>
    players.some(p => p.world === animal.world && distance(p, animal) < 2100));
  const threats = combatThreats(engine);
  for (const animal of engine.wildlife) updateAnimal(animal, engine, threats, dt);
  if (engine.wildlife.length >= Wildlife.MAX_GLOBAL) return;
  for (const player of players) {
    if (engine.wildlife.length >= Wildlife.MAX_GLOBAL) break;
    let nearby = engine.wildlife.filter(a => a.world === player.world && distance(a, player) < 1250).length;
    let attempts = 0;
    while (nearby < 9 && attempts++ < 24 && engine.wildlife.length < Wildlife.MAX_GLOBAL) {
      const animal = newAnimal(engine, player);
      if (distance(animal, player) > 1200 ||
          engine.wildlife.some(a => a.world === animal.world && distance(a, animal) < 105)) continue;
      engine.wildlife.push(animal);
      nearby++;
    }
  }
}

module.exports = function installWildlife(Engine) {
  if (Engine.prototype._wildlifeInstalled) return;
  Object.defineProperty(Engine.prototype, "_wildlifeInstalled", { value: true });
  const tick = Engine.prototype.tick;
  const snapshot = Engine.prototype.snapshot;
  Engine.prototype.tick = function (dt = 1 / 30) {
    const out = tick.call(this, dt);
    if (!Number.isFinite(this.wildlifeSerial)) this.wildlifeSerial = 0;
    this.wildlifeAccumulator = (this.wildlifeAccumulator || 0) + clamp(Number(dt) || 0, 0, 1);
    let steps = 0;
    while (this.wildlifeAccumulator >= Wildlife.STEP_SECONDS && steps++ < 5) {
      this.wildlifeAccumulator -= Wildlife.STEP_SECONDS;
      wildlifeStep(this, Wildlife.STEP_SECONDS);
    }
    return out;
  };
  Engine.prototype.snapshot = function (id) {
    const out = snapshot.call(this, id);
    if (!out) return out;
    const player = this.players.get(id);
    out.wildlife = !player || !Array.isArray(this.wildlife) ? [] : this.wildlife
      .filter(animal => animal.world === player.world && distance(animal, player) < 1450)
      .sort((a, b) => distance(a, player) - distance(b, player))
      .slice(0, Wildlife.MAX_VISIBLE)
      .map(animal => ({
        id: animal.id, species: animal.species,
        x: Math.round(animal.x), y: Math.round(animal.y),
        angle: Math.round(animal.angle * 100) / 100,
        state: animal.state, phase: Math.round(animal.phase * 10) / 10,
      }));
    return out;
  };
};
