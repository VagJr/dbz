"use strict";
(() => {
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, fn, className = "surface-map-button") => {
    const node = create("button", className, label);
    node.type = "button";
    node.addEventListener("click", fn);
    return node;
  };
  const atlas = () => window.UZUniverseAtlas;
  const number = n => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
  const distanceLabel = n => n >= 1000
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n / 1000)} km`
    : `${number(Math.round(n))} m`;
  const hiddenKinds = new Set(["interior", "sky-sanctuary"]);
  const cityKinds = new Set(["city", "village", "district", "market", "port", "hospital", "government"]);
  const sacredKinds = new Set(["palace", "temple", "sanctuary", "training", "tribunal", "tower"]);
  const ranges = [6000, 12000, 24000, 48000, 96000, 192000];
  const hud = document.getElementById("hud"), nav = hud?.querySelector(".bottom-nav");
  let socket = null, notice = null, state = null, world = null, selected = null;
  let region = "nearby", rangeIndex = 2, follow = true, center = { x: 0, y: 0 };
  let pending = false, frame = 0, signature = "", pins = [], drag = null;

  const launcher = button("", () => open(), "surface-map-launcher");
  launcher.id = "surface-map-launcher";
  launcher.title = "Mapa local";
  launcher.setAttribute("aria-label", "Abrir mapa local");
  launcher.setAttribute("aria-controls", "surface-atlas-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.style.setProperty("--nav-art", 'url("/assets/ui/generated/menu/46.png")');
  launcher.append(create("span", "", "Mapa local"));
  launcher.hidden = true;
  if (nav) nav.insertBefore(launcher, nav.lastElementChild);
  else document.body.append(launcher);

  const panel = create("dialog", "surface-atlas-panel");
  panel.id = "surface-atlas-panel";
  panel.dataset.kind = "surface-map";
  panel.setAttribute("aria-labelledby", "surface-atlas-title");
  const header = create("header"), heading = create("div");
  const title = create("h2", "", "Mapa local");
  title.id = "surface-atlas-title";
  heading.append(create("small", "eyebrow", "ROTAS DE SUPERFÍCIE"), title);
  const close = button("×", () => panel.close());
  close.setAttribute("aria-label", "Fechar mapa local");
  header.append(heading, close);
  const body = create("div", "surface-map-body");
  const controls = create("div", "surface-map-controls");
  const select = create("select");
  select.setAttribute("aria-label", "Filtrar locais do mapa");
  select.addEventListener("change", () => {
    region = select.value;
    if (region === "nearby") {
      follow = true;
      center = { x: state.self.x, y: state.self.y };
    } else if (region !== "known") {
      const first = eligibleSites().find(site => site.region === region);
      if (first) { follow = false; center = { x: first.x, y: first.y }; }
    }
    signature = "";
    render();
  });
  const recenter = button("◎", () => {
    follow = true;
    center = { x: state.self.x, y: state.self.y };
    signature = "";
    render();
  });
  recenter.title = "Centralizar no jogador";
  recenter.setAttribute("aria-label", "Centralizar no jogador");
  const zoomOut = button("−", () => zoom(1)), zoomIn = button("+", () => zoom(-1));
  zoomOut.setAttribute("aria-label", "Afastar mapa");
  zoomIn.setAttribute("aria-label", "Aproximar mapa");
  controls.append(select, recenter, zoomOut, zoomIn);
  const viewport = create("div", "surface-map-viewport");
  const canvas = create("canvas", "surface-map-canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Mapa de superfície. Arraste para explorar; use a lista de destinos para marcar uma rota.");
  const legend = create("div", "surface-map-legend");
  legend.append(create("span", "surface-legend-player", "Você"),
    create("span", "surface-legend-city", "Local"), create("span", "surface-legend-route", "Rota"));
  viewport.append(canvas, legend);
  const detail = create("div", "surface-map-detail");
  const status = create("p", "surface-map-status");
  status.setAttribute("role", "status");
  const list = create("div", "surface-map-sites");
  const hint = create("small", "surface-map-hint", "Arraste para explorar · selecione um local para marcar a rota.");
  body.append(controls, viewport, detail, status, list, hint);
  panel.append(header, body);
  document.body.append(panel);
  panel.addEventListener("close", () => launcher.setAttribute("aria-expanded", "false"));

  function position(site) {
    const mapped = typeof window.UZOpenWorld?.atlasPosition === "function"
      ? window.UZOpenWorld.atlasPosition(site) : site.legacyAnchor || site;
    return { ...site, x: Number(mapped.x), y: Number(mapped.y) };
  }
  function worldSites() {
    if (!state?.self || !atlas()?.SITES) return [];
    return atlas().SITES.filter(site => site.world === state.self.world &&
      !hiddenKinds.has(site.kind) && site.id !== "snake-entry")
      .map(position).filter(site => Number.isFinite(site.x) && Number.isFinite(site.y));
  }
  function knownIds() {
    const p = state.self;
    const known = new Set([...(p.universeSites || []), ...(p.surfaceDiscoveries || []), ...(p.discoveredSites || []), ...(p.lore?.done || [])]);
    for (const id of [...known]) if (atlas()?.ALIASES?.[id]) known.add(atlas().ALIASES[id]);
    return known;
  }
  function eligibleSites() {
    const p = state.self, known = knownIds();
    const route = p.surfaceRoute?.world === p.world ? p.surfaceRoute.siteId : null;
    return worldSites().map(site => ({ ...site, distance: Math.hypot(site.x - p.x, site.y - p.y) }))
      .filter(site => site.distance <= 24000 || site.id === route || known.has(site.id) ||
        (site.level <= p.level && ["surface", "current"].includes(site.access || "surface")))
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  }
  function filteredSites() {
    const all = eligibleSites();
    if (region === "nearby") return all.filter(site => site.distance <= 24000 || site.id === state.self.surfaceRoute?.siteId).slice(0, 24);
    if (region === "known") return all.slice(0, 48);
    return all.filter(site => site.region === region).slice(0, 24);
  }
  function say(message, error = false) {
    status.textContent = message || "";
    status.dataset.error = String(error);
    if (error && notice) notice(message);
  }
  function routeTo(site) {
    if (!site || pending) return;
    const connection = socket || window.UZClient?.socket;
    if (!connection || connection.connected === false || typeof connection.timeout !== "function") {
      say("Conectando ao universo. Aguarde um instante.", true);
      return;
    }
    selected = site.id;
    pending = true;
    say(`Marcando ${site.name}…`);
    render();
    connection.timeout(6000).emit("surface:route", { siteId: site.id }, (error, response) => {
      pending = false;
      say(error ? "Sem confirmação. Aguarde a atualização antes de repetir."
        : response?.message || "Resposta indisponível.", !!error || !response?.ok);
      signature = "";
      if (panel.open) render();
    });
  }
  function zoom(direction) {
    rangeIndex = Math.max(0, Math.min(ranges.length - 1, rangeIndex + direction));
    signature = "";
    render();
  }
  function open() {
    if (!state?.self || state.self.world === "space" || hud?.hidden || !atlas()?.SITES ||
        document.querySelector(".cinematic:not([hidden])") || !window.UZWindows) return;
    if (follow) center = { x: state.self.x, y: state.self.y };
    signature = "";
    window.UZWindows.open(panel, "right");
    launcher.setAttribute("aria-expanded", "true");
    render();
  }
  function paint() {
    frame = 0;
    if (!panel.open || !state?.self) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const c = canvas.getContext("2d");
    if (!c) return;
    c.scale(ratio, ratio);
    const range = ranges[rangeIndex], scale = width / range;
    const project = point => ({ x: width / 2 + (point.x - center.x) * scale,
      y: height / 2 + (point.y - center.y) * scale });
    const theme = window.UZ?.getWorld?.(state.self.world);
    c.fillStyle = "#0b2029";
    c.fillRect(0, 0, width, height);
    c.save();
    c.beginPath(); c.rect(0, 0, width, height); c.clip();
    const grid = range <= 12000 ? 2000 : range <= 48000 ? 8000 : 24000;
    c.strokeStyle = "#90b8ae12"; c.lineWidth = 1;
    for (let x = Math.floor((center.x - range / 2) / grid) * grid; x < center.x + range / 2; x += grid) {
      const px = project({ x, y: center.y }).x;
      c.beginPath(); c.moveTo(px, 0); c.lineTo(px, height); c.stroke();
    }
    for (let y = Math.floor((center.y - range) / grid) * grid; y < center.y + range; y += grid) {
      const py = project({ x: center.x, y }).y;
      c.beginPath(); c.moveTo(0, py); c.lineTo(width, py); c.stroke();
    }
    const sites = filteredSites();
    const byId = new Map(sites.map(site => [site.id, site]));
    for (const route of atlas()?.ROUTES || []) {
      const a = byId.get(route.from), b = byId.get(route.to);
      if (!a || !b) continue;
      const start = project(a), end = project(b);
      c.strokeStyle = "#b2baa136"; c.lineWidth = 1; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(start.x, start.y); c.lineTo(end.x, end.y); c.stroke();
    }
    c.setLineDash([]);
    for (const site of sites) {
      const point = project(site), radius = Math.max(10, Math.min(65, Number(site.radius || 1000) * scale * .5));
      if (point.x < -radius || point.x > width + radius || point.y < -radius || point.y > height + radius) continue;
      c.strokeStyle = cityKinds.has(site.kind) ? "#96b29c38" : "#85a99c1c";
      c.fillStyle = cityKinds.has(site.kind) ? "#6a927913" : `${theme?.color || "#749884"}09`;
      c.beginPath(); c.ellipse(point.x, point.y, radius, radius * .65, -.35, 0, Math.PI * 2); c.fill(); c.stroke();
      if (["mountain", "wilderness"].includes(site.kind)) {
        c.beginPath(); c.ellipse(point.x, point.y, radius * .7, radius * .45, -.35, 0, Math.PI * 2); c.stroke();
      }
    }
    const activeRoute = state.self.surfaceRoute;
    if (activeRoute?.world === state.self.world) {
      const start = project(state.self), end = project(activeRoute);
      c.strokeStyle = "#e8c67e"; c.lineWidth = 1.5; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(start.x, start.y); c.lineTo(end.x, end.y); c.stroke();
      c.setLineDash([]);
      c.strokeStyle = "#f4d68d"; c.lineWidth = 1.3;
      c.beginPath(); c.arc(end.x, end.y, 8, 0, Math.PI * 2); c.stroke();
    }
    pins = [];
    const labelBoxes = [];
    for (const site of sites) {
      const point = project(site);
      if (point.x < 8 || point.x > width - 8 || point.y < 8 || point.y > height - 8) continue;
      const active = site.id === activeRoute?.siteId || site.id === selected;
      c.fillStyle = active ? "#f0ce84" : cityKinds.has(site.kind) ? "#b3d5bd" : sacredKinds.has(site.kind) ? "#bdafd5" : "#8aafb1";
      c.strokeStyle = "#09212a"; c.lineWidth = 2;
      c.beginPath();
      if (cityKinds.has(site.kind)) c.rect(point.x - 3, point.y - 3, 6, 6);
      else if (sacredKinds.has(site.kind)) {
        c.moveTo(point.x, point.y - 4); c.lineTo(point.x + 4, point.y);
        c.lineTo(point.x, point.y + 4); c.lineTo(point.x - 4, point.y); c.closePath();
      } else c.arc(point.x, point.y, 3, 0, Math.PI * 2);
      c.fill(); c.stroke();
      pins.push({ ...point, site });
      if (active || ["city", "village", "home", "arrival"].includes(site.kind)) {
        const text = site.name.length > 25 ? `${site.name.slice(0, 24)}…` : site.name;
        c.font = "9px system-ui";
        const textWidth = Math.min(width - 18, c.measureText(text).width);
        const lx = Math.max(8, Math.min(width - textWidth - 8, point.x + 7)), ly = Math.max(16, point.y - 6);
        const box = { x: lx - 2, y: ly - 10, w: textWidth + 4, h: 12 };
        if (active || !labelBoxes.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y)) {
          labelBoxes.push(box);
          c.fillStyle = "#0b202ad9"; c.fillRect(box.x, box.y, box.w, box.h);
          c.fillStyle = active ? "#f0ce84" : "#b7ccbf"; c.fillText(text, lx, ly);
        }
      }
    }
    const player = project(state.self);
    if (player.x >= 5 && player.x <= width - 5 && player.y >= 5 && player.y <= height - 5) {
      c.save(); c.translate(player.x, player.y); c.rotate(Number(state.self.angle) || 0);
      c.strokeStyle = "#0b2029"; c.lineWidth = 2; c.fillStyle = "#8be7f0";
      c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -4); c.lineTo(-2, 0); c.lineTo(-4, 4); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    c.restore();
    c.fillStyle = "#bdcebf"; c.font = "9px system-ui"; c.fillText("N ↑", width - 25, 13);
    const scaleUnits = range <= 24000 ? 2000 : range <= 96000 ? 10000 : 25000;
    const scalePx = scaleUnits * scale;
    c.strokeStyle = "#bdcebf"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(10, height - 11); c.lineTo(10 + scalePx, height - 11); c.stroke();
    c.fillText(distanceLabel(scaleUnits), 10, height - 17);
  }
  function schedulePaint() { if (!frame) frame = requestAnimationFrame(paint); }
  function updateRegions() {
    const values = [...new Set(eligibleSites().map(site => site.region))].sort((a, b) => a.localeCompare(b));
    const valid = ["nearby", "known", ...values];
    if (!valid.includes(region)) region = "nearby";
    select.replaceChildren();
    for (const [id, label] of [["nearby", "Locais próximos"], ["known", "Locais acessíveis"], ...values.map(value => [value, value])]) {
      const option = create("option", "", label); option.value = id; select.append(option);
    }
    select.value = region;
  }
  function render() {
    if (!state?.self) return;
    title.textContent = window.UZ?.getWorld?.(state.self.world)?.name || "Mapa local";
    updateRegions();
    zoomOut.disabled = rangeIndex === ranges.length - 1;
    zoomIn.disabled = rangeIndex === 0;
    recenter.setAttribute("aria-pressed", String(follow));
    const route = state.self.surfaceRoute;
    detail.replaceChildren();
    if (route?.world === state.self.world) {
      detail.append(create("strong", "", `◇ ${route.name}`),
        create("span", "", `${distanceLabel(Math.hypot(route.x - state.self.x, route.y - state.self.y))} até o destino`));
    } else detail.append(create("span", "", "Marque um destino para seguir pelo mundo."));
    const visible = filteredSites().sort((a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
    list.replaceChildren();
    if (!visible.length) list.append(create("p", "surface-map-empty", "Explore os arredores para encontrar novos locais."));
    for (const site of visible.slice(0, 5)) {
      const row = button("", () => routeTo(site), "surface-map-site");
      row.disabled = pending;
      row.setAttribute("aria-label", `Marcar rota para ${site.name}, ${distanceLabel(site.distance)}`);
      row.setAttribute("aria-pressed", String(site.id === route?.siteId));
      const copy = create("span", "surface-map-site-copy");
      copy.append(create("strong", "", site.name), create("small", "", `${site.region} · nível ${site.level}`));
      row.append(copy, create("span", "surface-map-distance", distanceLabel(site.distance)));
      list.append(row);
    }
    schedulePaint();
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, center: { ...center }, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    follow = false;
    const units = ranges[rangeIndex] / Math.max(1, canvas.clientWidth);
    center = { x: drag.center.x - dx * units, y: drag.center.y - dy * units };
    recenter.setAttribute("aria-pressed", "false");
    schedulePaint();
  });
  canvas.addEventListener("pointerup", event => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) {
      const bounds = canvas.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      const pin = pins.map(item => ({ ...item, distance: Math.hypot(item.x - x, item.y - y) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (pin?.distance <= 14) routeTo(pin.site);
    } else { signature = ""; render(); }
  });
  const cancelDrag = () => { if (drag) { drag = null; signature = ""; render(); } };
  canvas.addEventListener("lostpointercapture", cancelDrag);
  canvas.addEventListener("pointercancel", cancelDrag);
  canvas.addEventListener("wheel", event => {
    event.preventDefault(); zoom(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault(); event.stopPropagation(); follow = false;
      const [x, y] = arrows[event.key];
      center.x += x * ranges[rangeIndex] * .18; center.y += y * ranges[rangeIndex] * .18;
      signature = ""; render();
    } else if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); zoom(event.key === "-" ? 1 : -1);
    }
  });
  addEventListener("resize", schedulePaint);
  function init(options = {}) {
    socket = options.socket || window.UZClient?.socket || socket;
    notice = typeof options.notice === "function" ? options.notice : notice;
  }
  function update(next) {
    state = next;
    launcher.hidden = !next?.self || next.self.world === "space" || !atlas()?.SITES;
    if (launcher.hidden) { if (panel.open) panel.close(); return; }
    if (world !== next.self.world) {
      world = next.self.world; region = "nearby"; follow = true; selected = null; signature = "";
    }
    if (follow) center = { x: next.self.x, y: next.self.y };
    if (!panel.open) return;
    const nextSignature = JSON.stringify({ world, region, level: next.self.level,
      x: Math.round(next.self.x / 200), y: Math.round(next.self.y / 200),
      known: [...knownIds()], route: next.self.surfaceRoute, rangeIndex, pending });
    if (nextSignature !== signature) { render(); signature = nextSignature; }
    else schedulePaint();
  }
  window.UZSurfaceAtlasUI = { init, connect: connection => init({ socket: connection }), update, open };
})();
