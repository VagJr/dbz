(() => {
  "use strict";

  const mobile = matchMedia("(pointer: coarse), (max-width: 760px)");
  const standalone = matchMedia("(display-mode: standalone)");
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const iosSafari = ios && /Safari/.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
  const STORAGE_KEY = "universe-z-pwa-dismissed-until";
  const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
  let deferredPrompt = null;
  let card = null;
  let offerTimer = null;
  let enteringGame = false;

  function installed() {
    return standalone.matches || navigator.standalone === true;
  }

  function dismissed() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) > Date.now(); }
    catch { return false; }
  }

  function snooze() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now() + SNOOZE_MS)); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }

  function hide() {
    if (offerTimer) clearTimeout(offerTimer);
    offerTimer = null;
    card?.remove();
    card = null;
  }

  function show(kind) {
    if (card || enteringGame || !mobile.matches || installed() || dismissed() || !window.isSecureContext) return;
    if (document.getElementById("welcome")?.hidden) return;
    card = document.createElement("aside");
    card.className = "pwa-install-card";
    card.dataset.kind = kind;
    card.setAttribute("aria-label", "Instalar Universe Z");

    const icon = document.createElement("img");
    icon.src = "/assets/pwa/icon-192.png";
    icon.alt = "";
    icon.width = 48;
    icon.height = 48;

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Universe Z no seu celular";
    const description = document.createElement("p");
    description.textContent = kind === "ios"
      ? (iosSafari
        ? "Toque em Compartilhar e depois em Adicionar à Tela de Início."
        : "Abra esta página no Safari. Toque em Compartilhar e em Adicionar à Tela de Início.")
      : kind === "manual"
        ? "No menu do navegador, escolha Instalar app ou Adicionar à tela inicial."
        : "Instale o jogo para abrir direto da sua tela inicial.";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "pwa-install-action";
    action.textContent = kind === "native" ? "Instalar jogo" : "Entendi";
    action.addEventListener("click", async () => {
      if (kind !== "native") { snooze(); hide(); return; }
      const prompt = deferredPrompt;
      if (!prompt) { hide(); return; }
      deferredPrompt = null;
      hide();
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome !== "accepted") snooze();
      } catch {
        snooze();
      }
    });

    const close = document.createElement("button");
    close.type = "button";
    close.className = "pwa-install-close";
    close.setAttribute("aria-label", "Fechar convite de instalação");
    close.textContent = "×";
    close.addEventListener("click", () => { snooze(); hide(); });

    content.append(title, description, action);
    card.append(icon, content, close);
    document.body.append(card);
  }

  function offer(kind) {
    if (offerTimer || card || dismissed() || installed() || !mobile.matches) return;
    offerTimer = setTimeout(() => {
      offerTimer = null;
      show(kind);
    }, 1200);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    if (!mobile.matches) return;
    event.preventDefault();
    deferredPrompt = event;
    if (card?.dataset.kind === "manual") hide();
    offer("native");
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hide();
  });
  standalone.addEventListener?.("change", () => { if (installed()) hide(); });

  if (ios) offer("ios");
  else if (mobile.matches) setTimeout(() => {
    if (!deferredPrompt) offer("manual");
  }, 2600);

  function onEnterGame() { enteringGame = true; hide(); }
  document.getElementById("join-form")?.addEventListener("submit", onEnterGame);
  document.getElementById("resume-button")?.addEventListener("click", onEnterGame);

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" })
        .catch(() => { /* Gameplay remains available if registration fails. */ });
    }, { once: true });
  }

  // Prevent long-press browser menus in the game while preserving editable fields.
  const gameSurface = "body";
  function isGameTarget(target) {
    return target instanceof Element &&
      !target.closest("input, textarea, select, [contenteditable]") &&
      !!target.closest(gameSurface);
  }
  document.addEventListener("contextmenu", (event) => {
    if (mobile.matches && isGameTarget(event.target)) event.preventDefault();
  });
  document.addEventListener("selectstart", (event) => {
    if (mobile.matches && isGameTarget(event.target)) event.preventDefault();
  });
  document.addEventListener("dragstart", (event) => {
    if (mobile.matches && isGameTarget(event.target)) event.preventDefault();
  });
})();
