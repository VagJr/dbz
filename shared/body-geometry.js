(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(() => require("./character-designs"), () => require("./content"), () => require("./wildlife"));
  else root.UZBodyGeometry = factory(() => root.UZDesigns || {}, () => root.UZ || {}, () => root.UZWildlife || {});
})(globalThis, (getDesigns, getContent, getWildlife) => {
  "use strict";
  const UNIT_SCALE = .69;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const aliases = new Map();
  let catalog;
  function design(e = {}) {
    const designs = getDesigns(), content = getContent();
    if (catalog !== content.CHARACTERS) {
      aliases.clear(); catalog = content.CHARACTERS;
      for (const row of catalog || []) aliases.set(row.id, row.skin || row.id);
    }
    return designs[e.skin] || designs[aliases.get(e.skin)] || designs.soldier || { flags: [], rig: "gi" };
  }
  function flags(e = {}) {
    let value = design(e).flags || [];
    if (e.appearance) {
      value = value.filter(f => !["slim", "wide", "large", "small"].includes(f));
      if (e.appearance.body === "slim") value = [...value, "slim"];
      if (e.appearance.body === "broad") value = [...value, "wide"];
    }
    return new Set(value);
  }
  function metrics(e = {}) {
    const f = flags(e), size = f.has("small") ? .84 : f.has("giant") ? 1.42 : 1;
    const width = f.has("wide") ? 1.22 : f.has("large") ? 1.15 : f.has("slim") ? .92 : 1;
    const bossScale = e.boss ? 1.22 : 1;
    return { unitScale: UNIT_SCALE, size, width, scale: UNIT_SCALE * size * bossScale,
      radius: 11.5 * size * width * bossScale, height: 44 * size * bossScale,
      mass: (f.has("giant") ? 220 : f.has("wide") || f.has("large") ? 115 : f.has("small") ? 55 : 80) * bossScale };
  }
  function body(e = {}) {
    if (e.kind === "stone") return { radius: e.size || 4, height: (e.size || 4) * 2, mass: 6 };
    if (e.species) {
      const spec = getWildlife().species?.[e.species], kind = spec?.kind || "dinosaur", size = spec?.size || 1;
      // Wildlife art is a side-view rig anchored at the feet, unlike fighters.
      const profile = kind === "bird" ? [17, 44, 4] : kind === "fish" ? [23, 29, 8] :
        kind === "amphibian" ? [22, 32, 4] : kind === "dinosaur" ? [25, 52, 70] : [23, 37, 16];
      return { radius: profile[0] * size, height: profile[1] * size, mass: profile[2] };
    }
    const { radius, height, mass } = metrics(e);
    return { radius, height, mass };
  }
  const kicks = new Set(["roundhouse", "airSpin", "airKnee", "risingKnee", "heelDrop", "spinKick", "sweep"]);
  function strikeProgress(move, clock) {
    if (!Number.isFinite(clock) || !Number.isFinite(move?.impact)) return 0;
    const start = move.start || 0, impact = move.impact;
    const activeEnd = move.activeEnd ?? impact + .07;
    const end = move.end ?? activeEnd + .16;
    const ease = value => { const v = clamp(value, 0, 1); return v * v * (3 - 2 * v); };
    // The final portion of anticipation is a visible extension into contact.
    // Explicit collision samples still pass their own progress to rigPose.
    const extension = impact - Math.min(.095, Math.max(.015, impact - start) * .48);
    if (clock < extension) return -.18 * ease((clock - start) / Math.max(.015, extension - start));
    if (clock < impact) return -.18 + 1.18 * ease((clock - extension) / Math.max(.015, impact - extension));
    if (clock < activeEnd) return 1;
    return 1 - ease((clock - activeEnd) / Math.max(.015, end - activeEnd));
  }
  function rigPose(e = {}, move, progress, time = 0) {
    const m = move || e.combatAction || e.moveAction || e.motorMove, motion = m?.motion;
    const state = e.state || "idle", flight = e.mode === "flight" || (e.mode !== "ground" && ["fly", "glide", "boost"].includes(state));
    const hit = !!(m && !["ki", "charged", "weave"].includes(m.key)) || state === "attack" || e.clashType === "fists";
    const blast = !!(m && ["ki", "charged", "weave"].includes(m.key)) || state === "blast" || e.clashType === "beam";
    const groundZ = e.groundZ || 0, z = Number.isFinite(e.z) ? e.z : flight ? 80 : 0;
    const jumpCrouch = !flight && e.jumpWindup > 0 ? clamp(1 - e.jumpWindup / .055, 0, 1) : 0;
    const airborne = !flight && (e.grounded === false || z > groundZ + 2), rising = airborne && (e.vz || 0) > 20;
    const walk = state === "run" && !airborne, guard = state === "guard", charge = ["charge", "chargeAim", "meleeCharge"].includes(state);
    const pose = e.previewPose || motion?.pose || m?.pose || (e.combo === 3 ? "roundhouse" : e.combo === 2 ? "cross" : "jab");
    const strikeSide = motion?.side || ((e.combo || m?.stage || 1) % 2 ? 1 : -1), kick = kicks.has(pose);
    let punch = Number.isFinite(progress) ? progress : state === "windup" ? -.12 : state === "recover" ? .35 : hit ? 1 : 0;
    const clock = e.combatClock;
    if (!Number.isFinite(progress) && Number.isFinite(clock) && Number.isFinite(m?.impact)) {
      punch = strikeProgress(m, clock);
    }
    const reach = Math.max(0, punch), driving = hit && ["lunge", "dashHammer", "airDive", "flyingCross"].includes(pose);
    const rush = state === "rush" || hit && Math.hypot(e.vx || 0, e.vy || 0) > (flight ? 500 : 260) && punch < 0;
    const twist = hit ? strikeSide * (punch * (["hook", "slipHook", "airSpin", "bodyHook", "spinKick", "sweep"].includes(pose) ? .72 : ["cross", "airCross", "flyingCross", "lunge", "thrust"].includes(pose) ? .54 : .38) - .10) :
      guard ? -.12 : blast ? .12 : walk ? Math.sin(time * 14) * .025 : 0;
    const cameraFacing = flight ? 0 : e.previewFacing ? 1 : clamp((Math.sin(e.angle || 0) + .12) / 1.12, 0, 1);
    const tilt = flight ? .72 : hit ? (driving ? .62 : .32) + reach * (["uppercut", "risingKnee", "guardBreak"].includes(pose) ? .12 : .25) :
      guard ? .32 + cameraFacing * .18 : charge ? .28 : blast ? .62 : state === "stun" ? .55 : .08 + cameraFacing * .42;
    const metric = metrics(e), matrix = [metric.scale, 0, 0, metric.scale, 0, 0];
    function rotate(angle) {
      const c = Math.cos(angle), s = Math.sin(angle), [a, b, d, f] = matrix;
      matrix[0] = a * c + d * s; matrix[1] = b * c + f * s;
      matrix[2] = d * c - a * s; matrix[3] = f * c - b * s;
    }
    function scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; }
    function translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; }
    rotate((e.angle || 0) - Math.PI / 2 + twist); scale(metric.width, 1);
    if (airborne && !hit) { rotate(rising ? -.08 : .04); scale(1, rising ? .92 : 1.04); }
    const landing = e.landedAt != null && Number.isFinite(clock) ? clamp(1 - (clock - e.landedAt) / .18, 0, 1) : 0;
    if (landing > 0 && !flight && !airborne && !hit) scale(1 + landing * .08, 1 - landing * .18);
    if (jumpCrouch && !hit) { scale(1 + jumpCrouch * .035, 1 - jumpCrouch * .13); translate(0, -jumpCrouch * 2); }
    if (flight) { translate(0, hit ? reach * 3 : Math.sin(time * 4) * .7); if (hit) rotate(strikeSide * punch * .13); }
    else if (hit) translate(strikeSide * punch * 3.1, punch * 2.2);
    if (rush || driving) { scale(1, flight ? 1.12 : .90); translate(0, 3); }
    if (hit && ["airSpin", "roundhouse", "spinKick", "sweep"].includes(pose)) rotate(strikeSide * reach * (["spinKick", "airSpin"].includes(pose) ? 1.05 : .65));
    if (hit && ["uppercut", "risingKnee", "guardBreak"].includes(pose)) translate(0, reach * 4);
    if (hit && ["meteor", "airDive"].includes(pose)) { scale(1, 1 - reach * .13); translate(0, reach * (pose === "airDive" ? 9 : 5)); }
    const transform = point => ({ x: (e.x || 0) + matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
      y: (e.y || 0) + matrix[1] * point[0] + matrix[3] * point[1] + matrix[5] });
    const limbs = [];
    for (const s of [-1, 1]) {
      let knee = [s * 6, -7], foot = [s * 7, -10];
      if (flight) { knee = [s * 5, -19]; foot = [s * 5, -29]; }
      if (state === "dash") { knee = [s * 9, -11]; foot = [s * 10, -19 + s * 4]; }
      if (airborne && !flight) { knee = [s * (rising ? 10 : 7), rising ? -2 : -9]; foot = [s * (rising ? 13 : 11), rising ? -7 : -20]; }
      if (guard || charge) foot = [s * 11, -15];
      if (flight && (guard || charge)) { knee = [s * 8, -14]; foot = [s * 6, -23 + s * 2]; }
      if (hit && !kick) {
        if (flight) { knee = [s * 7, -17]; foot = [s * 6, -28 + s * punch * 3]; }
        else { knee = [s * 8, -7]; foot = [s * 10, -12 + (s === strikeSide ? -punch * 3 : punch * 4)]; }
      }
      if (hit && kick && s === strikeSide) {
        if (["airKnee", "risingKnee"].includes(pose)) { knee = [s * 9, 1 + 16 * reach]; foot = [s * 8, -9 + 18 * reach]; }
        else if (pose === "heelDrop") { knee = [s * 10, 7 + 15 * reach]; foot = [s * 11, 10 + 42 * reach]; }
        else if (pose === "sweep") { knee = [s * (13 + 6 * reach), -7 + 4 * reach]; foot = [s * (23 + 22 * reach), -12 + 10 * reach]; }
        else { const sweep = ["airSpin", "spinKick"].includes(pose) ? Math.sin(reach * Math.PI * .7) : reach;
          knee = [s * (12 - 9 * sweep), -3 + 14 * reach]; foot = [s * (23 - 24 * sweep), -7 + 43 * reach]; }
      }
      if (hit && pose === "retreatJab") { knee = [s * 9, -11]; foot = [s * 13, -19 - reach * 3]; }
      if (driving) { knee = [s * 7, -9 + s * 4]; foot = [s * 10, -18 + s * 8];
        if (pose === "airDive" && s === strikeSide) { knee = [s * 9, 4 + 8 * reach]; foot = [s * 11, 8 + 28 * reach]; } }
      if (state === "stun") foot = [s * 13, -19];
      limbs.push({ part: "legs", side: s, points: [[s * 5, -7], knee, foot], width: 3.5 });
      if (flags(e).has("onearm") && s === 1) continue;
      let elbow = [s * 16, 1], hand = [s * 17, 5];
      if (flight) { elbow = [s * (state === "glide" ? 19 : 15), -6]; hand = [s * (state === "glide" ? 24 : 14), -11]; }
      if (state === "dash") { elbow = [s * 17, -3 + s * 4]; hand = [s * 20, -7 + s * 6]; }
      if (airborne && !flight) { elbow = [s * (rising ? 16 : 20), rising ? 6 : 1]; hand = [s * (rising ? 11 : 26), rising ? 14 : 7]; }
      if (guard) { elbow = [s * 16, 10]; hand = [s * 9, 18]; }
      if (charge) { elbow = [s * 18, 2]; hand = [s * (state === "chargeAim" ? 8 : 19), state === "chargeAim" ? 19 : 9]; }
      if (flight && guard) { elbow = [s * 15, 11]; hand = [s * 8, 24]; }
      if (flight && charge) { elbow = [s * 16, 4]; hand = [s * (state === "chargeAim" ? 6 : 15), state === "chargeAim" ? 24 : 12]; }
      if (blast) { elbow = [s * 13, 14]; hand = [s * 7, 27]; }
      if (hit) {
        if (s === strikeSide && !kick) { elbow = [s * (17 - 8 * punch), 3 + 14 * punch]; hand = e.combo === 2 ? [s * (22 - 22 * punch), 8 + 22 * punch] : [s * (15 - 10 * punch), 8 + 29 * punch]; }
        else { elbow = [s * 15, 2]; hand = [s * 9, 12]; }
        if (kick) { elbow = [s * (18 + 3 * reach), 2 + 8 * reach]; hand = [s * (21 + 4 * reach), 6 + 15 * reach]; }
        else if (["meteor", "airDive", "dashHammer", "guardBreak"].includes(pose)) { elbow = [s * (13 - 8 * reach), 12 + reach * 3]; hand = [s * 4, 24 + reach * (pose === "dashHammer" ? 17 : 8)]; }
        else if (s === strikeSide) {
          if (["hook", "slipHook", "airCross", "bodyHook"].includes(pose)) { elbow = [s * (22 - 6 * reach), 5 + reach * (pose === "bodyHook" ? 5 : 12)]; hand = [s * (25 - 29 * reach), 9 + (pose === "bodyHook" ? 12 : 23) * reach]; }
          else if (pose === "uppercut") { elbow = [s * (17 - 8 * reach), -3 + 10 * reach]; hand = [s * (14 - 10 * reach), -5 + 38 * reach]; }
          else if (pose === "cross") { elbow = [s * (16 - 12 * reach), 3 + 15 * reach]; hand = [s * (14 - 19 * reach), 8 + 33 * reach]; }
          else if (pose === "elbow") { elbow = [s * (17 - 17 * reach), 5 + 19 * reach]; hand = [s * (12 - 12 * reach), 10 + 14 * reach]; }
          else if (pose === "thrust") { elbow = [s * (17 - 11 * reach), 6 + 18 * reach]; hand = [s * (16 - 13 * reach), 8 + 39 * reach]; }
          else if (pose === "flyingCross") { elbow = [s * (18 - 14 * reach), 6 + 20 * reach]; hand = [s * (15 - 18 * reach), 7 + 42 * reach]; }
          else if (pose === "stepJab") { elbow = [s * (17 - 9 * reach), 5 + 16 * reach]; hand = [s * (16 - 10 * reach), 10 + 32 * reach]; }
          else if (pose === "retreatJab") { elbow = [s * (18 - 6 * reach), 3 + 11 * reach]; hand = [s * (17 - 8 * reach), 7 + 25 * reach]; }
          else if (pose === "lunge") { elbow = [s * (13 - 9 * reach), 8 + 16 * reach]; hand = [s * 4, 12 + 36 * reach]; }
          else if (pose === "airJab") { elbow = [s * (15 - 9 * reach), 7 + 14 * reach]; hand = [s * 5, 11 + 33 * reach]; }
        } else {
          const follow = m?.key === "link" || ["cross", "airCross", "flyingCross", "lunge"].includes(pose);
          elbow = [s * (follow ? 16 - 6 * reach : 16 - 2 * reach), 5 + (follow ? 11 : 6) * reach];
          hand = [s * (follow ? 10 - 6 * reach : 10), 15 + (follow ? 11 : 4) * reach];
          if (punch < 0) { elbow[1] -= 3; hand[1] -= 5; }
        }
      }
      if (state === "stun") { elbow = [s * 19, 0]; hand = [s * 23, 5]; }
      if (rush) { elbow = [s * 11, flight ? 18 : 7]; hand = [s * 5, flight ? 32 : 18]; }
      limbs.push({ part: "arms", side: s, points: [[s * 10, 2], elbow, hand], width: 2.7 });
    }
    return { ...metric, flight, airborne, rising, hit, pose, kick, strikeSide, reach, punch, twist, tilt, limbs, transform };
  }
  return Object.freeze({ UNIT_SCALE, design, flags, metrics, body, strikeProgress, rigPose });
});
