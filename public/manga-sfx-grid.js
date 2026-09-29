"use strict";
// 7x7 editable SVG atlas. Every combat word remains a separate sfx-XX group.
(() => {
  const CELL_W = 240;
  const CELL_H = 120;
  const COLS = 7;
  const MAX_ACTIVE = 3;
  const active = [];
  let lastWordAt = -Infinity;
  const atlas = new Image();
  let ready = false;
  atlas.decoding = "async";
  atlas.onload = () => { ready = atlas.naturalWidth === CELL_W * COLS && atlas.naturalHeight === CELL_H * COLS; };
  atlas.src = "/assets/manga/onomatopoeia-grid.svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  // Indexes follow the SVG's left-to-right, top-to-bottom cells (0–48).
  const lightHits = [1, 3, 4, 14, 15, 21, 22, 23, 42, 47, 48];
  const heavyHits = [2, 5, 6, 16, 17, 18, 19, 24, 32, 42];
  const energyHits = [6, 12, 13, 18, 31, 32, 33, 48];
  const yells = [0, 7, 8, 9, 10, 34, 35, 36, 38];
  const techniques = {
    kame: 39,
    kamehameha: 39,
    galick: 40,
    "galick ho": 40,
    masenko: 41,
  };
  const pick = (arr, salt) => arr[Math.abs(salt) % arr.length];
  function wordFor(e, salt) {
    const type = e.type;
    if (type === "hit") {
      if (e.projectile || e.technique) return pick(energyHits, salt);
      return pick(e.heavy || e.combo >= 3 ? heavyHits : lightHits, salt);
    }
    if (type === "cast") {
      const name = String(e.technique || e.techniqueName || "").toLowerCase();
      return techniques[name] ?? pick(yells, salt);
    }
    if (type === "transform") return pick(yells, salt);
    if (type === "enemyAttack") return e.counter ? 43 : pick([7, 8, 9, 35], salt);
    if (type === "parry") return pick([20, 45], salt);
    if (type === "guard") return 23;
    if (type === "break") return 44;
    if (type === "dodge" || type === "dash") return pick([11, 26, 27, 29], salt);
    if (type === "slash") return pick(e.combo >= 3 ? heavyHits : lightHits, salt);
    if (type === "collisionBurst" || type === "clashPulse") return pick([6, 17, 18, 19, 32], salt);
    return -1;
  }

  function spawn(e, renderer) {
    if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return false;
    const born = performance.now() / 1000;
    const salt = (Number(e.id) || 0) + (Number(e.amount) || 0) + (Number(e.combo) || 0) * 13 + Math.round(e.x + e.y);
    const index = wordFor(e, salt);
    if (index < 0) return false;
    const heavy = !!e.heavy || e.type === "collisionBurst" || e.type === "break" || e.combo >= 3;
    // A handled-but-skipped word must not spawn a larger fallback in manga-fx.
    if (!ready || ["dash", "guard", "clashPulse"].includes(e.type) ||
        e.type === "slash" && e.combo < 3 ||
        e.type === "enemyAttack" && !e.counter) return true;
    // Alternating light impacts give the fight manga punctuation without a
    // letter on every punch. Heavy blows and counters remain guaranteed.
    if (e.type === 'hit' && !heavy && Math.abs(salt) % 2 !== 0) return true;
    if (e.type === 'cast' && (!e.technique || e.technique === 'ki') && !e.charged) return true;
    const lifetime = reduced.matches ? .55 : heavy ? .58 : .44;
    for (let i = active.length - 1; i >= 0; i--)
      if (born - active[i].born >= active[i].life) active.splice(i, 1);
    if (born - lastWordAt < (heavy ? .32 : .39) || active.length >= (innerWidth < 760 ? 2 : MAX_ACTIVE)) return true;
    if (active.some(v => born - v.born < .52 && Math.hypot(v.x - e.x, v.y - e.y) < 260)) return true;
    lastWordAt = born;
    const side = renderer?.cam && Math.abs(e.x - renderer.cam.x) > 35
      ? e.x >= renderer.cam.x ? 1 : -1 : salt % 2 ? 1 : -1;
    active.push({
      index, type: e.type, x: e.x, y: e.y, born,
      life: lifetime,
      heavy,
      side,
      offset: (salt % 3 - 1) * 5,
    });
    return true;
  }

  function draw(renderer, time) {
    if (!ready || !renderer?.c || !renderer.cam) return;
    const c = renderer.c;
    const W = innerWidth;
    const H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const zoom = renderer.zoom || .72;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = active.length - 1; i >= 0; i--) {
      const item = active[i];
      const f = (time - item.born) / item.life;
      if (f >= 1 || f < 0) { active.splice(i, 1); continue; }
      const baseX = W / 2 + (item.x - renderer.cam.x) * zoom;
      const baseY = H / 2 + (item.y - renderer.cam.y) * zoom;
      if (baseX < -150 || baseX > W + 150 || baseY < -110 || baseY > H + 110) continue;
      const travel = reduced.matches ? 0 : item.side * 30 * f;
      let x = baseX + item.side * (item.heavy ? 96 : 80) + item.offset + travel;
      let y = baseY - 28 - (reduced.matches ? 0 : 18 * f);
      const narrow = W < 760;
      const width = Math.min(narrow ? item.heavy ? 74 : 62 : item.heavy ? 92 : 76, W * .19);
      const height = width * CELL_H / CELL_W;
      // Keep the small lettering in the fighting area, clear of status HUD corners.
      // Do not clamp a world effect into the player's central viewing area.
      if (x < width / 2 + 7 || x > W - width / 2 - 7 ||
          y < (narrow ? 105 : 80) || y > H - (narrow ? 165 : 85)) continue;
      if (!narrow && (x < 315 && y < 163 || x > W - 230 && y < 135)) continue;
      if (Math.abs(x - W / 2) < 58 && Math.abs(y - H / 2) < 72) {
        x += item.side * 95;
        if (x < width / 2 + 7 || x > W - width / 2 - 7) continue;
      }
      const pop = reduced.matches ? 1 : f < .16 ? .77 + f / .16 * .23 : 1 - Math.max(0, f - .61) * .18;
      c.save();
      c.translate(x, y);
      if (!reduced.matches) c.rotate(item.side * (-.07 + f * .12));
      c.scale(pop, pop);
      c.globalAlpha = .76 * Math.min(1, f * 9, (1 - f) * 3.4);
      if (!reduced.matches && f < .55) {
        c.strokeStyle = "#f8f7f1";
        c.lineWidth = 1.4;
        c.beginPath();
        const trail = -item.side * (width / 2 + 5);
        c.moveTo(trail, -7); c.lineTo(trail - item.side * (14 + 12 * f), -7);
        c.moveTo(trail + item.side * 7, 9); c.lineTo(trail - item.side * (8 + 10 * f), 9);
        c.stroke();
      }
      c.drawImage(atlas, (item.index % COLS) * CELL_W, Math.floor(item.index / COLS) * CELL_H,
        CELL_W, CELL_H, -width / 2, -height / 2, width, height);
      c.restore();
    }
    c.restore();
  }

  window.UZMangaWords = { spawn, draw, clear() { active.length = 0; lastWordAt = -Infinity; } };
})();
