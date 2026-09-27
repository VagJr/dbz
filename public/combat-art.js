/* Overhead combat scene and procedural terrain. Character rigs live in character-art.js. */
(() => {
  const { ellipse, poly, line } = Art;
  function asteroid(c, o, w) {
    c.save();
    c.translate(o.x, o.y);
    const r = o.size * 0.72;
    ellipse(c, 6, 9, r, r * 0.8, "#00000065");
    poly(
      c,
      [
        [-r, -r * 0.2],
        [-r * 0.65, -r * 0.83],
        [r * 0.15, -r],
        [r * 0.85, -r * 0.52],
        [r, r * 0.3],
        [r * 0.35, r * 0.7],
        [-r * 0.68, r * 0.6],
      ],
      w.id === "demon" ? "#382d47" : "#283344",
    );
    poly(
      c,
      [
        [-r, -r * 0.2],
        [-r * 0.65, -r * 0.83],
        [r * 0.15, -r],
        [r * 0.85, -r * 0.52],
        [r * 0.05, -r * 0.43],
        [-r * 0.52, -r * 0.2],
      ],
      w.id === "demon" ? "#655077" : "#465367",
    );
    line(
      c,
      [
        [-r * 0.85, -r * 0.3],
        [-r * 0.62, -r * 0.65],
        [r * 0.1, -r * 0.82],
      ],
      "#6f819b70",
      1.2,
    );
    line(
      c,
      [
        [r * 0.1, -r * 0.2],
        [r * 0.34, r * 0.07],
        [r * 0.11, r * 0.36],
      ],
      "#121c2d",
      2,
    );
    c.restore();
  }
  function station(c, b, t) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.type === "house" ? 0.2 : 0);
    c.strokeStyle = "#36536d";
    c.lineWidth = 1.4;
    c.fillStyle = "#0c1b2bcc";
    c.beginPath();
    c.roundRect(-56, -47, 112, 94, 12);
    c.fill();
    c.stroke();
    c.fillStyle = "#162b3e";
    c.beginPath();
    c.roundRect(-44, -37, 88, 74, 20);
    c.fill();
    c.strokeStyle = "#51738a";
    c.stroke();
    line(
      c,
      [
        [-36, -24],
        [36, -24],
      ],
      "#42d5ea60",
      3,
    );
    line(
      c,
      [
        [-36, 24],
        [36, 24],
      ],
      "#42d5ea40",
      2,
    );
    c.strokeStyle = "#48d9ef88";
    c.beginPath();
    c.arc(0, 0, 19, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#89d9e5";
    c.font = "bold 17px sans-serif";
    c.textAlign = "center";
    c.fillText(
      b.type === "capsule" ? "C" : b.type === "house" ? "亀" : "✦",
      0,
      6,
    );
    ellipse(c, -47, -35, 2, 2, "#55e6d7");
    ellipse(c, 47, 35, 2, 2, "#ffaf54");
    c.restore();
    c.fillStyle = "#6e8caa";
    c.font = "9px 'DM Sans', sans-serif";
    c.textAlign = "center";
    c.fillText(b.label, b.x, b.y + 69);
  }
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.c = canvas.getContext("2d");
      this.cam = { x: 1700, y: 1740 };
      this.world = "earth";
      this.data = UZ.worldData(this.world);
      this.entities = new Map();
      this.effects = [];
      this.trails = [];
      this.shake = 0;
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.last = 0;
      this.stars = [];
      const rand = UZ.rng(172);
      for (let i = 0; i < 350; i++)
        this.stars.push({
          x: rand() * 2800,
          y: rand() * 1800,
          r: rand() * 1.1 + 0.3,
          z: rand() * 0.8 + 0.2,
          a: rand() * 0.5 + 0.15,
        });
      this.buildTerrain();
    }
    setWorld(id) {
      if (id === this.world) return;
      this.world = id;
      this.data = UZ.worldData(id);
      this.cam = { x: 1700, y: 1740 };
      this.entities.clear();
      this.effects = [];
      this.trails = [];
      this.buildTerrain();
    }
    buildTerrain() {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1700;
      const c = cv.getContext("2d");
      c.scale(0.5, 0.5);
      const w = this.data.world,
        tint =
          {
            earth: "#173643",
            namek: "#123e3b",
            vegeta: "#3b2632",
            future: "#202a44",
            otherworld: "#302750",
            demon: "#3f1741",
            vampa: "#383322",
            divine: "#30254e",
            arena: "#22253d",
          }[w.id] || "#222f45";
      const g = c.createRadialGradient(1700, 1700, 200, 1700, 1700, 1550);
      g.addColorStop(0, tint + "b0");
      g.addColorStop(0.65, tint + "65");
      g.addColorStop(1, tint + "00");
      c.fillStyle = g;
      c.fillRect(0, 0, 3400, 3400);
      c.strokeStyle = "#538ab329";
      c.lineWidth = 1;
      for (let r = 550; r <= 1400; r += 350) {
        c.setLineDash([3, 12]);
        c.beginPath();
        c.arc(1700, 1700, r, 0, Math.PI * 2);
        c.stroke();
      }
      c.setLineDash([]);
      c.strokeStyle = "#49c5e650";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(1700, 1700, 1050, 0.1, 6);
      c.stroke();
      c.strokeStyle = "#9ae2f440";
      c.lineWidth = 7;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(1700, 1700, 1050, (i * Math.PI) / 2, (i * Math.PI) / 2 + 0.055);
        c.stroke();
      }
      const rand = UZ.rng(w.seed + 24);
      for (let i = 0; i < 60; i++) {
        const x = rand() * 3400,
          y = rand() * 3400;
        if (
          Math.hypot(x - 1700, y - 1700) < 310 ||
          Math.hypot(x - 2260, y - 1330) < 260
        )
          continue;
        asteroid(c, { x, y, size: 35 + rand() * 80 }, w);
      }
      c.font = "600 20px 'DM Sans',sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#b1d9ed70";
      c.fillText(w.name.toUpperCase(), 1700, 585);
      c.font = "12px sans-serif";
      c.fillStyle = "#4a849daa";
      c.fillText(
        "UNIVERSO 7  /  " +
          (w.procedural ? "SETOR NÃO MAPEADO" : "ZONA DE EXPLORAÇÃO"),
        1700,
        615,
      );
      this.terrain = cv;
      const land = document.createElement("canvas");
      land.width = land.height = 1700;
      const gnd = land.getContext("2d");
      gnd.scale(0.5, 0.5);
      const palette = {
        earth: ["#12394a", "#294934", "#435a3e", "#74844d"],
        namek: ["#0c3b48", "#1d5144", "#39705c", "#3a8493"],
        vegeta: ["#28283a", "#57453d", "#85674d", "#795270"],
        future: ["#1a344a", "#33434a", "#536052", "#576d83"],
        vampa: ["#383b30", "#625c3f", "#82724c", "#9a8560"],
        divine: ["#302c49", "#55486b", "#7b6687", "#716f9e"],
        sadala: ["#243547", "#554439", "#806043", "#547889"],
      }[w.id] || ["#183344", "#3b493d", "#64724f", "#5f7480"];
      gnd.fillStyle = palette[0];
      gnd.fillRect(0, 0, 3400, 3400);
      const randLand = UZ.rng(w.seed + 286);
      const island = (x, y, rx, ry, fill, phase) => {
        gnd.save();
        gnd.translate(x, y);
        gnd.rotate(phase);
        gnd.fillStyle = "#00000024";
        gnd.beginPath();
        gnd.ellipse(8, 12, rx * 0.99, ry * 1.01, 0, 0, Math.PI * 2);
        gnd.fill();
        gnd.fillStyle = fill;
        gnd.beginPath();
        gnd.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        gnd.fill();
        gnd.strokeStyle = palette[2] + "bb";
        gnd.lineWidth = 22;
        gnd.beginPath();
        gnd.ellipse(0, -10, rx * 0.96, ry * 0.94, 0, -2.85, -0.35);
        gnd.stroke();
        gnd.restore();
      };
      island(1700, 1700, 1210, 950, palette[1], -0.17);
      island(2270, 1320, 360, 290, palette[2], 0.36);
      island(825, 1175, 330, 220, palette[1], -0.55);
      island(940, 2390, 370, 235, palette[2], 0.35);
      island(2530, 2330, 310, 260, palette[1], -0.5);
      // The paths link the spawn, Kame's dojo, Capsule Corp and the battle plain.
      gnd.strokeStyle = "#c7b77a66";
      gnd.lineWidth = 22;
      gnd.lineCap = "round";
      gnd.beginPath();
      gnd.moveTo(1700, 1750);
      gnd.bezierCurveTo(1580, 1640, 1555, 1575, 1430, 1510);
      gnd.bezierCurveTo(1605, 1430, 1740, 1475, 1830, 1470);
      gnd.bezierCurveTo(2040, 1390, 2140, 1325, 2260, 1330);
      gnd.stroke();
      const objects = this.data.objects;
      for (let oi = 0; oi < objects.length; oi += 2) {
        const o = objects[oi];
        if (
          Math.hypot(o.x - 1700, o.y - 1740) < 300 ||
          Math.hypot(o.x - 2260, o.y - 1330) < 230
        )
          continue;
        if (o.type === "tree") {
          const r = o.size * 0.68;
          const sway = randLand() * 0.35;
          ellipse(gnd, o.x + 4, o.y + 8, r * 0.92, r * 0.72, "#00000035");
          poly(
            gnd,
            [
              [-0.92, -0.2],
              [-0.75, -0.72],
              [-0.2, -0.92],
              [0.25, -0.8],
              [0.85, -0.45],
              [0.96, 0.12],
              [0.64, 0.62],
              [0.05, 0.82],
              [-0.48, 0.72],
              [-0.92, 0.26],
            ].map(([x, y]) => [
              o.x + x * r * (1 + sway),
              o.y + y * r * (1 - sway),
            ]),
            palette[3],
          );
          ellipse(
            gnd,
            o.x - r * 0.23,
            o.y - r * 0.2,
            r * 0.5,
            r * 0.31,
            palette[2],
          );
          ellipse(
            gnd,
            o.x + r * 0.28,
            o.y + r * 0.06,
            r * 0.33,
            r * 0.27,
            palette[3],
          );
          line(
            gnd,
            [
              [o.x + 1, o.y + r * 0.48],
              [o.x + 3, o.y + r * 0.76],
            ],
            "#70553a",
            3,
          );
        } else {
          asteroid(gnd, o, w);
        }
      }
      for (let i = 0; i < 46; i++) {
        const x = 430 + randLand() * 2540,
          y = 390 + randLand() * 2600,
          r = 24 + randLand() * 58;
        if (
          Math.hypot(x - 1700, y - 1740) < 240 ||
          Math.hypot(x - 2260, y - 1330) < 230
        )
          continue;
        ellipse(gnd, x + 5, y + 8, r, r * 0.6, "#00000042");
        ellipse(gnd, x, y, r, r * 0.55, palette[2]);
        ellipse(gnd, x - 4, y - r * 0.1, r * 0.63, r * 0.29, palette[3]);
      }
      gnd.font = "600 19px 'DM Sans',sans-serif";
      gnd.textAlign = "center";
      gnd.fillStyle = "#d9e8d48a";
      gnd.fillText(w.name.toUpperCase(), 1700, 1055);
      gnd.font = "11px sans-serif";
      gnd.fillStyle = "#d2d9c278";
      gnd.fillText(this.data.world.region.toUpperCase(), 1700, 1080);
      this.groundTerrain = land;
    }
    effect(e) {
      this.effects.push({ ...e, age: 0 });
      if (
        ["hit", "parry", "complete", "transform"].includes(e.type) &&
        !this.reduced
      )
        this.shake = e.heavy ? 5 : 2;
    }
    draw(state, input, t) {
      const c = this.c,
        W = innerWidth,
        H = innerHeight,
        dpr = Math.min(devicePixelRatio || 1, 2),
        dt = Math.min(0.05, t - this.last || 0.016);
      this.last = t;
      Art.reduceMotion = this.reduced;
      if (
        this.canvas.width !== Math.round(W * dpr) ||
        this.canvas.height !== Math.round(H * dpr)
      ) {
        this.canvas.width = Math.round(W * dpr);
        this.canvas.height = Math.round(H * dpr);
      }
      const me = state?.self;
      if (me) this.setWorld(me.world);
      this.zoom = (W < 760 ? 0.76 : 0.72) * (1 - (me?.altitude || 0) * 0.42);
      const zoom = this.zoom,
        target = me || { x: 1700, y: 1730 };
      this.cam.x += (target.x - this.cam.x) * Math.min(1, dt * 13);
      this.cam.y += (target.y - this.cam.y) * Math.min(1, dt * 13);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = c.createRadialGradient(
        W * 0.55,
        H * 0.4,
        50,
        W / 2,
        H / 2,
        W * 0.8,
      );
      bg.addColorStop(0, "#0a1223");
      bg.addColorStop(1, "#03050d");
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        const x = (((s.x - this.cam.x * s.z * 0.15) % W) + W) % W,
          y = (((s.y - this.cam.y * s.z * 0.15) % H) + H) % H;
        c.globalAlpha =
          s.a + (this.reduced ? 0 : Math.sin(t * 0.5 + s.x) * 0.08);
        ellipse(c, x, y, s.r, s.r, "#bfd9f8");
      }
      c.globalAlpha = 1;
      c.save();
      c.translate(
        W / 2 + (Math.random() - 0.5) * this.shake,
        H / 2 + (Math.random() - 0.5) * this.shake,
      );
      this.shake *= 0.83;
      c.scale(zoom, zoom);
      c.translate(-this.cam.x, -this.cam.y);
      if (Art.openTerrain) Art.openTerrain(c, this, me, t, W / zoom, H / zoom);
      else {
        if (Art.surface) Art.surface(c, this, me, t, W / zoom, H / zoom);
        c.drawImage(this.groundTerrain, 0, 0, 3400, 3400);
      }
      const map = this.data;
      c.strokeStyle = "#437f9e30";
      c.lineWidth = 1;
      c.setLineDash([6, 8]);
      c.beginPath();
      c.arc(1700, 1740, 250, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      for (const b of map.buildings)
        Art.landmark ? Art.landmark(c, b, this.world, t) : station(c, b, t);
      // High-contrast objects and objective markers retain the sparse original composition.
      if (this.world === "earth")
        for (const o of map.orbs) {
          if (me?.orbs.includes(o.id)) continue;
          c.shadowColor = "#ff9d00";
          c.shadowBlur = 14;
          ellipse(c, o.x, o.y, 10, 10, "#ffac28");
          c.shadowBlur = 0;
          c.fillStyle = "#ad3a15";
          c.font = "bold 9px sans-serif";
          c.textAlign = "center";
          c.fillText("★", o.x, o.y + 3);
        }
      const mentor = {
        id: "mentor",
        name: map.world.mentor,
        skin: map.world.skin,
        x: map.mentor.x,
        y: map.mentor.y,
        state: "idle",
        angle: Math.PI * 0.2,
      };
      const npc = [
        {
          id: "patrol",
          name: "Patrulha galáctica",
          skin: "trunks",
          x: 1880 + Math.sin(t * 0.17) * 100,
          y: 1690 + Math.cos(t * 0.17) * 60,
          state: "run",
          angle: t * 0.17 + Math.PI / 2,
        },
      ];
      const enemies = state?.enemies || [
        {
          id: "preview1",
          x: 2230,
          y: 1320,
          skin: "vegeta",
          name: "Rival saiyajin",
          angle: 2.7,
          state: "idle",
          hp: 120,
          maxHp: 120,
        },
        {
          id: "preview2",
          x: 1250,
          y: 2000,
          skin: "soldier",
          name: "Patrulheiro",
          angle: -0.6,
          state: "idle",
          hp: 120,
          maxHp: 120,
        },
      ];
      for (const e of enemies)
        if (e.state === "windup") {
          const ratio = Math.max(
            0,
            Math.min(1, (state.time - e.windupAt) / (e.attackAt - e.windupAt)),
          );
          c.save();
          c.translate(e.x, e.y);
          c.rotate(e.angle);
          c.strokeStyle = "#ff6565aa";
          c.fillStyle = "#ee3b4b18";
          c.lineWidth = 1.5;
          c.beginPath();
          if (e.pattern === "beam") c.rect(0, -55, 920, 110);
          else {
            c.moveTo(0, 0);
            c.arc(
              0,
              0,
              e.pattern === "rush" ? 280 : e.boss ? 160 : 85,
              e.pattern === "ring" ? 0 : -0.85,
              e.pattern === "ring" ? Math.PI * 2 : 0.85,
            );
            c.closePath();
          }
          c.fill();
          c.stroke();
          c.globalAlpha = ratio * 0.5;
          c.fillStyle = "#f96173";
          c.fill();
          c.restore();
        }
      this.trails = this.trails.filter((a) => a.age < 0.2);
      for (const a of this.trails) {
        a.age += dt;
        c.globalAlpha = (1 - a.age / 0.2) * 0.18;
        Art.fighter(c, a, t, a.scale);
        c.globalAlpha = 1;
      }
      const all = [
        mentor,
        ...npc,
        ...enemies,
        ...(state?.players || [
          {
            id: "preview",
            x: 1700,
            y: 1740,
            skin: "goku",
            name: "GUERREIRO Z",
            angle: -0.5,
            state: "charge",
            hp: 360,
            maxHp: 360,
          },
        ]),
      ];
      const ids = new Set();
      for (const e of all) {
        ids.add(e.id);
        if (
          Math.abs(e.x - this.cam.x) > W / zoom / 2 + 100 ||
          Math.abs(e.y - this.cam.y) > H / zoom / 2 + 100
        )
          continue;
        let p = this.entities.get(e.id);
        if (!p || Math.hypot(p.x - e.x, p.y - e.y) > 260)
          p = { x: e.x, y: e.y };
        const speed = e.id === me?.id ? 28 : 16;
        p.x += (e.x - p.x) * Math.min(1, dt * speed);
        p.y += (e.y - p.y) * Math.min(1, dt * speed);
        this.entities.set(e.id, p);
        const scale = e.boss ? 1.22 : 1;
        if (["run", "dash"].includes(e.state) && !this.reduced)
          this.trails.push({ ...e, ...p, scale, age: 0 });
        if (e.id === me?.id) {
          c.strokeStyle = "#3be1f69c";
          c.lineWidth = 1;
          c.beginPath();
          c.arc(p.x, p.y, 28, t * 0.4, t * 0.4 + 4.9);
          c.stroke();
        }
        if (e.mode === "flight" && e.id === me?.id) {
          const speed = Math.hypot(e.vx || 0, e.vy || 0);
          if (speed > 170) {
            c.save();
            c.translate(p.x, p.y);
            c.rotate(Math.atan2(e.vy, e.vx));
            const alpha = Math.min(0.72, (speed - 150) / 1450);
            c.globalAlpha = alpha;
            c.shadowColor = e.boosting ? "#fff0a2" : "#45dfff";
            c.shadowBlur = e.boosting ? 16 : 9;
            line(
              c,
              [
                [-25, -5],
                [-74 - speed * 0.075, -5],
              ],
              e.boosting ? "#ffe584" : "#56dafa",
              e.boosting ? 5 : 3,
            );
            line(
              c,
              [
                [-22, 3],
                [-53 - speed * 0.045, 3],
              ],
              "#eafaff",
              1.5,
            );
            line(
              c,
              [
                [-15, -12],
                [-42 - speed * 0.028, -12],
              ],
              "#41a8f6",
              1.4,
            );
            c.restore();
          }
        }
        Art.fighter(c, { ...e, ...p }, t, scale);
        if (e.id === "mentor") {
          c.shadowBlur = 10;
          c.shadowColor = "#ffb02f";
          this.label(c, "◇", e.x, e.y - 47, "#ffbd45", 18);
          c.shadowBlur = 0;
          this.label(c, e.name, e.x, e.y + 39, "#eac791", 11);
        } else if (e.name) {
          const tint = e.boss
            ? "#ff676f"
            : e.id === me?.id
              ? "#64e8fc"
              : e.id === "patrol"
                ? "#728aa5"
                : "#b1bbd1";
          c.save();
          c.translate(e.x + 22, e.y - 27);
          line(
            c,
            [
              [-13, 20],
              [0, 0],
              [76, 0],
            ],
            tint + "55",
            1,
          );
          c.textAlign = "left";
          c.font = "600 10px 'DM Sans',sans-serif";
          c.fillStyle = tint;
          c.fillText(e.name.slice(0, 20), 3, -7);
          if (e.hp !== undefined) {
            c.fillStyle = "#33496566";
            c.fillRect(3, 4, 61, 3);
            c.fillStyle =
              e.id === me?.id ? "#71edbc" : e.boss ? "#ff5271" : "#f4b450";
            c.fillRect(3, 4, (61 * e.hp) / e.maxHp, 3);
          }
          c.restore();
        }
      }
      for (const eid of this.entities.keys())
        if (!ids.has(eid)) this.entities.delete(eid);
      for (const s of state?.shots || []) {
        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.angle);
        const colors = {
          galick: ["#c768ff", "#fff1ff"],
          genki: ["#ffb74d", "#fff0ae"],
          divine: ["#7fe7ff", "#f3ffff"],
          makan: ["#8b95ff", "#ffffff"],
          kienzan: ["#a2ffbb", "#f5fff7"],
        };
        const [color, core] = colors[s.technique] || ["#29d8ff", "#e8faff"];
        c.shadowColor = color;
        c.shadowBlur = s.technique === "genki" ? 28 : 18;
        if (s.technique === "genki") {
          ellipse(c, 0, 0, s.r, s.r, color + "dd");
          ellipse(c, -s.r * 0.18, -s.r * 0.18, s.r * 0.58, s.r * 0.58, core);
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(0, 0, s.r * 1.45, s.r * 0.76, t * 4, 0.3, 5.5);
          c.stroke();
        } else {
          const travelled = Math.hypot(
              s.x - (s.originX ?? s.x),
              s.y - (s.originY ?? s.y),
            ),
            length = Math.min(travelled, s.r < 18 ? 32 : 520),
            width = s.r >= 18 ? 12 : 6;
          line(
            c,
            [
              [-length, 0],
              [0, 0],
            ],
            color + "8b",
            width * 2.4,
          );
          line(
            c,
            [
              [-length * 0.93, 0],
              [0, 0],
            ],
            color,
            width,
          );
          line(
            c,
            [
              [-length * 0.83, 0],
              [0, 0],
            ],
            core,
            Math.max(1.6, width * 0.28),
          );
          ellipse(c, 0, 0, s.r, s.r * 0.8, core);
          ellipse(c, -length * 0.6, 0, 1.1, width * 0.45, core);
        }
        c.restore();
      }
      this.effects = this.effects.filter((e) => e.age < 0.65);
      for (const e of this.effects) {
        e.age += dt;
        const a = e.age;
        c.save();
        c.globalAlpha = Math.max(0, 1 - a / 0.65);
        c.translate(e.x, e.y);
        const color = ["parry", "cast", "dodge"].includes(e.type)
          ? "#50edff"
          : e.type === "enemyAttack"
            ? "#ff496b"
            : "#ffdc6a";
        c.shadowColor = color;
        c.shadowBlur = 12;
        if (e.type === "slash") {
          c.rotate(e.angle);
          c.strokeStyle = e.combo === 3 ? "#ffe55b" : "#e4f5ff";
          c.lineWidth = e.combo === 3 ? 5 : 3;
          c.beginPath();
          c.arc(0, 0, 35 + a * 80, -1.1, 1.1);
          c.stroke();
        } else if (e.type === "dash") {
          line(
            c,
            [
              [0, 0],
              [-Math.cos(e.angle) * 140, -Math.sin(e.angle) * 140],
            ],
            "#71ecff",
            3,
          );
        } else if (e.type === "enemyAttack" && e.pattern === "beam") {
          c.rotate(e.angle);
          line(
            c,
            [
              [0, 0],
              [600, 0],
            ],
            "#ff809d",
            18 * (1 - a),
          );
          line(
            c,
            [
              [0, 0],
              [600, 0],
            ],
            "#fff2f8",
            4,
          );
        } else {
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(
            0,
            0,
            8 + a * (["transform", "wish"].includes(e.type) ? 450 : 100),
            0,
            Math.PI * 2,
          );
          c.stroke();
          if (e.type === "hit")
            for (let i = 0; i < 7; i++) {
              const ang = (i * Math.PI * 2) / 7;
              line(
                c,
                [
                  [Math.cos(ang) * (8 + a * 35), Math.sin(ang) * (8 + a * 35)],
                  [
                    Math.cos(ang) * (17 + a * 70),
                    Math.sin(ang) * (17 + a * 70),
                  ],
                ],
                "#ffdf88",
                2,
              );
            }
        }
        c.shadowBlur = 0;
        if (e.amount || e.text) {
          c.font = `bold ${e.amount ? 22 : 14}px 'DM Sans',sans-serif`;
          c.textAlign = "center";
          c.fillStyle = color;
          c.fillText(e.amount || e.text, 0, -35 - a * 55);
        }
        c.restore();
      }
      if (me && me.chapter) {
        const goal = me.questPhase === 2 ? map.arena : map.mentor;
        if (Math.hypot(goal.x - me.x, goal.y - me.y) > 190) {
          const ang = Math.atan2(goal.y - me.y, goal.x - me.x);
          c.save();
          c.translate(me.x + Math.cos(ang) * 130, me.y + Math.sin(ang) * 130);
          c.rotate(ang);
          c.shadowColor = "#ffd832";
          c.shadowBlur = 12;
          poly(
            c,
            [
              [12, 0],
              [-8, -7],
              [-4, 0],
              [-8, 7],
            ],
            "#f9ce43",
          );
          c.restore();
        }
      }
      c.restore();
      this.radar(state);
      if (me) this.label(c, "", 0, 0, "#fff");
    }
    label(c, text, x, y, color, size = 10) {
      c.font = `600 ${size}px 'DM Sans',sans-serif`;
      c.textAlign = "center";
      c.fillStyle = color;
      c.fillText(text, x, y);
    }
    radar(state) {
      const c = document.getElementById("radar").getContext("2d"),
        W = 176,
        H = 150;
      c.clearRect(0, 0, W, H);
      c.strokeStyle = "#45dd8d25";
      for (let r = 22; r < 80; r += 22) {
        c.beginPath();
        c.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        c.stroke();
      }
      line(
        c,
        [
          [0, H / 2],
          [W, H / 2],
        ],
        "#45dd8d25",
        1,
      );
      line(
        c,
        [
          [W / 2, 0],
          [W / 2, H],
        ],
        "#45dd8d25",
        1,
      );
      const me = state?.self;
      if (!me) return;
      const point = (p, color, size) => {
        const x = W / 2 + (p.x - me.x) / 17,
          y = H / 2 + (p.y - me.y) / 17;
        if (x > 4 && x < W - 4 && y > 4 && y < H - 4)
          ellipse(c, x, y, size, size, color);
      };
      for (const e of state.enemies)
        point(e, e.boss ? "#ff5277" : "#f09153", e.boss ? 3 : 2);
      point(this.data.mentor, "#46ecdd", 3);
      if (me.world === "earth")
        for (const o of this.data.orbs)
          if (!me.orbs.includes(o.id)) point(o, "#ffb621", 3);
      for (const p of state.players) if (p.id !== me.id) point(p, "#6bfac6", 2);
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(me.angle);
      poly(
        c,
        [
          [5, 0],
          [-3, -3],
          [-2, 0],
          [-3, 3],
        ],
        "#50ffac",
      );
      c.restore();
    }
  }
  Art.Renderer = Renderer;
})();
