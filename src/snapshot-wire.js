"use strict";
// Socket.IO preserves order. Send stable UI/catalogue fields once and changes
// afterwards; keep simulation actors complete so removals remain unambiguous.
const coordinates = new Set([
  "x",
  "y",
  "vx",
  "vy",
  "angle",
  "hp",
  "ki",
  "chargeRatio",
]);
class SnapshotWire {
  constructor() {
    this.cache = new Map();
    this.groups = new Map();
    this.actorCache = {};
  }
  reset() {
    this.cache.clear();
    this.groups.clear();
    this.actorCache = {};
  }
  fields(group, value) {
    const out = {};
    const keys = new Set(Object.keys(value || {}));
    for (const key of this.groups.get(group) || []) {
      if (!keys.has(key)) {
        out[key] = null;
        this.cache.delete(group + ":" + key);
      }
    }
    this.groups.set(group, keys);
    for (const [key, item] of Object.entries(value || {})) {
      const rounded =
        typeof item === "number" &&
        Number.isFinite(item) &&
        coordinates.has(key)
          ? Math.round(item * 100) / 100
          : item;
      const text =
        rounded !== null && typeof rounded === "object"
          ? JSON.stringify(rounded)
          : rounded;
      const id = group + ":" + key;
      if (this.cache.get(id) !== text) {
        out[key] = rounded === undefined ? null : rounded;
        this.cache.set(id, text);
      }
    }
    return out;
  }
  actors(group, list) {
    const before = this.actorCache[group] || new Map(),
      after = new Map(),
      out = [];
    for (const actor of list) {
      const old = before.get(actor.id),
        values = {},
        signature = {},
        patch = { id: actor.id };
      for (const key in actor) {
        const item = actor[key],
          value =
            typeof item === "number" &&
            Number.isFinite(item) &&
            coordinates.has(key)
              ? Math.round(item * 100) / 100
              : item;
        const compare =
          value !== null && typeof value === "object"
            ? JSON.stringify(value)
            : value;
        values[key] = value;
        signature[key] = compare;
        if (!old || old.signature[key] !== compare)
          patch[key] = value === undefined ? null : value;
      }
      if (old)
        for (const key in old.values) if (!(key in values)) patch[key] = null;
      after.set(actor.id, { values, signature });
      out.push(patch);
    }
    this.actorCache[group] = after;
    return out;
  }
  encode(state) {
    if (!state) return state;
    const packet = {
      delta: true,
      actorsDelta: true,
      time: state.time,
      online: state.online,
      self: this.fields("self", state.self),
      players: this.actors("player", state.players),
      enemies: this.actors("enemy", state.enemies),
      shots: state.shots,
      effects: state.effects,
    };
    for (const [key, value] of Object.entries(state)) {
      if (key in packet) continue;
      if (key === "sandbox") packet.sandbox = this.fields("sandbox", value);
      else {
        const text = JSON.stringify(value);
        if (this.cache.get(key) !== text) {
          packet[key] = value;
          this.cache.set(key, text);
        }
      }
    }
    return packet;
  }
}
module.exports = { SnapshotWire };
