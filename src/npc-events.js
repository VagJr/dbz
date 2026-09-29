"use strict";

const Living = require("../shared/living-npcs");
const UPDATE_SECONDS = 1 / 3;
const MAX_RESPONDERS = 4;
const CALL_RADIUS = 2600;
const ACTIVE_PARTICIPATION_SECONDS = 18;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const clock = engine => typeof engine.livingNpcClock === "function"
  ? engine.livingNpcClock() : Date.now() / 1000;
const alive = player => player && player.state !== "dead" && !player.afterlife?.pending && !player.duelId;

function eventTarget(engine) {
  const event = engine.event;
  if (!event || (Number.isFinite(event.endsAt) && event.endsAt <= engine.time)) return null;
  return engine.enemies.find(enemy => enemy.id === event.id && enemy.world === event.world &&
    !enemy.dead && enemy.hp > 0 && !enemy.practiceOwner && !enemy.storyEncounter) || null;
}

function freshResponse(event, target, time) {
  return { eventId: event.id, targetId: target.id, world: event.world,
    actors: new Map(), participants: new Map(), cache: [],
    nextRecruitAt: time, lastUpdateAt: time - UPDATE_SECONDS };
}

function occupiedCharacters(engine) {
  const occupied = new Set();
  for (const player of engine.players.values()) {
    if (player.livingNpcs?.companion) occupied.add(player.livingNpcs.companion);
    const guide = engine.activeGuide?.(player);
    if (guide?.interactable && guide.skin) occupied.add(guide.skin);
  }
  return occupied;
}

function recruit(engine, response, target) {
  const occupied = occupiedCharacters(engine);
  for (const id of occupied) response.actors.delete(id);
  const available = Living.visible(target.world, target.x, target.y, clock(engine), {
    radius: CALL_RADIUS, siteResolver: engine.livingNpcSiteResolver,
  }).filter(actor => !occupied.has(actor.characterId) && !response.actors.has(actor.characterId) &&
    ["guardian", "mentor", "healer"].includes(actor.role) &&
    !["sleep", "eat", "travel"].includes(actor.activity))
    .sort((a, b) => distance(a, target) - distance(b, target) || a.characterId.localeCompare(b.characterId));
  for (const actor of available) {
    if (response.actors.size >= MAX_RESPONDERS) break;
    const role = actor.role;
    const index = response.actors.size;
    response.actors.set(actor.characterId, {
      ...actor, activity: "respond", state: "run", mode: "ground", responseEventId: response.eventId,
      responsePhase: "approach", responseSlot: index,
      responseNextActionAt: engine.time + 2 + index * 1.4,
      responseRouteAt: 0, responseWaypoints: [],
    });
    if (role === "healer") response.actors.get(actor.characterId).responseNextActionAt += 2;
  }
  response.nextRecruitAt = engine.time + 8;
}

function lineHitsBox(from, to, box) {
  const dx = to.x - from.x, dy = to.y - from.y;
  let enter = 0, leave = 1;
  for (const [p, q] of [[-dx, from.x - box.left], [dx, box.right - from.x],
    [-dy, from.y - box.top], [dy, box.bottom - from.y]]) {
    if (Math.abs(p) < 1e-8) { if (q < 0) return false; continue; }
    const step = q / p;
    if (p < 0) enter = Math.max(enter, step);
    else leave = Math.min(leave, step);
    if (enter > leave) return false;
  }
  return leave >= 0 && enter <= 1;
}

function groundWaypoints(engine, actor, goal) {
  const boxes = (engine.maps[actor.world]?.buildings || []).filter(building =>
    Number.isFinite(building.x) && Number.isFinite(building.y) &&
    distance(actor, building) < distance(actor, goal) + 300).slice(0, 24)
    .map(building => ({ left: building.x - 96, right: building.x + 96,
      top: building.y - 86, bottom: building.y + 86 }));
  const points = [];
  let from = { x: actor.x, y: actor.y };
  for (let attempt = 0; attempt < 6; attempt++) {
    const blocked = boxes.find(box => lineHitsBox(from, goal, box));
    if (!blocked) break;
    const corners = [
      { x: blocked.left - 16, y: blocked.top - 16 },
      { x: blocked.right + 16, y: blocked.top - 16 },
      { x: blocked.left - 16, y: blocked.bottom + 16 },
      { x: blocked.right + 16, y: blocked.bottom + 16 },
    ].filter(point => !boxes.some(box => lineHitsBox(from, point, box)))
      .sort((a, b) => distance(from, a) + distance(a, goal) - distance(from, b) - distance(b, goal));
    const next = corners.find(point => !points.some(old => distance(old, point) < 10));
    if (!next) break;
    points.push(next);
    from = next;
  }
  points.push(goal);
  return points;
}

function moveResponder(engine, actor, target, elapsed) {
  const angle = actor.responseSlot * Math.PI / 2 + 0.3;
  const holdDistance = actor.role === "healer" ? 290 : 175;
  const goal = { x: target.x + Math.cos(angle) * holdDistance,
    y: target.y + Math.sin(angle) * holdDistance };
  const remaining = distance(actor, goal);
  actor.targetX = Math.round(target.x);
  actor.targetY = Math.round(target.y);
  if (remaining < 35) {
    actor.vx = actor.vy = 0;
    actor.angle = Math.atan2(target.y - actor.y, target.x - actor.x);
    actor.mode = "ground";
    actor.state = engine.time < (actor.until || 0) ? actor.state : "guard";
    actor.responsePhase = "support";
    return;
  }
  actor.responsePhase = "approach";
  const flight = actor.role !== "healer" && remaining > 650;
  actor.mode = flight ? "flight" : "ground";
  if (!actor.responseWaypoints.length || engine.time >= actor.responseRouteAt ||
      distance(actor.responseGoal || goal, goal) > 100) {
    actor.responseWaypoints = flight ? [goal] : groundWaypoints(engine, actor, goal);
    actor.responseGoal = goal;
    actor.responseRouteAt = engine.time + 2;
  }
  let point = actor.responseWaypoints[0];
  if (distance(actor, point) < 25 && actor.responseWaypoints.length > 1) {
    actor.responseWaypoints.shift();
    point = actor.responseWaypoints[0];
  }
  const dx = point.x - actor.x, dy = point.y - actor.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = flight ? 390 : actor.role === "healer" ? 135 : 185;
  const step = Math.min(length, speed * elapsed);
  actor.vx = dx / length * speed;
  actor.vy = dy / length * speed;
  actor.angle = Math.atan2(dy, dx);
  actor.state = flight ? "fly" : "run";
  engine.move(actor, dx / length * step, dy / length * step);
}

function eligibleParticipants(engine, response, target) {
  const participants = [];
  for (const [id, contributionAt] of response.participants) {
    const player = engine.players.get(id);
    if (!alive(player) || player.world !== target.world ||
        engine.time - contributionAt > ACTIVE_PARTICIPATION_SECONDS || distance(player, target) > 1100) {
      response.participants.delete(id);
      continue;
    }
    participants.push(player);
  }
  return participants;
}

function support(engine, actor, target, participants) {
  if (!participants.length || engine.time < actor.responseNextActionAt || distance(actor, target) > 410) return;
  actor.responseNextActionAt = engine.time + (actor.role === "healer" ? 9 : 6.5);
  actor.angle = Math.atan2(target.y - actor.y, target.x - actor.x);
  if (actor.role === "healer") {
    const injured = participants.filter(player => player.hp < player.maxHp && distance(actor, player) < 480)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!injured) return;
    const amount = Math.min(injured.maxHp - injured.hp, clamp(injured.maxHp * 0.035, 4, 28));
    injured.hp += amount;
    actor.state = "charge";
    actor.until = engine.time + 0.7;
    engine.emit("heal", injured, { amount: Math.round(amount),
      text: actor.name + " · APOIO", npcId: actor.characterId });
    return;
  }
  // Apply only nonlethal assistance, without entering enemy death/reward hooks.
  // Players still need to fight and finish the event with their own attacks.
  if (target.hp <= 1 || target.invuln > engine.time) return;
  const averageLevel = participants.reduce((sum, player) => sum + player.level, 0) / participants.length;
  let amount = clamp(6 + averageLevel * 0.8, 6, actor.role === "mentor" ? 25 : 21);
  if (target.state === "guard") amount *= 0.35;
  amount = Math.min(target.hp - 1, amount);
  if (amount <= 0) return;
  target.hp -= amount;
  actor.state = "blast";
  actor.until = engine.time + 0.45;
  engine.emit("cast", actor, { angle: actor.angle, technique: "ki", npcId: actor.characterId });
  engine.emit("hit", target, { amount: Math.round(amount), text: actor.name + " · APOIO",
    npcId: actor.characterId, npcSupport: true });
}

function cacheActors(response) {
  response.cache = [...response.actors.values()].map(actor => ({
    id: actor.id, characterId: actor.characterId, name: actor.name, skin: actor.skin,
    role: actor.role, faction: actor.faction, temperament: actor.temperament,
    canFollow: actor.canFollow, canSpar: actor.canSpar,
    world: actor.world, x: Math.round(actor.x), y: Math.round(actor.y),
    vx: Math.round(actor.vx || 0), vy: Math.round(actor.vy || 0), angle: actor.angle,
    state: actor.state, mode: actor.mode, activity: "respond", until: actor.until || 0,
    destination: "Evento local", targetX: actor.targetX, targetY: actor.targetY,
    responseEventId: response.eventId, responsePhase: actor.responsePhase,
  }));
}

module.exports = function installNpcEvents(Engine) {
  if (Engine.prototype._npcEventsInstalled) return;
  Object.defineProperty(Engine.prototype, "_npcEventsInstalled", { value: true });
  const damage = Engine.prototype.damage;
  const tick = Engine.prototype.tick;

  Engine.prototype.livingNpcResponseActor = function (npcId) {
    const actor = this.livingNpcResponses?.cache.find(person => person.characterId === npcId);
    return actor ? { ...actor } : null;
  };
  Engine.prototype.livingNpcResponseActors = function (world, x, y, radius = 1450) {
    const response = this.livingNpcResponses;
    if (!response || response.world !== world) return [];
    return response.cache.filter(actor => Math.hypot(actor.x - x, actor.y - y) <= radius)
      .map(actor => ({ ...actor }));
  };

  Engine.prototype.damage = function (attacker, target, amount, heavy) {
    const before = target?.hp;
    const output = damage.call(this, attacker, target, amount, heavy);
    const player = this.players.get(attacker?.id);
    if (player && target?.id === this.event?.id && !target.dead && target.hp < before && alive(player)) {
      let response = this.livingNpcResponses;
      if (!response || response.eventId !== this.event.id)
        response = this.livingNpcResponses = freshResponse(this.event, target, this.time);
      response.participants.set(player.id, this.time);
    }
    return output;
  };

  Engine.prototype.tick = function (dt) {
    const output = tick.call(this, dt);
    if (this.time < (this._npcResponseAt || 0)) return output;
    this._npcResponseAt = this.time + UPDATE_SECONDS;
    const target = eventTarget(this);
    const observed = target && [...this.players.values()].some(player =>
      alive(player) && player.world === target.world);
    if (!target || !observed) { this.livingNpcResponses = null; return output; }
    let response = this.livingNpcResponses;
    if (!response || response.eventId !== this.event.id)
      response = this.livingNpcResponses = freshResponse(this.event, target, this.time);
    const elapsed = clamp(this.time - response.lastUpdateAt, 0, 0.5);
    response.lastUpdateAt = this.time;
    // A companion or a story guide immediately leaves the public response pool.
    const occupied = occupiedCharacters(this);
    for (const id of occupied) response.actors.delete(id);
    if (this.time >= response.nextRecruitAt) recruit(this, response, target);
    const participants = eligibleParticipants(this, response, target);
    for (const actor of response.actors.values()) {
      moveResponder(this, actor, target, elapsed);
      support(this, actor, target, participants);
    }
    cacheActors(response);
    return output;
  };
};
