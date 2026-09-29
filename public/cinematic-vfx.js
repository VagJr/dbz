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
    const fromCameraX = e.x - (renderer.cam?.x || 0);
    const fromCameraY = e.y - (renderer.cam?.y || 0);
    const direction = Number.isFinite(e.angle) ? e.angle :
      Math.hypot(fromCameraX, fromCameraY) > 18 ? Math.atan2(fromCameraY, fromCameraX) :
        (e.id || 0) % 2 ? -0.35 : Math.PI + 0.35;
    const life = e.type === "transform" ? 0.85 :
      e.type === "hit" ? heavy ? 0.30 : 0.20 : e.type === "slash" ? .20 : heavy ? 0.48 : 0.28;
    const radius = e.type === "hit" ? heavy ? 30 : 17 : e.type === "slash" ? heavy ? 31 : 22 :
      e.type === "parry" ? 25 : e.type === "cast" ? 24 : e.type === "transform" ? 180 :
      e.type === "collisionBurst" ? Math.min(150, e.radius || 100) : 34;
    // Several enemies can land on the same contact point. Keep one readable
    // impact per instant rather than compounding white flashes over the body.
    const born = performance.now() / 1000;
    if (e.type === "hit") {
      const nearby = rings.find(v => v.type === "hit" && born - v.born < .055 && Math.hypot(v.x - e.x, v.y - e.y) < 18);
      if (nearby) { nearby.heavy ||= heavy; return true; }
    }
    if (rings.length >= 28) rings.shift();
    rings.push({
      ...e,
      key,
      heavy,
      direction,
      born,
      life,
      radius,
    });
    if (
      renderer.reduced ||
      ["slash", "dash", "dodge", "clashPulse"].includes(e.type)
    )
      return true;
    const count = e.type === "hit" ? heavy ? 7 : 3 : heavy ? 14 : e.type === "parry" ? 6 : 5;
    for (let i = 0; i < count && particles.length < 160; i++) {
      const a = e.type === "hit"
          ? direction + (i / Math.max(1, count - 1) - 0.5) * 1.2 + (Math.random() - 0.5) * 0.22
          : (i / count) * TAU + Math.random() * 0.32,
        speed = (e.type === "hit" ? heavy ? 125 : 90 : heavy ? 200 : 120) * (0.5 + Math.random());
      particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        age: 0,
        life: e.type === "hit" ? .10 + Math.random() * .14 : 0.2 + Math.random() * .22,
        key,
        size: .8 + Math.random() * 1.2,
        debris: e.type === "collisionBurst" && i % 3 === 0,
      });
    }
    if (heavy && !renderer.reduced)
      renderer.shake = Math.max(renderer.shake, e.type === "collisionBurst" ? 5 : 2.3);
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
            y: p.y - (p.z || 0) + Math.sin(p.angle) * 24,
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
        if (!renderer.reduced && e.type !== "slash" && age < (e.type === "hit" ? 0.07 : 0.15)) {
          const size = (e.type === "hit" ? e.heavy ? 39 : 24 : e.type === "transform" ? 110 : e.heavy ? 80 : 39) * (1 + f * .25);
          c.globalCompositeOperation = "lighter";
          if (e.type === "hit") {
            c.save();
            c.rotate(e.direction);
            c.globalAlpha *= 0.36;
            c.drawImage(lights.get(e.key), -size * .25, -size * .23, size, size * .46);
            c.restore();
          } else c.drawImage(lights.get(e.key), -size / 2, -size / 2, size, size);
          c.globalCompositeOperation = "source-over";
        }
        c.strokeStyle = palette[e.key];
        c.lineWidth = Math.max(0.7, (e.heavy ? 2.1 : 1.2) * alpha);
        c.beginPath();
        if (e.type === "slash") {
          c.rotate(e.angle || 0);
          c.arc(0, 0, r, -1.1, 1.1);
        } else if (e.type === "dash" || e.type === "dodge") {
          c.rotate(e.angle || 0);
          c.moveTo(-r * 2, 0);
          c.lineTo(18, 0);
        } else if (e.type === "hit") {
          c.rotate(e.direction);
          // Open brush strokes read as contact. They never encircle a fighter.
          for (const side of [-1, 1]) {
            c.moveTo(1 + r * .2, side * r * .12);
            c.quadraticCurveTo(r * .65, side * r * .42, r * 1.08, side * r * .30);
          }
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
        if (e.type === "hit" && age < 0.08) {
          // A narrow, offset spark marks the hand's contact and leaves the
          // fighter's body readable through fast chains of punches.
          c.fillStyle = "#fff9df";
          c.beginPath();
          for (let j = 0; j < 8; j++) {
            const a = (j * TAU) / 8,
              s = j % 2 ? 1.3 : e.heavy ? 7 : 4;
            c.lineTo(Math.cos(a) * s, Math.sin(a) * s * .65);
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
