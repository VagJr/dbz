"use strict";
// Server-owned action cadence. Difficulty changes decisions, never client input speed.
const Hitboxes = require("../shared/hitboxes");
const DEFENSIVE_STEPS = Object.freeze({
  scout: { duration: 5 / 30, speed: 310 },
  duelist: { duration: 4 / 30, speed: 285 },
  skirmisher: { duration: 5 / 30, speed: 300 },
  artillery: { duration: 5 / 30, speed: 235 },
  brawler: { duration: 4 / 30, speed: 250 },
  juggernaut: { duration: 4 / 30, speed: 180 },
});
const ROLE_ALIAS = { aggressive: "brawler", tank: "juggernaut", speedster: "scout",
  zoner: "artillery", technical: "duelist", balanced: "duelist", ranged: "artillery" };
function tier(e) {
  return e.rank === "elite" ? 2 : e.rank === "veteran" || e.boss ? 1 : 0;
}
function approachReach(e) {
  return Hitboxes.meleeReach(e, { motion: {
    pose: e.mode === "flight" ? "airJab" : "jab",
    side: (e.attackCount || 0) % 2 ? -1 : 1,
  } });
}
function profile(e) {
  const n=tier(e),progress=Math.max(0,Math.min(1,((e.level||1)-1)/17));
  const pace=Math.max(progress,n*.28),frames=(slow)=>Math.max(1,Math.round(slow*(1-pace)+pace));
  const role = ROLE_ALIAS[e.ai?.archetype] || e.ai?.archetype || "brawler",
    step = DEFENSIVE_STEPS[role] || DEFENSIVE_STEPS.brawler;
  return {pace,progress,reaction:Math.max(.1,[.3,.22,.16][n]*(1-progress*.5)),
    think:frames([4,3,2][n])/30,startup:frames([7,5,4][n])/30,
    recovery:frames([5,3,2][n])/30,active:pace>.5?1/30:2/30,
    gap:(1-pace)*[4,2,1][n]/30,chain:Math.round(3+pace*2),
    guardRetry:[1.2,.95,.75][n]*(1-progress*.45),
    evadeRetry:[2.4,1.8,1.4][n]*(1-progress*.4),
    // A defensive slip stays within one or two body widths, including space.
    // Difficulty improves its timing, never its travel distance.
    evadeDuration:step.duration,evadeSpeed:step.speed,
    reengage:.65};
}
function prepare(e, t) {
  const p = profile(e),
    stage = e.counterStrike
      ? 1
      : t < (e.chainUntil || 0) ? (e.confirmedHits || 0) + 1 : 1;
  const special = e.pattern === "ring" || e.pattern === "rush";
  const charged =
    e.pattern === "beam" &&
    (e.attackCount || 0) % 3 === 0 &&
    (e.effort ?? 100) >= 32;
  const beam = e.pattern === "beam",
    finisher = !beam && stage >= p.chain;
  return {
    stage,
    charged,
    finisher,
    active: p.active,
    startup: special
      ? Math.max(e.pattern === "ring" ? .2 : .133, (e.ai?.windup || .5)*(.7-p.pace*.35))
      : charged
        ? .55-p.pace*.25
        : beam
          ? p.startup + 1 / 30
          : p.startup + (finisher ? 1 / 30 : 0),
    recovery: beam || special || finisher ? Math.max(1/30,.2-p.pace*.16) : p.recovery,
    cost: charged ? 32 : beam ? 18 : special || finisher ? 16 : e.counterStrike ? 14 : 10,
    stun: finisher || special ? .16 : .075,
    heavy: special || finisher,
  };
}
function finish(e, t, hit) {
  const p = profile(e),
    m = e.motorMove;
  if (e.pattern === "beam") {
    // Ranged fighters deliberately enter the exchange after a shot. The
    // projectile cooldown prevents a fresh beam from cancelling that advance.
    e.reengageUntil = Math.max(e.reengageUntil || 0, t + 1.05);
    e.nextProjectile = t + Math.max(1.25, (e.ai?.attackCooldown || 1.7) * .75);
  }
  if (hit && !m.finisher) {
    e.confirmedHits = m.stage;
    e.chainUntil = t + 1;
    e.cooldown = e.recoveryUntil;
  } else {
    e.confirmedHits = 0;
    e.chainUntil = 0;
    // Misses and blocked strings commit to extra recovery; no instant retry.
    e.recoveryUntil += (hit ? .05 : .12)*(1-p.pace*.8);
    e.cooldown = e.recoveryUntil + p.gap;
  }
  e.nextOpening = e.cooldown;
}
module.exports = { tier, profile, approachReach, prepare, finish };
