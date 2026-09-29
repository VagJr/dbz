"use strict";
const Hitboxes = require("../shared/hitboxes");
const Motor = require("./enemy-motor");

// Combat roles are shared by every encounter, including procedural patrols.
// Story bosses can replace these values with their phase-specific profile.
const ROLES = Object.freeze({
  scout: {
    archetype: "scout",
    desiredDistance: 105,
    meleeRange: 125,
    attackCooldown: 1.45,
    windup: 0.48,
    moveSpeed: 1.1,
    pattern: "cone",
    orbit: 1,
  },
  brawler: {
    archetype: "brawler",
    desiredDistance: 125,
    meleeRange: 150,
    attackCooldown: 1.55,
    windup: 0.56,
    moveSpeed: 0.92,
    pattern: "cone",
    orbit: -1,
  },
  duelist: {
    archetype: "duelist",
    desiredDistance: 155,
    meleeRange: 185,
    attackCooldown: 1.3,
    windup: 0.46,
    moveSpeed: 1.15,
    pattern: "cone",
    orbit: 1,
    guardInterval: 4.8,
    guardDuration: 0.4,
  },
  skirmisher: {
    archetype: "skirmisher",
    desiredDistance: 185,
    meleeRange: 155,
    rangedRange: 620,
    attackCooldown: 1.7,
    windup: 0.62,
    moveSpeed: 1.08,
    pattern: "beam",
    orbit: -1,
  },
  artillery: {
    archetype: "artillery",
    desiredDistance: 225,
    meleeRange: 130,
    rangedRange: 830,
    attackCooldown: 2.1,
    windup: 0.85,
    moveSpeed: 0.8,
    pattern: "beam",
    orbit: 1,
  },
  juggernaut: {
    archetype: "juggernaut",
    desiredDistance: 165,
    meleeRange: 195,
    attackCooldown: 2.15,
    windup: 0.88,
    moveSpeed: 0.75,
    pattern: "ring",
    orbit: -1,
    guardInterval: 5.5,
    guardDuration: 0.55,
  },
});

const ARCHETYPE_ALIAS = Object.freeze({
  aggressive: "brawler",
  tank: "juggernaut",
  speedster: "scout",
  zoner: "artillery",
  technical: "duelist",
  balanced: "duelist",
  ranged: "artillery",
});

const SKIN_ROLE = Object.freeze({
  soldier: "scout",
  saibaman: "scout",
  yardrat: "duelist",
  vegeta: "duelist",
  android: "skirmisher",
  cell: "duelist",
  frieza: "artillery",
  demon: "brawler",
  beerus: "duelist",
  jiren: "juggernaut",
  gas: "skirmisher",
  champa: "juggernaut",
  baby: "skirmisher",
  hirudegarn: "juggernaut",
  dabura: "duelist",
  piccolo: "skirmisher",
  nappa: "juggernaut",
  recoome: "juggernaut",
  burter: "scout",
  jeice: "artillery",
  guldo: "skirmisher",
  ginyu: "duelist",
  dodoria: "juggernaut",
  zarbon: "duelist",
  raditz: "skirmisher",
  tambourine: "scout",
  kingpiccolo: "artillery",
  generalBlue: "duelist",
  commanderRed: "artillery",
  pilaf: "artillery",
  roshi: "duelist",
});

function identity(skin, serial = 0, world = "earth") {
  const role =
    world === "space"
      ? "artillery"
      : SKIN_ROLE[skin] || (serial % 5 === 0 ? "skirmisher" : "brawler");
  const profile = ROLES[role];
  return {
    ...profile,
    windup: world === "space" ? 0.38 : profile.windup,
    // The same enemy keeps its side and tempo after a cell is reloaded.
    orbit: serial % 2 ? 1 : -1,
    tempoOffset: (serial % 7) * 0.19,
    aggroRange: world === "space" ? 1100 : role === "artillery" ? 720 : 560,
  };
}

function attackPattern(enemy, distance) {
  const ai = enemy.ai || ROLES.brawler;
  const count = enemy.attackCount || 0;
  if (enemy.storyBossId) return ai.pattern || "cone";
  if (ai.archetype === "duelist") return count % 3 === 2 ? "rush" : "cone";
  if (ai.archetype === "juggernaut") return count % 2 ? "cone" : "ring";
  if (ai.archetype === "skirmisher") return distance < 210 ? "cone" : "beam";
  if (ai.archetype === "scout") return count % 4 === 3 ? "rush" : "cone";
  return ai.pattern || "cone";
}
function canCommit(enemy, enemies, target, time) {
  if (time < (enemy.nextOpening || 0)) return false;
  const active = enemies.filter(
    (other) =>
      other !== enemy &&
      !other.dead &&
      other.world === enemy.world &&
      other.combatTargetId === target.id &&
      (other.state === "windup" ||
        other.state === "attack" ||
        other.pressureUntil > time) &&
      Math.hypot(other.x - target.x, other.y - target.y) < 850,
  ).length;
  // Higher-level encounters permit a second overlapping threat, with two
  // separate telegraphs; the introductory patrols always leave an opening.
  return active < (enemy.level >= 12 || enemy.boss ? 2 : 1);
}

function steering(enemy, target, enemies, time) {
  const ai = enemy.ai || ROLES.brawler;
  const role = ARCHETYPE_ALIAS[ai.archetype] || ai.archetype || "brawler";
  const dx = target.x - enemy.x,
    dy = target.y - enemy.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / d,
    uy = dy / d;
  // The firing band stays close enough for a fighter to enter melee after a
  // beam. A confirmed combo keeps every role in striking range.
  const wounded = enemy.hp / enemy.maxHp < 0.3;
  const strikeReach = Math.min(Motor.approachReach(enemy), Hitboxes.meleeReach(enemy, enemy.motorMove || {}));
  const contactDistance = Math.max(24, strikeReach + Hitboxes.body(target).radius * .7 - 7);
  const artillery = role === "artillery";
  const reengaging = (enemy.reengageUntil || 0) > time;
  const pursuingCombo = (enemy.chainUntil || 0) > time ||
    (enemy.counterReadyUntil || 0) > time;
  const desired = pursuingCombo || reengaging ? contactDistance - 4 : artillery
    ?
      Math.min(ai.desiredDistance || 225, contactDistance + 150) + (wounded ? 24 : 0)
    : contactDistance +
      (role === "duelist" ? 3 : role === "juggernaut" ? 12 : role === "scout" ? 0 : role === "skirmisher" ? 8 : -10);
  const distanceError = d - desired;
  // Forward movement wins over orbiting until the enemy reaches the hit zone.
  // A crowded fighter only yields a few pixels instead of fleeing backward.
  const radial = distanceError > 8
    ? Math.min(1, distanceError / (artillery ? 110 : 55))
    : distanceError < -12
      ? Math.max(-0.1, distanceError / 260)
      : 0;
  const flankSide = enemy.brain?.flankUntil > time
    ? enemy.brain.flankSide
    : ai.orbit || 1;
  const phase = time * flankSide * 0.8 + (ai.tempoOffset || 0);
  const orbitStrength =
    role === "brawler" ? 0.09 :
    role === "juggernaut" ? 0.07 :
    role === "scout" ? 0.19 :
    role === "duelist" ? 0.18 :
    role === "skirmisher" ? 0.22 : 0.2;
  const tangent =
    ((enemy.formation === "pincer"
      ? enemy.homeX < target.x
        ? -1
        : 1
      : flankSide) || 1) *
    (d < desired + 55 ? orbitStrength : orbitStrength * 0.5) *
    (0.76 + 0.24 * Math.sin(phase)) * (pursuingCombo || reengaging ? .35 : 1);
  let x = ux * radial - uy * tangent;
  let y = uy * radial + ux * tangent;
  for (const other of enemies) {
    if (other === enemy || other.dead || other.world !== enemy.world) continue;
    const ox = enemy.x - other.x,
      oy = enemy.y - other.y;
    const gap = Math.hypot(ox, oy);
    const spacing = Hitboxes.body(enemy).radius + Hitboxes.body(other).radius +
      (artillery ? 24 : 10);
    if (gap > 1 && gap < spacing) {
      const push = (spacing - gap) / spacing;
      x += (ox / gap) * push * 0.65;
      y += (oy / gap) * push * 0.65;
    }
  }
  const length = Math.hypot(x, y);
  return length > 0.01
    ? { x: x / Math.max(1, length), y: y / Math.max(1, length) }
    : { x: 0, y: 0 };
}

function disengage(enemy, target, time) {
  const dx = target.x - enemy.x,
    dy = target.y - enemy.y,
    d = Math.max(1, Math.hypot(dx, dy)),
    ux = dx / d,
    uy = dy / d,
    side = enemy.brain?.flankUntil > time
      ? enemy.brain.flankSide
      : enemy.ai?.orbit || 1;
  // This emergency beat is mostly a sidestep, with just enough separation to
  // create a readable opening before the fighter re-engages.
  return { x: -ux * 0.28 - uy * side * 0.86, y: -uy * 0.28 + ux * side * 0.86 };
}

module.exports = {
  ROLES,
  SKIN_ROLE,
  identity,
  attackPattern,
  canCommit,
  steering,
  disengage,
};
