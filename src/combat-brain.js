"use strict";
// Decisions use delayed observations, not player inputs or future commands.
const Motor = require("./enemy-motor");
const clamp = (v) => Math.max(0, Math.min(1, v));
const personalities = Object.freeze({
  scout: {
    aggression: 0.88,
    guard: 0.35,
    evade: 0.95,
    counter: 0.65,
    caution: 0.5,
  },
  brawler: {
    aggression: 1.05,
    guard: 0.65,
    evade: 0.18,
    counter: 0.65,
    caution: 0.25,
  },
  duelist: {
    aggression: 0.82,
    guard: 1,
    evade: 0.8,
    counter: 1.15,
    caution: 0.55,
  },
  skirmisher: {
    aggression: 0.82,
    guard: 0.42,
    evade: 1,
    counter: 0.6,
    caution: 0.8,
  },
  artillery: {
    aggression: 0.95,
    guard: 0.65,
    evade: 0.4,
    counter: 0.35,
    caution: 1,
  },
  juggernaut: {
    aggression: 1,
    guard: 1.12,
    evade: 0,
    counter: 1,
    caution: 0.15,
  },
});
const aliases = {
  aggressive: "brawler",
  tank: "juggernaut",
  speedster: "scout",
  zoner: "artillery",
  technical: "duelist",
  balanced: "duelist",
  ranged: "artillery",
};
function personality(e) {
  return (
    personalities[aliases[e.ai?.archetype] || e.ai?.archetype] ||
    personalities.brawler
  );
}
function reaction(e) {
  const p=Motor.profile(e);
  return Math.max(.1,e.ai?.reactionDelay!=null?e.ai.reactionDelay*(1-p.progress*.5):p.reaction);
}
function maintain(e, dt) {
  e.effort = Math.min(
    100,
    (e.effort ?? 100) +
      dt *
        (["recover", "idle", "return", "breathe"].includes(e.state)
          ? 18
          : e.state === "guard"
            ? 0
            : 7),
  );
}
function observe(e, target, t, visible) {
  if (!e.brain || e.brain.target !== target?.id)
    e.brain = {
      target: target?.id,
      samples: [],
      nextSample: 0,
      nextThink: 0,
      seen: null,
    };
  const b = e.brain;
  if (t >= b.nextSample) {
    b.nextSample = t + 2 / 30;
    b.samples.push({
      ready: t + reaction(e),
      at: t,
      visible,
      threat:
        !!target &&
        visible &&
        ["windup", "meleeCharge", "attack", "blast", "chargeAim"].includes(
          target.state,
        ),
      charging:
        !!target && visible && ["charge", "chargeAim"].includes(target.state),
      recovering: !!target && visible && target.state === "recover",
      guarding: !!target && visible && target.state === "guard",
      x: target?.x,
      y: target?.y,
    });
  }
  while (b.samples.length && b.samples[0].ready <= t) {
    b.seen = b.samples.shift();
    if (b.seen.threat) b.threatAt = b.seen.at;
  }
}
function decide(e, target, t, canAttack, visible) {
  const b = e.brain || { seen: null };
  if (t < (b.nextThink || 0))
    return ["breathe", "retreat"].includes(e.decision)
      ? e.decision
      : "position";
  const p = personality(e),
    d = Math.hypot(target.x - e.x, target.y - e.y),
    ai = e.ai || {},
    melee = ai.meleeRange || (e.boss ? 175 : 125),
    range = ai.rangedRange || 0;
  const pressure =
    t - (e.pressureHitAt ?? -99) >= reaction(e) &&
    t - (e.pressureHitAt ?? -99) < 1.1
      ? Math.min(3, e.recentPressure || 0)
      : 0;
  const seen = b.seen,
    threat =
      (seen?.visible && t - (b.threatAt ?? -99) < 0.65) || pressure ? 1 : 0,
    charge = seen?.visible && seen.charging ? 1 : 0,
    recovery = seen?.visible && seen.recovering ? 1 : 0,
    guard = seen?.visible && seen.guarding ? 1 : 0;
  const energy = clamp((e.effort ?? 100) / 100),
    injured = 1 - clamp(e.hp / e.maxHp),
    near = clamp(1 - (d - melee) / 150);
  const scores = {
    position: 0.18,
    breathe: energy < 0.32 ? 0.75 + (1 - energy) * 0.4 : 0,
  };
  const allowed = canAttack && visible;
  if (allowed && energy >= 0.2 && d < melee)
    scores.strike =
      p.aggression *
      (0.68 +
        0.22 * near +
        0.2 * charge +
        0.22 * recovery -
        0.18 * guard +
        ((e.chainUntil || 0) > t ? 0.3 : 0));
  if (allowed && energy >= 0.3 && range && d < range)
    scores.projectile =
      p.aggression *
      (0.62 +
        0.28 * clamp((d - melee) / 250) +
        0.24 * charge +
        0.16 * recovery);
  if (
    allowed &&
    energy >= 0.22 &&
    (e.counterReadyUntil || 0) > t &&
    d < melee + 40
  )
    scores.counter = 1.4 * p.counter;
  if (
    visible &&
    threat &&
    d < 360 &&
    energy >= 0.12 &&
    (e.nextGuard || 0) <= t &&
    (e.guardBrokenUntil || 0) <= t &&
    (e.guardMeter ?? 70) > 20
  )
    scores.guard =
      p.guard * (0.8 + 0.24 * near + 0.12 * injured + 0.4 * pressure);
  if (visible && threat && d < 620 && energy >= 0.26 && (e.nextEvade || 0) <= t)
    scores.evade =
      p.evade * (0.68 + 0.45 * charge + 0.18 * injured + 0.3 * pressure);
  if (range && d < melee + 80) scores.retreat = 0.5 + p.caution * 0.45;
  if (energy < 0.2)
    scores.retreat = Math.max(scores.retreat || 0, 0.7 + p.caution * 0.25);
  // A small preference for the existing choice reduces oscillation at range boundaries.
  if (scores[e.decision] > 0) scores[e.decision] += 0.04;
  const choice = Object.keys(scores).reduce(
    (best, key) => (scores[key] > scores[best] ? key : best),
    "position",
  );
  b.scores = scores;
  e.decision = choice;
  b.nextThink = t + Motor.profile(e).think;
  return choice;
}
module.exports = {
  personalities,
  personality,
  reaction,
  maintain,
  observe,
  decide,
};
