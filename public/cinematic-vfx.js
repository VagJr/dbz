"use strict";
// Lights are painted once. Effects use a bounded pool, never per-frame blur.
(() => {
  const rings = [],
    particles = [],
    lights = new Map(),
    TAU = Math.PI * 2;
  const palette = {
    gold: "#ffd17a",
    blue: "#78e7ff",
    red: "#ff7b94",
    white: "#f1fbff",
  };
  for (const [key, color] of Object.entries(palette)) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d"),
      g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "#ffffffed");
    g.addColorStop(0.15, color + "bb");
    g.addColorStop(0.45, color + "44");
    g.addColorStop(1, color + "00");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    lights.set(key, cv);
  }
  let now = 0;
  const kinds = new Set([
    "hit",
    "parry",
    "cast",
    "slash",
    "dash",
    "dodge",
    "collisionBurst",
    "clashPulse",
    "transform",
  ]);
  function effect(e, renderer) {
    if (!kinds.has(e.type) || !Number.isFinite(e.x) || !Number.isFinite(e.y))
      return false;
    const heavy = e.heavy || e.combo === 3 || e.type === "collisionBurst";
    const key = ["parry", "cast", "dash", "dodge", "clashPulse"].includes(
      e.type,
    )
      ? "blue"
      : "gold";
    const life = e.type === "transform" ? 0.85 : heavy ? 0.58 : 0.34;
    if (rings.length >= 48) rings.shift();
    rings.push({
      ...e,
      key,
      heavy,
      born: performance.now() / 1000,
      life,
      radius: e.radius || (e.type === "transform" ? 220 : heavy ? 100 : 48),
    });
    if (
      renderer.reduced ||
      ["slash", "dash", "dodge", "clashPulse"].includes(e.type)
    )
      return true;
    const count = heavy ? 22 : e.type === "parry" ? 12 : 8;
    for (let i = 0; i < count && particles.length < 320; i++) {
      const a = (i / count) * TAU + Math.random() * 0.32,
        speed = (heavy ? 280 : 150) * (0.5 + Math.random());
      particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        age: 0,
        life: 0.2 + Math.random() * 0.32,
        key,
        size: 1.2 + Math.random() * 2.4,
        debris: heavy && i % 3 === 0,
      });
    }
    if (heavy && !renderer.reduced)
      renderer.shake = Math.max(renderer.shake, 4);
    return true;
  }
  window.UZVFX = {
    effect,
    clear() {
      rings.length = 0;
      particles.length = 0;
      window.UZManga?.clear();
    },
    intent(action, p, renderer) {
      // Anticipation light gives feedback; confirmed contact comes from server.
      if (action === "blastStart")
        effect(
          {
            type: "clashPulse",
            x: p.x + Math.cos(p.angle) * 24,
            y: p.y + Math.sin(p.angle) * 24,
          },
          renderer,
        );
    },
    draw(renderer, t) {
      const dt = Math.max(0, Math.min(0.05, t - (now || t)));
      now = t;
      const c = renderer.c,
        dpr = Math.min(devicePixelRatio || 1, 2),
        zoom = renderer.zoom || 0.72;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(innerWidth / 2, innerHeight / 2);
      c.scale(zoom, zoom);
      c.translate(-renderer.cam.x, -renderer.cam.y);
      for (let i = rings.length - 1; i >= 0; i--) {
        const e = rings[i],
          age = t - e.born;
        if (age > e.life || age < 0) {
          rings.splice(i, 1);
          continue;
        }
        const f = age / e.life,
          alpha = 1 - f,
          r = e.radius * (0.2 + 0.8 * (1 - (1 - f) ** 3));
        c.save();
        c.translate(e.x, e.y);
        c.globalAlpha = alpha;
        if (
          Math.abs(e.x - renderer.cam.x) > innerWidth / zoom / 2 + 250 ||
          Math.abs(e.y - renderer.cam.y) > innerHeight / zoom / 2 + 250
        ) {
          c.restore();
          continue;
        }
        if (!renderer.reduced && age < 0.2) {
          const size = (e.heavy ? 180 : 90) * (1 + f);
          c.globalCompositeOperation = "lighter";
          c.drawImage(lights.get(e.key), -size / 2, -size / 2, size, size);
          c.globalCompositeOperation = "source-over";
        }
        c.strokeStyle = palette[e.key];
        c.lineWidth = Math.max(0.7, (e.heavy ? 5 : 2.5) * alpha);
        c.beginPath();
        if (e.type === "slash") {
          c.rotate(e.angle || 0);
          c.arc(0, 0, r, -1.1, 1.1);
        } else if (e.type === "dash" || e.type === "dodge") {
          c.rotate(e.angle || 0);
          c.moveTo(-r * 2, 0);
          c.lineTo(18, 0);
        } else
          c.ellipse(
            0,
            0,
            r,
            r * (e.type === "transform" ? 0.38 : 0.8),
            0,
            0,
            TAU,
          );
        c.stroke();
        if (e.type === "hit" && age < 0.12) {
          c.rotate((e.angle || 0) + 0.4);
          c.fillStyle = "#fff9df";
          c.beginPath();
          for (let j = 0; j < 16; j++) {
            const a = (j * TAU) / 16,
              s = j % 2 ? 5 : r * 0.8;
            c.lineTo(Math.cos(a) * s, Math.sin(a) * s);
          }
          c.closePath();
          c.fill();
        }
        if ((e.amount || e.text) && !window.UZManga) {
          c.globalAlpha = Math.min(1, alpha * 2);
          c.font = `800 ${e.amount ? (e.heavy ? 27 : 21) : 12}px sans-serif`;
          c.textAlign = "center";
          c.lineWidth = 3;
          c.strokeStyle = "#081222";
          const text = String(e.amount || e.text);
          c.strokeText(text, 0, -38 - f * 44);
          c.fillStyle = e.heavy ? "#ffda83" : "#f4fdff";
          c.fillText(text, 0, -38 - f * 44);
        }
        c.restore();
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age > p.life) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-3 * dt);
        p.vy += p.debris ? 240 * dt : 0;
        c.globalAlpha = 1 - p.age / p.life;
        c.strokeStyle = palette[p.key];
        c.fillStyle = p.debris ? "#cfa276" : palette[p.key];
        c.lineWidth = p.size;
        if (p.debris) c.fillRect(p.x, p.y, p.size * 2, p.size * 1.4);
        else {
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
          c.stroke();
        }
      }
      c.restore();
      window.UZManga?.draw(renderer, t);
    },
  };
})();
