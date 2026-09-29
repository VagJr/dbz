"use strict";
// Printed-ink character strips and a small combat lettering atlas. All artwork
// stays client-side; the server only sends combat events and technique names.
(() => {
  const notes = [], panels = [], images = new Map();
  let lastPanelAt = -Infinity;
  const page = "#f7f3e8", ink = "#111923";
  const stripSources = {
    goku: "/assets/manga/goku-strike.jpg",
    krillin: "/assets/manga/krillin-strike.jpg",
    piccolo: "/assets/manga/piccolo-cast.jpg",
    buu: "/assets/manga/buu-strike.jpg",
    vegeta: "/assets/manga/vegeta-strike.jpg",
    frieza: "/assets/manga/frieza-cast.jpg",
    cell: "/assets/manga/cell-counter.jpg",
    trunks: "/assets/manga/trunks-slash.jpg",
  };
  const techniqueNames = {
    ki: "Disparo de ki", kame: "Kamehameha", makan: "Makankosappo",
    galick: "Galick Ho", genki: "Genki Dama", divine: "Ki divino",
    weave: "Ruptura de ki",
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 600px)");
  const topPanels = [...document.querySelectorAll("#hud .player-card, #hud .radar-card, #flight-button, #hud .target-card, #hud .quest-card, #hud .nav-telemetry, .topbar .location")];
  function panelLayout() {
    const W = innerWidth, H = innerHeight, compact = mobile.matches;
    const landscape = W > H;
    let w = compact ? Math.min(landscape ? W * .30 : W * .64, 260) : Math.min(W * .31, 410);
    let h = w * 54 / 240;
    const x = 10;
    let y = compact ? 10 : Math.max(76, Math.min(100, H * .1));
    const boundsList = topPanels.map(panel => panel.getBoundingClientRect()).filter(bounds => bounds.width && bounds.height);
    for (const bounds of boundsList)
      if (bounds.bottom < H * .42 && bounds.right > x && bounds.left < x + w)
        y = Math.max(y, bounds.bottom + 10);
    // Very short screens have no spare lane below the HUD. Do not paint a
    // cinematic panel across the fighters or mobile action controls.
    const available = y + h < H * .43;
    return { W, H, w, h, x, y, available };
  }
  const upper = (value, limit = 38) => String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR").slice(0, limit);
  function techniqueName(e) {
    return upper(e.techniqueName || techniqueNames[e.technique] || "Disparo de ki", 28);
  }
  function panelLabel(e) {
    if (e.type === "cast") return techniqueName(e) + "!";
    if (e.type === "transform") return upper(e.text && e.text.length < 23 ? e.text : "DESPERTAR", 26) + "!";
    if (e.type === "collisionBurst") return "BOOOOM!!!";
    if (e.type === "enemyAttack") return "CONTRA-ATAQUE!!";
    if (e.type === "slash") return "COMBO FINAL!!";
    return "SMMSHH!!!";
  }
  function artFor(skin) {
    const source = stripSources[skin] || window.UZPortrait?.source(skin);
    if (!source) return null;
    if (images.has(source)) return images.get(source);
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    const art = { image, generated: !!stripSources[skin] };
    images.set(source, art);
    return art;
  }
  for (const skin of ["goku", "krillin", "piccolo", "buu"]) artFor(skin);
  function effect(e, renderer) {
    const hasPosition = Number.isFinite(e.x) && Number.isFinite(e.y);
    if (!hasPosition) return false;
    const now = performance.now() / 1000;
    const trainingText = /^(BOM TIMING|BUSQUE O RITMO|TREINO CONCLUÍDO)/.test(e.text || "");
    const letter = trainingText ? upper(e.text, 28) : "";
    const atlasWord = !trainingText && !!window.UZMangaWords?.spawn(e, renderer);
    const stateText = e.type === "break" && /GUARDA|RUPTURA/.test(e.text || "")
      ? "GUARDA QUEBRADA" : e.type === "parry" && /PERFEITO|CONTRA|ESQUIVA PRECISA/.test(e.text || "")
        ? upper(e.text, 21) : "";
    const detail = e.type === "hit" && Number.isFinite(e.amount) ? String(e.amount)
      : stateText;
    const noteLetter = letter;
    const nearby = e.type === "hit" && notes.find(n => n.type === "hit" && now - n.born < .22 && Math.hypot(n.x - e.x, n.y - e.y) < 38);
    if (nearby && Number.isFinite(e.amount)) {
      nearby.amount += e.amount;
      nearby.detail = String(nearby.amount);
      nearby.heavy ||= e.heavy;
      nearby.x = e.x; nearby.y = e.y;
    } else if ((noteLetter || detail) && !notes.some((n) => n.type === e.type && n.letter === noteLetter && now - n.born < .1 && Math.hypot(n.x - e.x, n.y - e.y) < 24)) {
      if (notes.length >= 3) notes.shift();
      const side = renderer?.cam && Math.abs(e.x - renderer.cam.x) > 12 ? Math.sign(e.x - renderer.cam.x) : (Number(e.id) || 0) % 2 ? 1 : -1;
      notes.push({ ...e, letter: noteLetter, detail, sprite: atlasWord,
        side,
        born: now, life: e.type === "hit" ? .42 : .7 });
    }
    const basicCast = e.type === "cast" && (e.technique === "ki" || !e.technique);
    const dramatic = e.type === "transform" || e.type === "cast" && (!basicCast || e.charged);
    if (dramatic && e.skin && now - lastPanelAt > (mobile.matches ? 4.2 : 3.6)) {
      // A single strip accents techniques, finishers and counters without stacking.
      const priority = e.type === "transform" || e.charged ? 3 : e.type === "cast" ? 2 : 1;
      const current = panels[0];
      const art = artFor(e.skin);
      if (art && (!current || now - current.born > current.life * .68 || priority > current.priority && now - current.born > .16)) {
        panels.length = 0;
        panels.push({ ...e, label: panelLabel(e), priority,
          art, born: now, life: mobile.matches ? 1.15 : 1.4, layout: panelLayout() });
        lastPanelAt = now;
      }
    }
    return !!letter || !!detail || dramatic || atlasWord;
  }
  function draw(renderer, time) {
    const c = renderer.c, W = innerWidth, H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2), zoom = renderer.zoom || .72;
    c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i], f = (time - n.born) / n.life;
      if (f >= 1 || f < 0) { notes.splice(i, 1); continue; }
      const x = W / 2 + (n.x - renderer.cam.x) * zoom + n.side * (n.type === 'hit' ? (mobile.matches ? 55 : 69) : 65);
      const y = H / 2 + (n.y - renderer.cam.y) * zoom - 24 - f * 26;
      if (x < -130 || x > W + 130 || y < -80 || y > H + 50) continue;
      if (n.type === "hit" && (x < 12 || x > W - 12 || y < 100 || y > H - (mobile.matches ? 145 : 55))) continue;
      const label = n.letter;
      const size = n.type === "hit" ? 18 : label.length > 18 ? 14 : 19;
      c.save();
      c.translate(x + (reduced.matches ? 0 : Math.sin(f * 15) * 1.8), y);
      c.rotate(n.heavy ? -.11 : -.04);
      c.font = `900 ${size}px Impact, 'Barlow Condensed', sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const measured = c.measureText(label).width;
      const width = Math.min(220, measured);
      c.scale(Math.min(1, 220 / Math.max(1, measured)), 1);
      c.globalAlpha = .78 * Math.min(1, (1 - f) * 2.2);
      c.lineJoin = "round";
      if (label) {
        c.strokeStyle = page; c.lineWidth = 4;
        c.strokeText(label, 0, -size * .36);
        c.strokeStyle = ink; c.lineWidth = 1.5;
        c.strokeText(label, 0, -size * .36);
        c.fillStyle = ink;
        c.fillText(label, 0, -size * .36);
      }
      if (n.detail && n.detail !== label) {
        if (n.type === 'hit') {
          c.font = `900 ${n.heavy ? 16 : 13}px Impact, 'Barlow Condensed', sans-serif`;
          c.strokeStyle = ink;
          c.lineWidth = 3;
          c.strokeText(n.detail, 0, 0);
          c.fillStyle = n.heavy ? '#ffe09b' : page;
          c.fillText(n.detail, 0, 0);
          c.restore();
          continue;
        }
        c.font = "900 11px 'Barlow Condensed', sans-serif";
        const detailWidth = Math.min(205, c.measureText(n.detail).width + 14);
        const detailY = n.sprite ? 0 : size * .2;
        c.fillStyle = page; c.strokeStyle = ink; c.lineWidth = 1.4;
        c.fillRect(-detailWidth / 2, detailY, detailWidth, 17);
        c.strokeRect(-detailWidth / 2, detailY, detailWidth, 17);
        c.fillStyle = ink;
        c.fillText(n.detail, 0, detailY + 8.5, detailWidth - 7);
      }
      if (label && (n.heavy || n.type === "cast") && !reduced.matches) {
        c.strokeStyle = ink; c.lineWidth = 1.35;
        for (let ray = 0; ray < 6; ray++) {
          const a = -.65 + ray * .27;
          const xx = Math.cos(a) * (width / 2 + 5);
          const yy = -size * .4 + Math.sin(a) * 13;
          c.beginPath(); c.moveTo(xx, yy);
          c.lineTo(xx + Math.cos(a) * (10 + 12 * f), yy + Math.sin(a) * (10 + 12 * f)); c.stroke();
        }
      }
      c.restore();
    }
    window.UZMangaWords?.draw(renderer, time);
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i], f = (time - p.born) / p.life;
      if (f >= 1 || f < 0) { panels.splice(i, 1); continue; }
      const art = p.art;
      if (!art.image.complete || !art.image.naturalWidth) continue;
      if (!p.layout || p.layout.W !== W || p.layout.H !== H) p.layout = panelLayout();
      const { w, h, x, y, available } = p.layout;
      if (!available) continue;
      const scale = h / 54;
      const enter = reduced.matches ? 1 : Math.min(1, f * 8);
      c.save();
      c.globalAlpha = .94 * Math.min(1, f * 10, (1 - f) * 6);
      c.translate(x - (1 - enter) * w, y - (1 - enter) * 6);
      c.fillStyle = page; c.fillRect(-3, -3, w + 6, h + 6);
      c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
      if (art.generated) {
        const cropH = Math.min(art.image.naturalHeight, art.image.naturalWidth * h / w);
        const sourceY = (art.image.naturalHeight - cropH) / 2;
        c.drawImage(art.image, 0, sourceY, art.image.naturalWidth, cropH, 0, 0, w, h);
      } else {
        c.fillStyle = page; c.fillRect(0, 0, w, h);
        c.save(); c.filter = "grayscale(1) contrast(1.45)";
        c.drawImage(art.image, 0, -h * .14, h * 1.25, h * 1.25);
        c.restore();
        c.strokeStyle = ink; c.lineWidth = 1;
        for (let line = 0; line < 18; line++) {
          c.beginPath(); c.moveTo(h * 1.2, (line * 39) % h);
          c.lineTo(w, h * .5 + ((line * 21) % h - h / 2) * .45); c.stroke();
        }
      }
      c.restore();
      c.fillStyle = ink;
      c.beginPath(); c.moveTo(w * .63, h * .55); c.lineTo(w, h * .31);
      c.lineTo(w, h); c.lineTo(w * .57, h); c.closePath(); c.fill();
      c.strokeStyle = ink; c.lineWidth = 2.4; c.strokeRect(0, 0, w, h);
      c.fillStyle = page;
      c.font = `900 ${(p.label.length > 19 ? 10 : p.label.length > 13 ? 12 : 15) * scale}px Impact, 'Barlow Condensed', sans-serif`;
      c.textAlign = "right"; c.textBaseline = "middle";
      c.fillText(p.label, w - 11 * scale, h * .79, w * .39);
      c.restore();
    }
    c.restore();
  }
  window.UZManga = { effect, draw, clear() {
    notes.length = 0; panels.length = 0; window.UZMangaWords?.clear();
    lastPanelAt = -Infinity;
  } };
})();
