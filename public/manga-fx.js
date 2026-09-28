"use strict";
// Printed-ink character strips and a small combat lettering atlas. All artwork
// stays client-side; the server only sends combat events and technique names.
(() => {
  const notes = [], panels = [], images = new Map();
  let lastBasicCast = -Infinity;
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
  const upper = (value, limit = 38) => String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR").slice(0, limit);
  function techniqueName(e) {
    return upper(e.techniqueName || techniqueNames[e.technique] || "Disparo de ki", 28);
  }
  function sound(e) {
    const n = Number(e.id) || 0;
    switch (e.type) {
      case "hit":
        if (e.projectile) return e.heavy ? "BOOOOM!!!" : "BAMMM!!";
        if (e.heavy || e.combo >= 3) return "SMMSHH!!!";
        return e.combo === 2 || n % 3 === 0 ? "PUNCHHH!!" : "THWACK!!";
      case "cast": return e.charged ? "AHHHHH!!!" : "HAAAH!!";
      case "transform": return "AAAAHHHH!!!";
      case "parry": return "CLANG!!";
      case "break": return "KRAAASH!!";
      case "guard": return "THUD!!";
      case "dodge": return "FWOOSH!!";
      case "collisionBurst": return "BOOOOM!!!";
      case "enemyAttack": return e.counter ? "HAAH!!" : "HYAAH!!";
      case "slash": return e.combo === 3 ? "PUNCHHH!!" : "";
      default: return "";
    }
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
  function effect(e) {
    const hasPosition = Number.isFinite(e.x) && Number.isFinite(e.y);
    if (!hasPosition) return false;
    const now = performance.now() / 1000;
    const trainingText = /^(BOM TIMING|BUSQUE O RITMO|TREINO CONCLUÍDO)/.test(e.text || "");
    const letter = trainingText ? upper(e.text, 28) : sound(e);
    const atlasWord = !trainingText && !!window.UZMangaWords?.spawn(e);
    const detail = e.type === "hit" && Number.isFinite(e.amount) ? String(e.amount)
      : e.type === "cast" && (!atlasWord || e.technique === "ki") ? techniqueName(e)
        : !atlasWord && ["transform", "parry", "break", "guard", "dodge"].includes(e.type)
          ? upper(e.text, 27) : "";
    const noteLetter = atlasWord ? "" : letter;
    if ((noteLetter || detail) && !notes.some((n) => n.type === e.type && n.letter === noteLetter && now - n.born < .1 && Math.hypot(n.x - e.x, n.y - e.y) < 24)) {
      if (notes.length >= 28) notes.shift();
      notes.push({ ...e, letter: noteLetter, detail, sprite: atlasWord,
        born: now, life: e.type === "hit" ? .92 : 1.1 });
    }
    const basicCast = e.type === "cast" && (e.technique === "ki" || !e.technique);
    const dramatic = (e.type === "cast" && (!basicCast || e.charged || now - lastBasicCast > 3)) ||
      ["transform", "collisionBurst"].includes(e.type) ||
      e.type === "hit" && e.heavy || e.type === "slash" && e.combo === 3 ||
      e.type === "enemyAttack" && e.counter;
    if (dramatic && e.skin && !reduced.matches) {
      // Reserve large panels for major moves; short attacks keep the battlefield clear.
      const priority = e.type === "cast" || e.type === "transform" ? 3 : e.type === "hit" && e.heavy ? 2 : 1;
      const current = panels[0];
      const art = artFor(e.skin);
      if (art && (!current || now - current.born > current.life * .68 || priority > current.priority && now - current.born > .16)) {
        panels.length = 0;
        panels.push({ ...e, label: panelLabel(e), priority,
          art, born: now, life: 1.2 });
        if (basicCast) lastBasicCast = now;
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
      const x = W / 2 + (n.x - renderer.cam.x) * zoom;
      const y = H / 2 + (n.y - renderer.cam.y) * zoom - 38 - f * 55 - (n.sprite ? 52 : 0);
      if (x < -130 || x > W + 130 || y < -80 || y > H + 50) continue;
      const label = n.letter;
      const size = n.type === "hit" ? n.heavy ? 35 : 28 : label.length > 18 ? 20 : 29;
      c.save();
      c.translate(x + (reduced.matches ? 0 : Math.sin(f * 15) * 1.8), y);
      c.rotate(n.heavy ? -.11 : -.04);
      c.font = `900 ${size}px Impact, 'Barlow Condensed', sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const measured = c.measureText(label).width;
      const width = Math.min(220, measured);
      c.scale(Math.min(1, 220 / Math.max(1, measured)), 1);
      c.globalAlpha = Math.min(1, (1 - f) * 2.2);
      c.lineJoin = "round";
      if (label) {
        c.strokeStyle = page; c.lineWidth = 7;
        c.strokeText(label, 0, -size * .36);
        c.strokeStyle = ink; c.lineWidth = 1.5;
        c.strokeText(label, 0, -size * .36);
        c.fillStyle = ink;
        c.fillText(label, 0, -size * .36);
      }
      if (n.detail && n.detail !== label) {
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
      const w = Math.min(430, W - 30);
      const h = Math.min(102, Math.max(78, H * .11));
      const x = (W - w) / 2;
      const y = W >= 960 ? 116 : W >= 680 ? 226 : 190;
      c.save();
      c.globalAlpha = Math.min(1, f * 9, (1 - f) * 5);
      c.translate(x - (1 - f) * 28, y);
      c.rotate(-.012);
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
      c.font = `900 ${p.label.length > 19 ? 15 : p.label.length > 13 ? 18 : 23}px Impact, 'Barlow Condensed', sans-serif`;
      c.textAlign = "right"; c.textBaseline = "middle";
      c.fillText(p.label, w - 11, h * .79, w * .39);
      c.restore();
    }
    c.restore();
  }
  window.UZManga = { effect, draw, clear() {
    notes.length = 0; panels.length = 0; window.UZMangaWords?.clear();
  } };
})();
