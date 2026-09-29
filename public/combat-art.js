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
      this.camZ = 0;
      this.entities.clear();
      this.effects = [];
      this.trails = [];
      window.UZVFX?.clear();
      this.buildTerrain();
    }
    buildTerrain() {
      if (Art.openTerrain) return;
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
      // Project a copy; networking and collisions retain the physical coordinates.
      const displayZ = Number.isFinite(e.visualZ) ? e.visualZ : e.z;
      if (Number.isFinite(displayZ) && displayZ !== 0) e = { ...e, y: e.y - displayZ };
      const manga = window.UZManga?.effect(e, this);
      if (!window.UZVFX?.effect(e, this) && !manga) this.effects.push({ ...e, age: 0 });
      if (this.effects.length > 96) this.effects.splice(0, this.effects.length - 96);
      if (
        ["hit", "parry", "complete", "transform", "collisionBurst"].includes(e.type) &&
        !this.reduced
      )
        this.shake = e.type === "collisionBurst" ? 9 : e.heavy ? 5 : 2;
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
      const rival=this.combatTarget, distance=rival&&me?Math.hypot(rival.x-me.x,rival.y-me.y):Infinity;
      const baseZoom=(W < 760 ? 0.76 : 0.72) * (1 - (me?.altitude || 0) * 0.42);
      const desiredZoom=distance<700&&rival.hp>0?Math.max(baseZoom,Math.min(1.25,(W-56)/(distance*2+120),(H-180)/(distance*2+120))):baseZoom;
      this.zoom=(this.zoom||baseZoom)+(desiredZoom-(this.zoom||baseZoom))*Math.min(1,dt*5);
      if(this.snapshotTime!==state?.time){this.snapshotTime=state?.time;this.snapshotArrived=t;}
      const combatClock=(state?.time||0)+Math.min(.1,t-(this.snapshotArrived||t));
      const zoom = this.zoom,
        target = me || { x: 1700, y: 1730 };
      // Keep the support plane in view. Following the full jump height made a
      // tall leap look stationary because the camera cancelled its projection.
      const supportHeight = Math.max(0, target.groundZ || 0);
      const airHeight = Math.max(0, (target.z || 0) - supportHeight);
      const cameraLift = supportHeight * .86 + (target.mode === "flight"
        ? airHeight * .76
        : Math.min(airHeight, 270) * .18 + Math.max(0, airHeight - 270) * .72);
      this.camZ = (this.camZ || 0) + (cameraLift - (this.camZ || 0)) * Math.min(1, dt * 4);
      this.cam.x += (target.x - this.cam.x) * Math.min(1, dt * 13);
      this.cam.y += (target.y - this.camZ - this.cam.y) * Math.min(1, dt * 13);
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
      Art.sandboxTerrain?.(c, this, state, t);
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
      const npc = Array.isArray(state?.npcs)
        ? [...new Map(state.npcs
            .filter(person => person && Number.isFinite(person.x) && Number.isFinite(person.y) &&
              (!person.world || person.world === this.world))
            .map(person => [person.id, person])).values()]
        : [];
      const mentorCovered = npc.some(person =>
        person.name === mentor.name && Math.hypot(person.x - mentor.x, person.y - mentor.y) < 150);
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
      for (const e of [...enemies,...(state?.players||[]).filter(p=>p.id!==me?.id&&p.combatAction)])
        if (e.state === "windup") {
          const ratio = Math.max(
            0,
            Math.min(1, (state.time - e.windupAt) / (e.attackAt - e.windupAt)),
          );
          c.save();
          c.translate(e.x, e.y - (e.z || 0));
          c.rotate(e.angle);
          c.strokeStyle = e.counterStrike?'#f8ca70':'#ff6565aa';
          c.fillStyle = "#ee3b4b18";
          c.lineWidth = 1.5;
          c.beginPath();
          if (e.pattern === "beam") c.rect(0, -55, e.telegraphRadius || 920, 110);
          else {
            c.moveTo(0, 0);
            c.arc(
              0,
              0,
              e.telegraphRadius || (e.pattern === "rush" ? 225 : e.boss ? 160 : 85),
              e.pattern === "ring" ? 0 : e.pattern === "rush" ? -.55 : -.85,
              e.pattern === "ring" ? Math.PI * 2 : e.pattern === "rush" ? .55 : .85,
            );
            c.closePath();
          }
          c.fill();
          c.stroke();
          c.globalAlpha = ratio * 0.5;
          c.fillStyle = "#f96173";
          c.fill();
          // The painted warning area carries ordinary strikes. Text is reserved
          // for a distinct defensive response or a dangerous attack shape.
          const warning = e.counterStrike ? 'CONTRA' : e.pattern === 'beam'
            ? 'DISPARO DE KI' : e.pattern === 'ring' ? 'ATAQUE EM ÁREA' : '';
          if (warning) {
            c.globalAlpha = 1;
            c.rotate(-e.angle);
            c.fillStyle = '#fff2df';
            c.font = 'bold 11px sans-serif';
            c.textAlign = 'center';
            c.fillText(warning, 0, -52);
          }
          c.restore();
        }
      this.trails = this.trails.filter((a) => a.age < 0.2);
      for (const a of this.trails) {
        a.age += dt;
        c.globalAlpha = (1 - a.age / 0.2) * 0.18;
        Art.fighter(c, a, t, a.scale);
        c.globalAlpha = 1;
      }
      // Small physical fragments reuse the terrain palette and stay bounded by the snapshot.
      for (const piece of (state?.physicsDebris || []).slice(0, 48)) {
        const radius = Math.max(2, Math.min(10, piece.size || 4));
        ellipse(c, piece.x + 2, piece.y + 3, radius * 1.2, radius * .55, "#17223035");
        c.save();c.translate(piece.x, piece.y - (piece.z || 0));c.rotate(piece.angle || 0);
        poly(c, [[-radius, 0], [-radius * .45, -radius], [radius * .6, -radius * .65],
          [radius, radius * .2], [radius * .15, radius * .7]], "#96836c");
        line(c, [[-radius * .45, -radius], [radius * .6, -radius * .65]], "#d1b998", 1);
        c.restore();
      }
      window.UZWildlifeArt?.drawAll(c, state?.wildlife || [], t, this);
      const all = [
        ...(mentorCovered ? [] : [mentor]),
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
      all.sort((a, b) => a.y - b.y);
      for (const e of all) {
        ids.add(e.id);
        if (
          Math.abs(e.x - this.cam.x) > W / zoom / 2 + 100 ||
          Math.abs(e.y - (e.z || 0) - this.cam.y) > H / zoom / 2 + 120
        )
          continue;
        let p = this.entities.get(e.id);
        if (!p || Math.hypot(p.x - e.x, p.y - e.y) > 260)
          p = { x: e.x, y: e.y, z: e.z || 0 };
        const speed = e.id === me?.id ? 28 : 16;
        p.x += (e.x - p.x) * (state?.presentation ? 1 : Math.min(1, dt * speed));
        p.y += (e.y - p.y) * (state?.presentation ? 1 : Math.min(1, dt * speed));
        // Physics remains immediate for hits; only the drawn model limits rare
        // network corrections so a jump never skips several visible frames.
        const targetZ=e.z||0, deltaZ=targetZ-(p.z||0);
        const maxVerticalStep=Math.max(0,dt)*(e.mode==='flight'?900:650);
        p.z=Math.max(e.groundZ||0,(p.z||0)+Math.max(-maxVerticalStep,Math.min(maxVerticalStep,deltaZ)));
        this.entities.set(e.id, p);
        // Size, width and boss scaling come from the same rig geometry as hits.
        const scale = 1;
        if (["run", "dash"].includes(e.state) && !this.reduced && this.trails.length < 120 &&
          (!p.trailAt || t - p.trailAt > .045)) {
          this.trails.push({ ...e, ...p, scale, age: 0 });
          p.trailAt = t;
        }
        if (e.id === me?.id) {
          c.strokeStyle = "#3be1f69c";
          c.lineWidth = 1;
          c.beginPath();
          c.arc(p.x, p.y - (e.groundZ || 0), UZPhysics.body(e).radius + 5, t * 0.4, t * 0.4 + 4.9);
          c.stroke();
        }
        if (e.mode === "flight" && e.id === me?.id) {
          const speed = Math.hypot(e.vx || 0, e.vy || 0);
          if (speed > 170) {
            c.save();
            c.translate(p.x, p.y - p.z);
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
        Art.fighter(c, { ...e, ...p, combatClock }, t, scale);
        Art.openForeground?.(c, this, { ...e, ...p, renderScale: scale });
        if (e.halo) {
          c.save();
          c.translate(p.x, p.y - p.z);
          c.strokeStyle = '#ffedac';
          c.lineWidth = 2.4;
          c.shadowColor = '#ffe29b';
          c.shadowBlur = this.reduced ? 0 : 10;
          c.beginPath();
          c.ellipse(0, -49, 16, 5, -0.15, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }
        if (e.id === "mentor") {
          c.shadowBlur = 10;
          c.shadowColor = "#ffb02f";
          this.label(c, "◇", p.x, p.y - p.z - 47, "#ffbd45", 18);
          c.shadowBlur = 0;
          this.label(c, e.name, p.x, p.y - p.z + 39, "#eac791", 11);
        } else if (e.name) {
          const isNpc = typeof e.id === "string" && e.id.startsWith("npc:");
          const tint = e.boss
            ? "#ff676f"
            : e.id === me?.id
              ? "#64e8fc"
              : isNpc
                ? e.companion ? "#8ee7bd" : e.characterId === "enma" ? "#d6adff" : "#ffd28e"
                : "#b1bbd1";
          c.save();
          c.translate(p.x + 22, p.y - p.z - 27);
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
          if (isNpc && me && Math.hypot(e.x - me.x, e.y - me.y) < 240) {
            const activity = {
              sleep: "DESCANSANDO", eat: "REFEIÇÃO", train: "TREINANDO", work: "TRABALHANDO",
              duty: "EM SERVIÇO", adventure: "EXPLORANDO", social: "CONVERSANDO",
              travel: "VIAJANDO", accompany: "ACOMPANHANDO", respond: "ATENDENDO EVENTO",
            }[e.activity] || "CONVERSAR";
            c.font = "700 8px 'DM Sans',sans-serif";
            c.fillStyle = e.companion ? "#8ee7bd" : "#ffe5b9";
            c.fillText(activity, 3, 18);
          }
          if (e.hp !== undefined) {
            c.fillStyle = "#33496566";
            c.fillRect(3, 4, 61, 3);
            c.fillStyle =
              e.id === me?.id ? "#71edbc" : e.boss ? "#ff5271" : "#f4b450";
            c.fillRect(3, 4, (61 * e.hp) / e.maxHp, 3);
            if(e.effort!=null){c.fillStyle='#283949';c.fillRect(3,9,61,2);c.fillStyle=e.effort<25?'#ffc06c':'#89d6e7';c.fillRect(3,9,61*e.effort/100,2);}
            if(e.state==='guard'){c.strokeStyle='#8ddce9';c.lineWidth=3;c.beginPath();c.arc(30,-24,29,e.angle-.9,e.angle+.9);c.stroke();}
            if(e.state==='recover'||e.state==='breathe'){c.fillStyle='#9bffd2';c.font='bold 9px sans-serif';c.fillText('ABERTURA',4,20);}
          }
          c.restore();
        }
      }
      for (const eid of this.entities.keys())
        if (!ids.has(eid)) this.entities.delete(eid);
      for(const q of state?.clashes||[]) {
        c.save();const phase=this.reduced?0:Math.sin(t*35),r=22+phase*4;
        const clashY=q.y-(q.visualZ??q.z??0);
        if(q.type==='beam')for(const [i,p]of q.anchors.entries())if(p){
          const anchorY=p.y-(p.visualZ??p.z??0);
          const dx=q.x-p.x,dy=clashY-anchorY,len=Math.hypot(dx,dy)||1,offset=this.reduced?0:Math.sin(t*28+i)*8;
          const points=[[p.x,anchorY],[p.x+dx*.5-dy/len*offset,anchorY+dy*.5+dx/len*offset],[q.x,clashY]];
          line(c,points,i?'#ff647b':'#38dcff',25);line(c,points,'#faffff',6);
        }
        c.shadowBlur=this.reduced?0:25;c.shadowColor='#c5f7ff';
        ellipse(c,q.x,clashY,r*1.4,r,'#e5ffff');
        for(let i=0;i<8;i++){const a=i*Math.PI/4+(this.reduced?0:t*3);line(c,[[q.x+Math.cos(a)*r,clashY+Math.sin(a)*r],[q.x+Math.cos(a+.2)*(r+28),clashY+Math.sin(a+.2)*(r+28)]],i%2?'#ffda78':'#72edff',3);}
        c.restore();
      }
      for (const s of state?.shots || []) {
        const shotHeight = UZPhysics.displayHeight?.(s) ?? (s.z || 0);
        if(s.trail?.length>1){const points=[...s.trail.map(p=>[p.x,p.y-(UZPhysics.displayHeight?.({...s,z:p.z??s.z})??(p.z??s.z??0))]),[s.x,s.y-shotHeight]];c.save();c.shadowColor=s.hostile?'#ff6279':'#48eaff';c.shadowBlur=this.reduced?0:20;line(c,points,s.hostile?'#ff6279':'#48eaff',23);line(c,points,'#edffff',6);c.restore();}
        c.save();
        c.translate(s.x, s.y - shotHeight);
        c.rotate(s.angle);
        const colors = {
          hostile: ["#ff746b", "#fff0cf"],
          weave: ["#d8a1ff", "#ffffff"],
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
            length = s.trail?.length ? 24 : Math.min(travelled, s.r < 18 ? 32 : 520),
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
        if(e.type==='collisionBurst') {
          const radius=(e.radius||150)*Math.min(1,a/.4), alpha=Math.max(0,1-a/.65);
          c.globalAlpha=alpha;c.shadowBlur=this.reduced?0:28;c.strokeStyle='#bff8ff';c.lineWidth=8*(1-a/.7);c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.stroke();
          c.strokeStyle='#ffcf80';c.lineWidth=3;c.beginPath();c.arc(0,0,radius*.72,0,Math.PI*2);c.stroke();
          for(let i=0;i<12;i++){const angle=i*Math.PI/6;line(c,[[Math.cos(angle)*radius*.5,Math.sin(angle)*radius*.5],[Math.cos(angle)*radius*1.2,Math.sin(angle)*radius*1.2]],i%2?'#ffe6a1':'#e7ffff',3);}
          if(!this.reduced&&a<.12)ellipse(c,0,0,35,28,'#fff6dd');
        } else if(e.type==='clashPulse') {
          c.strokeStyle='#eaffff';c.lineWidth=3;c.beginPath();c.arc(0,0,15+a*80,0,Math.PI*2);c.stroke();
        } else if (e.type === "slash") {
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
        } else if (e.type === "enemyAttack" && e.pattern === "beam" && !e.projectile) {
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
      if (me && (me.surfaceRoute?.world === me.world ||
          me.guide?.world === me.world && Number.isFinite(me.guide.targetX) ||
          me.legacyCampaign && me.chapter)) {
        const localRoute = me.surfaceRoute?.world === me.world ? me.surfaceRoute : null;
        const goal = localRoute || (me.guide?{x:me.guide.targetX,y:me.guide.targetY}:me.questPhase === 2 ? map.arena : map.mentor);
        if (Math.hypot(goal.x - me.x, goal.y - me.y) > 190) {
          const ang = Math.atan2(goal.y - me.y, goal.x - me.x);
          c.save();
          c.translate(me.x + Math.cos(ang) * 130, me.y - (me.z || 0) + Math.sin(ang) * 130);
          c.rotate(ang);
          c.shadowColor = localRoute ? "#8fddff" : "#ffd832";
          c.shadowBlur = 12;
          poly(
            c,
            [
              [12, 0],
              [-8, -7],
              [-4, 0],
              [-8, 7],
            ],
            localRoute ? "#8fddff" : "#f9ce43",
          );
          c.restore();
        }
      }
      c.restore();
      if (me && npc.length) {
        let near = null, nearDistance = 225;
        for (const person of npc) {
          const d = Math.hypot(person.x - me.x, person.y - me.y);
          if (d < nearDistance && !person.companion) { near = person; nearDistance = d; }
        }
        if (near) {
          const message = near.characterId === "enma" && me.afterlife?.pending
            ? "E · PEDIR AUTORIZAÇÃO AO REI ENMA"
            : near.activity === "sleep"
              ? `${near.name} está descansando · E conversar`
              : `E · CONVERSAR COM ${near.name.toUpperCase()}`;
          c.save();
          c.font = "700 12px 'DM Sans',sans-serif";
          const width = Math.min(W - 30, c.measureText(message).width + 38);
          const x = (W - width) / 2, y = H - 132;
          c.fillStyle = "#0d1c2be8";
          c.strokeStyle = near.characterId === "enma" ? "#c99beb" : "#ffc981";
          c.lineWidth = 1.5;
          c.beginPath(); c.roundRect(x, y, width, 34, 10); c.fill(); c.stroke();
          c.fillStyle = "#fff0d3";
          c.textAlign = "center";
          c.fillText(message, W / 2, y + 22);
          c.restore();
        }
      }
      // Warn about committed attackers outside the camera, without moving their aim.
      for(const e of state?.enemies||[])if(e.state==='windup'){
        const sx=W/2+(e.x-this.cam.x)*zoom,sy=H/2+(e.y-(e.z||0)-this.cam.y)*zoom;
        if(sx<22||sx>W-22||sy<35||sy>H-35){const x=Math.max(22,Math.min(W-22,sx)),y=Math.max(140,Math.min(H-170,sy)),a=Math.atan2(sy-H/2,sx-W/2);c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#ffbd87';c.beginPath();c.moveTo(12,0);c.lineTo(-7,-8);c.lineTo(-7,8);c.closePath();c.fill();c.rotate(-a);c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(Math.max(0,e.attackAt-state.time).toFixed(1)+'s',0,22);c.restore();}
      }
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
      for (const person of state.npcs || [])
        if (person.world === me.world || !person.world)
          point(person, person.companion ? "#8ee7bd" : "#ffd28e", person.companion ? 3 : 2);
      point(this.data.mentor, "#46ecdd", 3);
      if (me.surfaceRoute?.world === me.world) point(me.surfaceRoute, "#8fddff", 4);
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
