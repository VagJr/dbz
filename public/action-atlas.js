/* Runtime sprite sheets built from the same miniature rig used in the world.
   Sheets are populated one visible frame at a time, so a new appearance or
   combo never triggers a full atlas build in a single gameplay frame. */
(() => {
  const vectorFighter = Art.fighter;
  const FRAMES = 12;
  const WORLD_SIZE = 128;
  const DENSITY = 1.5;
  const CELL = WORLD_SIZE * DENSITY;
  const MAX_SHEETS = 12;
  const sheets = new Map();
  const meleeKeys = new Set(['jab', 'link', 'finisher', 'heavy']);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function appearanceKey(e) {
    const appearance = e.appearance;
    const colors = appearance && typeof appearance === 'object'
      ? [appearance.body, appearance.cut, appearance.skin, appearance.hair,
          appearance.cloth, appearance.trim].join('.')
      : '';
    const move = e.combatAction.motion;
    return [
      e.skin || 'soldier', e.form || '', colors, e.mode || 'ground',
      e.combatAction.key, move.pose || 'jab', move.side || 1,
      move.moving ? 1 : 0, move.boosted ? 1 : 0, move.airborne ? 1 : 0,
    ].join('|');
  }

  function getSheet(key) {
    let sheet = sheets.get(key);
    if (sheet) {
      // Map order also provides an inexpensive least-recently-used bound.
      sheets.delete(key);
      sheets.set(key, sheet);
      return sheet;
    }
    const canvas = document.createElement('canvas');
    canvas.width = CELL * FRAMES;
    canvas.height = CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    sheet = {canvas, ctx, ready: new Uint8Array(FRAMES)};
    if (sheets.size >= MAX_SHEETS) sheets.delete(sheets.keys().next().value);
    sheets.set(key, sheet);
    return sheet;
  }

  function paintFrame(sheet, frame, e) {
    const m = e.combatAction;
    const duration = m.end - m.start;
    const sample = m.start + duration * (frame + .5) / FRAMES;
    const activeEnd = Number.isFinite(m.activeEnd) ? m.activeEnd : m.impact + .06;
    const state = sample < m.impact ? 'windup' : sample < activeEnd ? 'attack' : 'recover';
    const x = frame * CELL;
    const sc = sheet.ctx;
    sc.clearRect(x, 0, CELL, CELL);
    sc.save();
    sc.beginPath();
    sc.rect(x, 0, CELL, CELL);
    sc.clip();
    sc.translate(x, 0);
    sc.scale(DENSITY, DENSITY);
    vectorFighter(sc, {
      ...e, x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, angle: 0,
      state, combatClock: sample,
      combatAction: {...m, activeEnd},
    }, sample - m.start, 1);
    sc.restore();
    sheet.ready[frame] = 1;
  }

  function fighter(c, e, t, scale = 1) {
    const m = e.combatAction;
    const duration = m && m.end - m.start;
    const canCache =
      m && m.motion && meleeKeys.has(m.key) &&
      Number.isFinite(m.start) && Number.isFinite(m.impact) &&
      Number.isFinite(m.end) && Number.isFinite(e.combatClock) &&
      duration > .12 && duration < 1.5 &&
      scale <= 1.4 && Math.sin(e.angle || 0) <= .25 && !Art.reduceMotion &&
      !(navigator.deviceMemory && navigator.deviceMemory < 4);
    if (!canCache) return vectorFighter(c, e, t, scale);

    const sheet = getSheet(appearanceKey(e));
    if (!sheet) return vectorFighter(c, e, t, scale);
    const progress = clamp((e.combatClock - m.start) / duration, 0, .999);
    const frame = Math.floor(progress * FRAMES);
    if (!sheet.ready[frame]) paintFrame(sheet, frame, e);
    c.save();
    c.translate(e.x || 0, e.y || 0);
    c.rotate(e.angle || 0);
    c.scale(scale, scale);
    c.drawImage(sheet.canvas, frame * CELL, 0, CELL, CELL,
      -WORLD_SIZE / 2, -WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE);
    c.restore();
  }

  Art.fighter = fighter;
  Art.actionAtlas = {
    frameCount: FRAMES,
    get size() { return sheets.size; },
    clear() { sheets.clear(); },
    sheets() { return [...sheets].map(([key, value]) => ({key, canvas: value.canvas})); },
  };
})();
