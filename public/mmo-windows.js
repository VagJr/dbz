"use strict";
(() => {
  const windows = new Map();
  let layer = 40;
  const storageKey = "uz-window-layout-v1";
  const mobileLayout = () =>
    matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 600px)").matches;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {}
  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {}
  };
  function clamp(panel) {
    const r = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(6, Math.min(r.left, innerWidth - r.width - 6))}px`;
    panel.style.top = `${Math.max(6, Math.min(r.top, innerHeight - Math.min(r.height, 46) - 6))}px`;
  }
  function raise(panel) {
    panel.style.zIndex = ++layer;
  }
  function register(panel, side = "left") {
    if (windows.has(panel.id)) return panel;
    windows.set(panel.id, panel);
    panel.classList.add("mmo-window");
    panel.dataset.side = side;
    const head = panel.querySelector(":scope > header");
    if (head) {
      const tools = document.createElement("div");
      tools.className = "window-tools";
      const minimize = document.createElement("button");
      minimize.type = "button";
      minimize.textContent = "−";
      minimize.title = "Recolher janela";
      minimize.setAttribute("aria-label", "Recolher janela");
      minimize.setAttribute("aria-expanded", "true");
      minimize.onclick = () => {
        const collapsed = panel.classList.toggle("window-collapsed");
        minimize.textContent = collapsed ? "+" : "−";
        minimize.setAttribute("aria-expanded", String(!collapsed));
        minimize.setAttribute(
          "aria-label",
          collapsed ? "Expandir janela" : "Recolher janela",
        );
      };
      const close = head.querySelector("button");
      tools.append(minimize);
      if (close) tools.append(close);
      head.append(tools);
      let drag = null;
      head.addEventListener("pointerdown", (e) => {
        if (mobileLayout()) return;
        if (e.button !== 0 || e.target.closest("button,a,input,select")) return;
        const r = panel.getBoundingClientRect();
        drag = { x: e.clientX - r.left, y: e.clientY - r.top };
        head.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      head.addEventListener("pointermove", (e) => {
        if (!drag) return;
        panel.style.left = `${e.clientX - drag.x}px`;
        panel.style.top = `${e.clientY - drag.y}px`;
        clamp(panel);
      });
      const finish = () => {
        if (!drag) return;
        drag = null;
        saved[panel.id] = {
          x: parseFloat(panel.style.left),
          y: parseFloat(panel.style.top),
        };
        persist();
      };
      head.addEventListener("pointerup", finish);
      head.addEventListener("lostpointercapture", finish);
      head.addEventListener("pointercancel", finish);
    }
    panel.addEventListener("pointerdown", () => raise(panel));
    panel.addEventListener("focusin", () => raise(panel));
    return panel;
  }
  function open(panel, side = "left") {
    register(panel, side);
    if (mobileLayout()) {
      for (const other of windows.values()) {
        if (other !== panel && other.open) other.close();
      }
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
    }
    const wasOpen = panel.open;
    const focus = document.activeElement;
    if (!wasOpen) {
      panel.show();
      if (!mobileLayout()) {
        const position = saved[panel.id];
        if (position) {
          panel.style.left = `${position.x}px`;
          panel.style.top = `${position.y}px`;
        } else {
          const offset =
            [...windows.values()].filter(
              (p) => p !== panel && p.open && p.dataset.side === side,
            ).length * 28;
          panel.style.left = `${side === "right" ? innerWidth - panel.offsetWidth - 16 - offset : 16 + offset}px`;
          const anchor = document.querySelector(
            side === "right" ? ".radar-card" : ".player-card",
          );
          const safeTop = Math.max(
            110,
            (anchor?.getBoundingClientRect().bottom || 124) + 8,
          );
          panel.style.top = `${Math.max(12, Math.min(safeTop + offset, innerHeight - panel.offsetHeight - 12))}px`;
        }
        clamp(panel);
      }
      // Opening a utility window must not take keyboard focus from combat.
      if (focus?.isConnected && !focus.closest("dialog"))
        focus.focus({ preventScroll: true });
    }
    raise(panel);
    requestAnimationFrame(() => window.UZProduction?.decorate(panel));
  }
  const blocksPlay = () => !!document.querySelector("dialog:modal");
  function closeTop() {
    const top = [...windows.values()]
      .filter((p) => p.open)
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
    if (!top) return false;
    top.close();
    return true;
  }
  addEventListener("resize", () => {
    if (!mobileLayout()) for (const p of windows.values()) if (p.open) clamp(p);
  });
  window.UZWindows = { register, open, blocksPlay, closeTop };
  // The live fills use the full inner width of each angular HUD track.
  for (const kind of ["hp", "ki"]) {
    const bar = document.querySelector(`.player-card .bar.${kind}`);
    if (!bar) continue;
    const track = document.createElement("div");
    track.className = "vital-track";
    track.append(bar.querySelector("i"));
    bar.prepend(track);
  }
  const bag = document.createElement("button");
  bag.type = "button";
  bag.className = "micro-bag";
  bag.title = "Mochila · B";
  bag.setAttribute("aria-label", "Mochila · B");
  bag.style.setProperty("--nav-art", 'url("/assets/ui/generated/hud/25.png")');
  bag.innerHTML = "<span>Mochila</span>";
  bag.onclick = () => window.UZSandboxUI?.open("inventory");
  document.querySelector(".bottom-nav")?.prepend(bag);
})();
