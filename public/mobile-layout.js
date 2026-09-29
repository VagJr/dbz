"use strict";
(() => {
  const hud = document.getElementById("hud");
  const nav = hud?.querySelector(".bottom-nav");
  const chat = hud?.querySelector(".chat-box");
  if (!hud || !nav || !chat) return;

  const mobile = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 600px)");
  const makeToggle = (className, label, icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span aria-hidden="true">${icon}</span>`;
    hud.append(button);
    return button;
  };
  const menuButton = makeToggle("mobile-menu-toggle", "Abrir menu", "☰");
  const chatButton = makeToggle("mobile-chat-toggle", "Abrir conversa", "✉");
  nav.id = "mobile-quick-nav";
  chat.id = "mobile-chat-panel";
  menuButton.setAttribute("aria-controls", nav.id);
  chatButton.setAttribute("aria-controls", chat.id);

  const central = document.createElement("button");
  central.type = "button";
  central.className = "mobile-central";
  central.setAttribute("aria-label", "Abrir central de aventura");
  central.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="/ui-symbols.svg#chronicle"></use></svg><span>Central</span>';
  central.addEventListener("click", () => document.getElementById("beta-launcher")?.click());
  nav.append(central);
  const world = document.createElement("button");
  world.type = "button";
  world.className = "mobile-world";
  world.setAttribute("aria-label", "Abrir ações do mundo");
  world.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="/ui-symbols.svg#atlas"></use></svg><span>Mundo</span>';
  world.addEventListener("click", () => document.getElementById("sandbox-launcher")?.click());
  nav.append(world);

  const setOpen = (kind, open) => {
    const isMenu = kind === "menu";
    const cls = isMenu ? "mobile-menu-open" : "mobile-chat-open";
    const button = isMenu ? menuButton : chatButton;
    document.body.classList.toggle(cls, open && mobile.matches);
    button.setAttribute("aria-expanded", String(open && mobile.matches));
    button.setAttribute("aria-label", `${open ? "Fechar" : "Abrir"} ${isMenu ? "menu" : "conversa"}`);
    if (open) {
      const other = isMenu ? "chat" : "menu";
      setOpen(other, false);
    }
  };
  menuButton.addEventListener("click", () => setOpen("menu", !document.body.classList.contains("mobile-menu-open")));
  chatButton.addEventListener("click", () => setOpen("chat", !document.body.classList.contains("mobile-chat-open")));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("button")) setOpen("menu", false);
  });
  document.getElementById("world")?.addEventListener("pointerdown", () => {
    setOpen("menu", false);
    setOpen("chat", false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen("menu", false);
      setOpen("chat", false);
    }
  });
  mobile.addEventListener("change", () => {
    setOpen("menu", false);
    setOpen("chat", false);
  });
})();
