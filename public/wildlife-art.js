/* Illustrated, non-combat wildlife in the same world coordinates as fighters. */
window.UZWildlifeArt = (() => {
  "use strict";
  const TAU = Math.PI * 2;
  const OUTLINE = "#152431";
  const spriteCache = new Map();
  const positions = new Map();
  let lastFrame = 0;
  function tone(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    if (!Number.isFinite(n)) return hex;
    const channel = bits => Math.max(0, Math.min(255, (n >> bits & 255) + amount));
    return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  }
  function ellipse(c, x, y, rx, ry, color, outline = null, width = 1.7) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
    if (outline) { c.strokeStyle = outline; c.lineWidth = width; c.stroke(); }
  }
  function shape(c, points, color, outline = OUTLINE) {
    c.fillStyle = color;
    if (outline) { c.strokeStyle = outline; c.lineWidth = 2.1; }
    c.lineJoin = "round";
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fill();
    if (outline) c.stroke();
  }
  function line(c, points, color, width = 2) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.stroke();
  }
  function limb(c, points, color, width) {
    line(c, points, OUTLINE, width + 3);
    line(c, points, color, width);
    line(c, points.map(([x,y]) => [x,y-1]), "#ffffff42", Math.max(1,width*.23));
  }
  function eye(c, x, y) {
    ellipse(c, x, y, 3.1, 3.6, "#fff4dc", OUTLINE, 1.5);
    ellipse(c, x + 0.8, y, 1.2, 1.7, OUTLINE);
    ellipse(c, x + .1, y - 1.1, .7, .7, "#fff");
  }
  function bird(c, def, phase) {
    const wing = Math.sin(phase) * 11;
    const dark = tone(def.color,-39), light = tone(def.color,28);
    limb(c, [[-5,-12],[-7,-2],[-13,1]], dark, 2.8);
    limb(c, [[7,-12],[9,-2],[3,1]], dark, 2.8);
    line(c,[[-13,1],[-17,2]],OUTLINE,1.3);
    line(c,[[3,1],[-1,3]],OUTLINE,1.3);
    shape(c, [[-20,-24],[-50,-36],[-37,-25],[-48,-17],[-19,-18]],dark);
    shape(c, [[-12,-24],[-6,-43-wing],[5,-49-wing],[15,-29],[7,-17]],dark);
    shape(c, [[-10,-23],[-3,-40-wing],[5,-45-wing],[10,-28],[4,-18]],def.accent);
    for(let i=0;i<3;i++)line(c,[[-3+i*4,-29],[0+i*4,-40-wing*.7]],tone(def.accent,-28),1.3);
    ellipse(c,0,-20,23,13,def.color,OUTLINE);
    shape(c,[[-18,-22],[-6,-16],[14,-17],[4,-9],[-14,-12]],light,null);
    shape(c,[[-8,-19],[-5,-31+wing],[6,-39+wing],[17,-24],[5,-14]],dark);
    shape(c,[[-4,-18],[0,-29+wing],[8,-34+wing],[12,-24],[4,-16]],def.color);
    for(let i=0;i<3;i++)line(c,[[i*4,-20],[i*4+3,-29+wing*.7]],light,1.3);
    ellipse(c,18,-28,11,10,def.color,OUTLINE);
    shape(c,[[14,-36],[19,-47],[22,-36],[27,-42],[26,-32]],light);
    shape(c,[[27,-28],[42,-25],[27,-21]],"#e6bb78");
    shape(c,[[28,-22],[41,-23],[30,-19]],"#a77b48");
    eye(c, 22, -30);
    line(c,[[18,-36],[25,-36]],OUTLINE,1.4);
  }
  function dinosaur(c, def, phase, horns) {
    const step = Math.sin(phase) * 5;
    const dark=tone(def.color,-39),light=tone(def.color,29);
    shape(c,[[-18,-27],[-41,-25],[-55,-17],[-47,-10],[-25,-16],[-12,-20]],dark);
    limb(c,[[-14,-15],[-17,-5+step],[-25,0+step]],dark,8);
    limb(c,[[12,-15],[15,-5-step],[9,0-step]],dark,8);
    shape(c,[[-29,-3+step],[-17,-3+step],[-14,1+step],[-31,1+step]],def.accent);
    shape(c,[[5,-3-step],[17,-3-step],[20,1-step],[3,1-step]],def.accent);
    ellipse(c,-3,-25,29,18,def.color,OUTLINE);
    ellipse(c,0,-19,21,10,light);
    for(let i=0;i<3;i++)ellipse(c,-20+i*13,-33-(i%2)*3,2.8,1.7,dark);
    shape(c,[[-25,-39],[-21,-49],[-15,-39],[-9,-45],[-4,-39],[3,-48],[11,-35]],def.accent);
    shape(c,[[5,-24],[19,-49],[31,-51],[40,-36],[29,-23]],def.color);
    shape(c,[[21,-40],[37,-39],[49,-34],[46,-27],[29,-27],[18,-32]],light);
    shape(c,[[28,-29],[45,-28],[41,-23],[29,-23]],dark);
    if (horns) {
      shape(c,[[20,-48],[18,-62],[30,-49]],def.accent);
      shape(c,[[31,-45],[42,-55],[37,-38]],def.accent);
    }
    eye(c,32,-43);
    line(c,[[28,-48],[36,-47]],OUTLINE,1.6);
    ellipse(c,43,-34,1.5,1.3,dark);
    shape(c,[[9,-27],[19,-27],[14,-20],[8,-21]],dark);
  }
  function fish(c, def, phase) {
    const tail = Math.sin(phase) * 6;
    const dark=tone(def.color,-38), light=tone(def.color,34);
    c.strokeStyle = "#c9f1eb88";
    c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(0, -4, 39, 11, 0, 0, TAU); c.stroke();
    shape(c,[[-21,-16],[-46,-30+tail],[-40,-13+tail],[-49,-4+tail],[-18,-8]],dark);
    shape(c,[[-22,-16],[-39,-26+tail],[-36,-13+tail],[-41,-7+tail]],def.accent);
    shape(c,[[-8,-20],[-1,-35],[12,-20]],def.accent);
    shape(c,[[0,-9],[9,-1],[19,-10]],dark);
    ellipse(c,1,-14,27,12,def.color,OUTLINE);
    shape(c,[[-19,-13],[-5,-6],[13,-7],[25,-11],[12,-4],[-8,-5]],light,null);
    for(let i=0;i<3;i++)for(let j=0;j<2;j++) {
      c.strokeStyle=dark;c.lineWidth=1.2;c.beginPath();
      c.arc(-9+i*8,-18+j*6,3.2,-1.3,1.2);c.stroke();
    }
    shape(c,[[11,-20],[26,-18],[31,-13],[23,-8],[12,-8]],light);
    eye(c,21,-17);
    line(c,[[29,-11],[35,-10]],OUTLINE,1.2);
    ellipse(c, 38, -24 + Math.sin(phase * 0.6) * 3, 2, 2, "#e5ffffad");
  }
  function amphibian(c, def, phase) {
    const hop = Math.max(0, Math.sin(phase)) * 6;
    const dark=tone(def.color,-37),light=tone(def.color,29);
    limb(c,[[-15,-14-hop],[-27,-5],[-31,0]],dark,8);
    limb(c,[[11,-14-hop],[25,-4],[29,0]],dark,8);
    shape(c,[[-40,-1],[-28,-3],[-20,1],[-36,2]],def.accent);
    shape(c,[[19,-1],[31,-3],[39,1],[23,2]],def.accent);
    ellipse(c,-2,-18-hop,26,14,def.color,OUTLINE);
    ellipse(c,5,-13-hop,14,7,light);
    for(const [x,y] of [[-18,-23],[-7,-29],[2,-24]])ellipse(c,x,y-hop,3,1.5,dark);
    ellipse(c,16,-23-hop,16,12,def.color,OUTLINE);
    ellipse(c,12,-33-hop,6,6,def.accent,OUTLINE,1.3);
    ellipse(c,25,-33-hop,6,6,def.accent,OUTLINE,1.3);
    eye(c,13,-34-hop);eye(c,26,-34-hop);
    line(c,[[20,-19-hop],[33,-18-hop],[28,-14-hop]],OUTLINE,1.3);
    ellipse(c,33,-24-hop,1.4,1.2,dark);
  }
  function beetle(c, def, phase) {
    const dark=tone(def.color,-43),light=tone(def.color,35);
    for (let i = -1; i <= 1; i++) {
      limb(c,[[-10+i*7,-13],[-23+i*10,-7],[-26+i*12,-1+Math.sin(phase+i)*2]],dark,3);
      limb(c,[[10+i*7,-13],[23+i*10,-7],[25+i*11,-1-Math.sin(phase+i)*2]],dark,3);
    }
    ellipse(c,-2,-18,26,17,dark,OUTLINE);
    shape(c,[[-25,-20],[-16,-35],[-2,-35],[-2,-2],[-20,-5]],def.color);
    shape(c,[[-2,-35],[12,-33],[23,-21],[18,-6],[-2,-2]],light);
    line(c,[[-2,-34],[-2,-3]],OUTLINE,2);
    for(let i=0;i<3;i++){
      ellipse(c,-15,-25+i*7,2.4,1.8,def.accent);
      ellipse(c,11,-25+i*7,2.4,1.8,def.accent);
    }
    shape(c,[[18,-26],[29,-27],[35,-20],[31,-13],[20,-12]],def.color);
    shape(c,[[22,-26],[28,-39],[33,-32],[30,-23]],def.accent);
    limb(c,[[29,-23],[36,-31]],dark,1.5);
    limb(c,[[30,-18],[40,-22]],dark,1.5);
    eye(c,28,-20);
  }
  function scorpion(c, def, phase) {
    const dark=tone(def.color,-39),light=tone(def.color,31);
    for (let i = -2; i <= 2; i++) {
      limb(c,[[-4+i*5,-13],[-15+i*8,-7],[-18+i*10,-1+Math.sin(phase+i)*2]],dark,2.6);
      limb(c,[[-3+i*5,-13],[12+i*8,-7],[16+i*9,-1-Math.sin(phase+i)*2]],dark,2.6);
    }
    limb(c,[[-21,-20],[-34,-37],[-39,-54],[-29,-61]],dark,7);
    for(let i=0;i<4;i++)ellipse(c,-25-i*3,-27-i*7,3,2,def.accent,OUTLINE,1);
    shape(c,[[-33,-65],[-22,-64],[-31,-52]],def.accent);
    ellipse(c,-5,-18,23,14,def.color,OUTLINE);
    for(let i=0;i<4;i++)line(c,[[-21+i*9,-29],[-20+i*9,-7]],dark,1.4);
    ellipse(c,17,-20,10,9,light,OUTLINE);
    limb(c,[[19,-17],[33,-21],[39,-12]],def.color,4);
    shape(c,[[36,-16],[49,-22],[44,-11],[37,-9]],def.accent);
    shape(c,[[41,-12],[49,-5],[38,-5]],dark);
    eye(c,22,-24);
  }
  function mantis(c, def, phase) {
    const sway = Math.sin(phase) * 3;
    const dark=tone(def.color,-43),light=tone(def.color,34);
    limb(c,[[-13,-16],[-28,-3],[-35,0]],dark,4);
    limb(c,[[5,-16],[20,-3],[28,1]],dark,4);
    shape(c,[[-31,-35],[-13,-42],[9,-26],[-14,-18]],dark);
    shape(c,[[-27,-34],[-11,-38],[4,-27],[-12,-23]],def.color);
    line(c,[[-22,-32],[-7,-27]],light,1.4);
    limb(c,[[3,-28],[17,-48+sway]],def.color,8);
    ellipse(c,4,-27,6,7,light,OUTLINE);
    limb(c,[[12,-39],[29,-31],[37,-39+sway]],def.color,4);
    limb(c,[[16,-43],[34,-49],[41,-42+sway]],def.color,4);
    shape(c,[[28,-35],[43,-45+sway],[39,-26+sway]],def.accent);
    shape(c,[[34,-50],[43,-43+sway],[39,-59+sway]],def.accent);
    shape(c,[[10,-53+sway],[26,-59+sway],[35,-49+sway],[19,-44+sway]],light);
    eye(c,26,-51+sway);
    line(c,[[24,-58+sway],[27,-70+sway]],dark,1.7);
    line(c,[[30,-56+sway],[39,-67+sway]],dark,1.7);
  }
  function paint(c, def, phase, species) {
    switch (def.kind) {
      case "bird": bird(c, def, phase); break;
      case "dinosaur": dinosaur(c, def, phase, species === "hornsaur"); break;
      case "fish": fish(c, def, phase); break;
      case "amphibian": amphibian(c, def, phase); break;
      case "beetle": beetle(c, def, phase); break;
      case "scorpion": scorpion(c, def, phase); break;
      case "mantis": mantis(c, def, phase); break;
    }
  }
  function framesFor(species, def) {
    let frames = spriteCache.get(species);
    if (frames) return frames;
    frames = [];
    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 204; canvas.height = 159;
      const pen = canvas.getContext("2d");
      pen.scale(1.5, 1.5);
      pen.translate(68, 89);
      paint(pen, def, i * TAU / 4, species);
      frames.push(canvas);
    }
    spriteCache.set(species, frames);
    return frames;
  }
  function draw(c, actor, time = 0, x = actor.x, y = actor.y) {
    const def = window.UZWildlife?.species?.[actor.species];
    if (!def || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const phase = (actor.phase || 0) + time * 2;
    const frame = Math.floor(((phase % TAU + TAU) % TAU) / TAU * 4);
    const height = Number.isFinite(actor.z) ? actor.z : 0;
    const floor = Number.isFinite(actor.groundZ) ? actor.groundZ : 0;
    c.save();
    c.translate(x, y - floor);
    c.save();c.scale(def.size, def.size);
    c.globalAlpha *= Math.max(.25, 1 - (height - floor) / 550);
    ellipse(c, 3, 3, 30, 7, "#1c30383d");c.restore();
    c.translate(0, -(height - floor));c.scale(def.size, def.size);
    c.rotate(actor.angle || 0);
    if (actor.state === "flee") c.translate(0, Math.sin(phase * 2) * 2);
    c.drawImage(framesFor(actor.species, def)[frame], -68, -89, 136, 106);
    c.restore();
  }
  function drawAll(c, actors, time = 0, renderer = null) {
    if (!Array.isArray(actors)) return;
    const delta = clamp(time - lastFrame, 0, 0.12);
    lastFrame = time;
    const seen = new Set();
    for (const actor of actors.slice(0, 28)) {
      if (!actor || typeof actor.id !== "string") continue;
      seen.add(actor.id);
      let p = positions.get(actor.id);
      if (!p || Math.hypot(p.x - actor.x, p.y - actor.y) > 300) p = { x: actor.x, y: actor.y };
      const blend = Math.min(1, delta * 11);
      p.x += (actor.x - p.x) * blend;
      p.y += (actor.y - p.y) * blend;
      positions.set(actor.id, p);
      draw(c, actor, time, p.x, p.y);
      if (renderer) Art.openForeground?.(c, renderer, { ...actor, x: p.x, y: p.y });
    }
    for (const id of positions.keys()) if (!seen.has(id)) positions.delete(id);
  }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  return { draw, drawAll };
})();
