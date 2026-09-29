/* Code-native art: procedural surfaces and lit rotating globes keep sprites crisp at any DPI. */
(() => {
  const TAU = Math.PI * 2,
    globes = new Map();
  const palettes = {
    earth: ["#12354b", "#38846d", "#83b898"],
    namek: ["#358778", "#5da177", "#bfdc83"],
    vegeta: ["#321d40", "#954755", "#e4a074"],
    vampa: ["#29312d", "#6e7451", "#b2b579"],
    yardrat: ["#3b375b", "#aa7481", "#e7b296"],
  };
  const rgb = (hex) => hex.match(/\w\w/g).map((v) => parseInt(v, 16));
  function globe(node, yaw, pitch) {
    let item = globes.get(node.id);
    if (!item) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      item = { canvas, ctx: canvas.getContext("2d"), at: -100 };
      globes.set(node.id, item);
    }
    const now = performance.now();
    if (now - item.at < 90) return item.canvas;
    item.at = now;
    const image = item.ctx.createImageData(256, 256),
      colors = (palettes[node.id] || ["#182e49", node.color, "#d6c9a1"]).map(
        rgb,
      );
    for (let py = 0; py < 256; py++)
      for (let px = 0; px < 256; px++) {
        const x = (px - 127.5) / 127,
          y = (py - 127.5) / 127,
          r2 = x * x + y * y;
        if (r2 > 1) continue;
        const z = Math.sqrt(1 - r2),
          yy = y * Math.cos(pitch) - z * Math.sin(pitch),
          zz = y * Math.sin(pitch) + z * Math.cos(pitch);
        const xx = x * Math.cos(yaw) + zz * Math.sin(yaw),
          z2 = zz * Math.cos(yaw) - x * Math.sin(yaw);
        const lat = Math.asin(Math.max(-1, Math.min(1, yy))),
          lon = Math.atan2(xx, z2),
          seed = node.seed * 0.017;
        const land =
          Math.sin(lon * 3 + seed + Math.sin(lat * 4) * 1.7) +
          Math.cos(lon * 5 - lat * 4 + seed) * 0.45 +
          Math.sin(lon * 11 + lat * 8) * 0.18;
        const cloud =
          Math.sin(lon * 9 + lat * 11 + seed) +
            Math.sin(lon * 17 - lat * 8) * 0.35 >
          1.03;
        const base = colors[land > 0.23 ? (land > 0.85 ? 2 : 1) : 0];
        const light =
            0.27 + 0.73 * Math.max(0, -x * 0.44 - y * 0.45 + z * 0.77),
          rim = Math.pow(1 - z, 4) * 0.3;
        const at = (py * 256 + px) * 4;
        for (let k = 0; k < 3; k++)
          image.data[at + k] = Math.min(
            255,
            (base[k] * (cloud ? 0.64 : 1) + (cloud ? 87 : 0)) * light +
              rim * [65, 155, 240][k],
          );
        image.data[at + 3] = Math.min(255, (1 - r2) * 5000);
      }
    item.ctx.putImageData(image, 0, 0);
    return item.canvas;
  }
  function orb(c, node, x, y, r, yaw, pitch, t) {
    c.save();
    c.translate(x, y);
    const glow = c.createRadialGradient(0, 0, r * 0.88, 0, 0, r * 1.25);
    glow.addColorStop(0, node.color + "00");
    glow.addColorStop(0.5, node.color + "46");
    glow.addColorStop(1, node.color + "00");
    c.fillStyle = glow;
    c.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    if (node.realm) {
      c.strokeStyle = node.color;
      c.shadowColor = node.color;
      c.shadowBlur = 20;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(
          0,
          0,
          r * (1 - i * 0.18),
          r * 0.5,
          t * 0.15 + i * 1.04,
          0,
          TAU,
        );
        c.stroke();
      }
      c.fillStyle = "#070e25";
      c.beginPath();
      c.arc(0, 0, r * 0.42, 0, TAU);
      c.fill();
    } else {
      c.imageSmoothingEnabled = true;
      c.drawImage(globe(node, yaw, pitch), -r, -r, r * 2, r * 2);
      c.strokeStyle = node.color + "99";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  Art.surface = (c, renderer, me, t, width, height) => {
    if (!me) return;
    const palette = palettes[me.world] || ["#253447", "#42595e", "#77938a"];
    c.fillStyle = palette[0];
    c.fillRect(
      renderer.cam.x - width / 2 - 80,
      renderer.cam.y - height / 2 - 80,
      width + 160,
      height + 160,
    );
    const step = 420,
      x0 = Math.floor((renderer.cam.x - width / 2) / step),
      y0 = Math.floor((renderer.cam.y - height / 2) / step);
    for (let cy = y0; cy < y0 + height / step + 2; cy++)
      for (let cx = x0; cx < x0 + width / step + 2; cx++) {
        const random = UZ.rng(
            ((cx * 73856093) ^ (cy * 19349663) ^ renderer.data.world.seed) >>>
              0,
          ),
          x = cx * step,
          y = cy * step;
        c.fillStyle = palette[1];
        c.globalAlpha = 0.32;
        c.beginPath();
        c.ellipse(
          x + step / 2,
          y + step / 2,
          step * 0.75,
          step * 0.6,
          random() * 3,
          0,
          TAU,
        );
        c.fill();
        c.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
          const px = x + random() * step,
            py = y + random() * step,
            r = 8 + random() * 18;
          if (px > 50 && px < 3350 && py > 50 && py < 3350) continue;
          c.fillStyle = "#05192355";
          c.beginPath();
          c.ellipse(px + 7, py + 9, r * 1.2, r * 0.65, 0, 0, TAU);
          c.fill();
          c.fillStyle = palette[2];
          c.beginPath();
          c.moveTo(px - r, py + r * 0.35);
          c.lineTo(px - r * 0.6, py - r * 0.6);
          c.lineTo(px + r * 0.2, py - r);
          c.lineTo(px + r, py);
          c.closePath();
          c.fill();
          c.fillStyle = palette[1];
          c.beginPath();
          c.ellipse(px, py - 4, r * 0.58, r * 0.48, -0.3, 0, TAU);
          c.fill();
        }
      }
  };
  Art.landmark = (c, b, world, t) => {
    c.save();
    c.translate(b.x, b.y);
    c.fillStyle = "#03131d66";
    c.beginPath();
    c.ellipse(12, 24, 85, 47, 0, 0, TAU);
    c.fill();
    const namek = world === "namek",
      temple = ["divine", "sacred", "otherworld", "zeno"].includes(world);
    if (namek || b.type === "dome" || b.type === "capsule") {
      c.fillStyle = namek ? "#dddcb0" : temple ? "#f3dfbd" : "#d0e5db";
      c.beginPath();
      c.ellipse(0, 0, 68, 53, 0, 0, TAU);
      c.fill();
      c.strokeStyle = namek ? "#8a976d" : "#678e8c";
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = namek ? "#b2bf8f" : "#81afaf";
      c.beginPath();
      c.ellipse(0, -9, 54, 34, 0, Math.PI, TAU);
      c.fill();
      c.fillStyle = "#254658";
      c.fillRect(-13, 26, 26, 24);
      c.strokeStyle = "#5c929a";
      c.lineWidth = 3;
      c.strokeRect(-13, 26, 26, 24);
      for (const x of [-38, 32]) {
        c.fillStyle = "#245471";
        c.fillRect(x, -3, 13, 16);
        c.fillStyle = "#9ce3e6";
        c.fillRect(x + 2, -1, 4, 11);
      }
      if (b.type === "capsule") {
        c.fillStyle = "#173b4b";
        c.font = "bold 11px system-ui";
        c.textAlign = "center";
        c.fillText(world === "earth" ? "CAPSULE" : "Z", 0, 13);
      }
      if (namek) {
        c.strokeStyle = "#dfe7b9";
        c.lineWidth = 7;
        for (const sign of [-1, 1]) {
          c.beginPath();
          c.moveTo(sign * 24, -38);
          c.quadraticCurveTo(sign * 37, -70, sign * 55, -56);
          c.stroke();
        }
      }
    } else {
      c.fillStyle = world === "earth" ? "#e2bbaa" : "#cbbba8";
      c.fillRect(-56, -26, 112, 74);
      c.fillStyle = "#b58f84";
      c.fillRect(-56, 29, 112, 19);
      c.fillStyle = world === "earth" ? "#c77978" : "#947980";
      c.beginPath();
      c.moveTo(-70, -20);
      c.lineTo(0, -66);
      c.lineTo(70, -20);
      c.lineTo(60, 0);
      c.lineTo(0, -37);
      c.lineTo(-60, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#e7aaa0";
      c.lineWidth = 2;
      for (let i = -45; i <= 45; i += 15) {
        c.beginPath();
        c.moveTo(i, -31 - Math.max(0, 23 - Math.abs(i) * 0.5));
        c.lineTo(i, -8 - Math.max(0, 23 - Math.abs(i) * 0.5));
        c.stroke();
      }
      c.fillStyle = "#446b75";
      c.fillRect(-39, 10, 20, 19);
      c.fillRect(22, 10, 20, 19);
      c.fillStyle = "#5d4747";
      c.fillRect(-10, 18, 22, 30);
      c.fillStyle = "#f0d8bc";
      c.fillRect(-45, 16, 30, 3);
      c.fillRect(17, 16, 30, 3);
    }
    c.textAlign = "center";
    c.font = "600 10px system-ui";
    c.fillStyle = "#e2efdb";
    c.shadowColor = "#051a25";
    c.shadowBlur = 5;
    c.fillText(b.label, 0, 76);
    c.restore();
  };
  const baseDraw = Art.Renderer.prototype.draw;
  Art.Renderer.prototype.draw = function (state, input, t) {
    const p = state?.self;
    if (!p || p.world !== "space") {
      baseDraw.call(this, state, input, t);
      if (p?.altitude > 0.03) {
        const c = this.c,
          dpr = Math.min(devicePixelRatio || 1, 2),
          a = p.altitude;
        c.save();
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = `rgba(100,185,232,${Math.sin(a * Math.PI) * 0.2})`;
        c.fillRect(0, 0, innerWidth, innerHeight);
        c.strokeStyle = `rgba(190,239,255,${a * 0.32})`;
        if (!this.reduced)
          for (let i = 0; i < 28; i++) {
            const angle = (i * TAU) / 28,
              dist = 150 + ((t * 380 + i * 47) % 600);
            c.beginPath();
            c.moveTo(
              innerWidth / 2 + Math.cos(angle) * dist,
              innerHeight / 2 + Math.sin(angle) * dist,
            );
            c.lineTo(
              innerWidth / 2 + Math.cos(angle) * (dist + 90 * a),
              innerHeight / 2 + Math.sin(angle) * (dist + 90 * a),
            );
            c.stroke();
          }
        c.restore();
      }
      return;
    }
    const c = this.c,
      W = innerWidth,
      H = innerHeight,
      dpr = Math.min(devicePixelRatio || 1, 2),
      dt = Math.min(0.05, t - this.last || 0.016);
    this.last = t;
    if (
      this.canvas.width !== Math.round(W * dpr) ||
      this.canvas.height !== Math.round(H * dpr)
    ) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
    }
    if (this.world !== "space") {
      this.setWorld("space");
      this.cam = { x: p.x, y: p.y };
    }
    this.zoom = W < 760 ? 0.76 : 0.72;
    const z = this.zoom;
    this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 14);
    this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 14);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#030712";
    c.fillRect(0, 0, W, H);
    const nebula = c.createRadialGradient(
      W * 0.65,
      H * 0.3,
      20,
      W * 0.6,
      H * 0.4,
      W * 0.8,
    );
    nebula.addColorStop(0, "#16354c80");
    nebula.addColorStop(0.5, "#20143350");
    nebula.addColorStop(1, "#03071200");
    c.fillStyle = nebula;
    c.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      const x = (((s.x - this.cam.x * s.z * 0.08) % W) + W) % W,
        y = (((s.y - this.cam.y * s.z * 0.08) % H) + H) % H;
      c.globalAlpha = s.a;
      c.fillStyle = "#d3ebff";
      c.fillRect(x, y, s.r, s.r);
      if (p.boosting && !this.reduced) {
        c.strokeStyle = "#83dbff66";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - p.vx * 0.006 * s.z, y - p.vy * 0.006 * s.z);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (const n of UZNav.nodes) {
      const x = W / 2 + (n.x - this.cam.x) * z,
        y = H / 2 + (n.y - this.cam.y) * z,
        r = n.radius * z;
      if (x + r < -80 || x - r > W + 80 || y + r < -80 || y - r > H + 80)
        continue;
      orb(c, n, x, y, r, t * 0.025 + this.cam.x / 11000, this.cam.y / 15000, t);
      c.textAlign = "center";
      c.font = "600 12px system-ui";
      c.fillStyle = "#d9f1ff";
      c.fillText(n.name.toUpperCase(), x, y + r + 26);
      c.font = "10px system-ui";
      c.fillStyle = "#82bed3";
      c.fillText(
        n.realm ? "PORTAL DIMENSIONAL" : "APROXIME-SE · F PARA DESCER",
        x,
        y + r + 44,
      );
    }
    const target = UZNav.get(p.destination);
    if (target) {
      const angle = Math.atan2(target.y - p.y, target.x - p.x),
        r = Math.min(W * 0.32, H * 0.29);
      c.save();
      c.translate(W / 2 + Math.cos(angle) * r, H / 2 + Math.sin(angle) * r);
      c.rotate(angle);
      c.strokeStyle = "#ffcb75";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-8, -6);
      c.lineTo(0, 0);
      c.lineTo(-8, 6);
      c.stroke();
      c.restore();
    }
    for (const e of [...state.players, ...state.enemies]) {
      const x = W / 2 + (e.x - this.cam.x) * z,
        y = H / 2 + (e.y - this.cam.y) * z;
      c.save();
      c.translate(x, y);
      const speed = Math.hypot(e.vx, e.vy);
      if (speed > 80) {
        c.save();
        c.rotate(Math.atan2(e.vy, e.vx));
        const tail = c.createLinearGradient(-100, 0, 4, 0);
        tail.addColorStop(0, "#60dfff00");
        tail.addColorStop(1, "#a1f1ffa0");
        c.fillStyle = tail;
        c.beginPath();
        c.moveTo(6, -7);
        c.lineTo(-Math.min(140, speed * 0.035), 0);
        c.lineTo(6, 7);
        c.fill();
        c.restore();
      }
      Art.fighter(c, { ...e, x: 0, y: 0, z: 0, groundZ: 0 }, t, z * (e.boss ? 1.22 : 1));
      if (e.halo) {
        c.save();
        c.strokeStyle = '#f8e8a7';
        c.lineWidth = Math.max(1.4, 2.6 * z);
        c.shadowColor = '#ffeaa9';
        c.shadowBlur = this.reduced ? 0 : 11;
        c.beginPath();
        c.ellipse(0, -56 * z, 17 * z, 5 * z, -0.12, 0, TAU);
        c.stroke();
        c.restore();
      }
      if(e.maxHp){c.fillStyle='#172636';c.fillRect(-18,23,36,3);c.fillStyle=e.id===p.id?'#7fe0bd':'#ee7779';c.fillRect(-18,23,36*Math.max(0,e.hp/e.maxHp),3);}
      if(e.state==='windup'){
        c.rotate(e.angle);c.strokeStyle='#ff8079';c.lineWidth=1.5;c.beginPath();c.moveTo(0,0);c.arc(0,0,(e.pattern==='beam'?400:85)*z,-.85,.85);c.closePath();c.stroke();
      }
      c.restore();
    }
    for (const s of state.shots) {
      c.save();
      c.translate(
        W / 2 + (s.x - this.cam.x) * z,
        H / 2 + (s.y - this.cam.y) * z,
      );
      c.rotate(s.angle);
      c.strokeStyle = s.hostile?"#ff8079":"#80ecff";
      c.lineWidth = s.r * z;
      c.shadowColor = "#4ee8ff";
      c.shadowBlur = 14;
      c.beginPath();
      c.moveTo(-30, 0);
      c.lineTo(0, 0);
      c.stroke();
      c.restore();
    }
    this.effects = this.effects.filter(e=>e.age<.65);
    for(const e of this.effects){
      e.age+=dt;c.save();c.translate(W/2+(e.x-this.cam.x)*z,H/2+(e.y-this.cam.y)*z);c.scale(z,z);
      c.globalAlpha=Math.max(0,1-e.age/.65);c.rotate(e.angle||0);
      c.strokeStyle=e.type==='enemyAttack'?'#ff809d':'#9cefff';c.shadowColor=c.strokeStyle;c.shadowBlur=this.reduced?0:12;
      c.lineWidth=e.type==='enemyAttack'?8:3;c.beginPath();
      if(e.pattern==='beam'){c.moveTo(0,0);c.lineTo(e.projectile?55:(e.radius||920),0);}
      else if(e.type==='dash'){c.moveTo(0,0);c.lineTo(-140,0);}
      else c.arc(0,0,12+e.age*100,e.type==='slash'?-.9:0,e.type==='slash'?.9:Math.PI*2);
      c.stroke();c.restore();
    }
    const radar = document.getElementById("radar").getContext("2d");
    radar.clearRect(0, 0, 176, 150);
    radar.fillStyle = "#081520";
    radar.fillRect(0, 0, 176, 150);
    for (const n of UZNav.nodes) {
      const x = 88 + (n.x - p.x) / 420,
        y = 75 + (n.y - p.y) / 420;
      radar.fillStyle = n.id === p.destination ? "#ffd487" : n.color;
      radar.beginPath();
      radar.arc(x, y, n.id === p.destination ? 4 : 2, 0, TAU);
      radar.fill();
    }
    radar.fillStyle = "#fff";
    radar.fillRect(86, 73, 4, 4);
    document.getElementById("objective-arrow").style.display = "none";
  };
  window.FlightUI = {
    update(p) {
      const $ = (id) => document.getElementById(id),
        n = UZNav.get(p.destination),
        space = p.world === "space",
        nearest = space ? UZNav.nearest(p) : null;
      $("flight-status").textContent = space
        ? "ESPAÇO PROFUNDO"
        : p.ascent
          ? "ASCENSÃO ORBITAL"
          : p.altitude > 0.1
            ? "ENTRADA NA ATMOSFERA"
            : p.mode === "ground"
              ? p.grounded === false ? p.vz > 0 ? "PULANDO" : "EM QUEDA" : "SUPERFÍCIE"
              : "VOO · PLANO DE COMBATE";
      $("flight-speed").textContent =
        Math.round(Math.hypot(p.vx, p.vy)) + " u/s";
      $("route-name").textContent = n?.name || "Explore o universo";
      $("route-distance").textContent = space
        ? nearest.distance < 650
          ? "F · Entrar em " + nearest.name
          : n
            ? Math.round(
                Math.max(0, Math.hypot(n.x - p.x, n.y - p.y) - n.radius),
              ) + " u até o destino"
            : "Voo livre"
        : p.ascent
          ? "V · Cancelar ascensão"
          : "Atlas: destino · V: órbita";
      $("route-bearing").style.transform =
        space && n
          ? `rotate(${(Math.atan2(n.y - p.y, n.x - p.x) * 180) / Math.PI + 45}deg)`
          : "none";
      $("orbit-button").innerHTML = space
        ? "↧ Entrar <kbd>F</kbd>"
        : p.ascent
          ? "↧ Cancelar <kbd>V</kbd>"
          : "↟ Órbita <kbd>V</kbd>";
      $("teleport-button").hidden =
        !p.techniques.includes("teleport") ||
        !p.visited.includes(p.destination) ||
        p.destination === p.world;
      $("teleport-button").disabled = p.ki < 40;
    },
  };
  const setWorld = Art.Renderer.prototype.setWorld,
    draw = Art.Renderer.prototype.draw;
  Art.Renderer.prototype.setWorld = function (id) {
    if (id !== this.world && this.canvas.width) {
      const frame = document.createElement("canvas");
      frame.width = this.canvas.width;
      frame.height = this.canvas.height;
      frame.getContext("2d").drawImage(this.canvas, 0, 0);
      this.transition = { frame, at: performance.now() };
    }
    setWorld.call(this, id);
  };
  Art.Renderer.prototype.draw = function (...args) {
    draw.apply(this, args);
    if (this.transition) {
      const age = (performance.now() - this.transition.at) / 650;
      if (age >= 1) {
        this.transition = null;
        return;
      }
      const c = this.c;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = (1 - age) * 0.85;
      c.drawImage(
        this.transition.frame,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      c.restore();
    }
  };
})();
