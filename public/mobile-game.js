"use strict";
(() => {
  const hud = document.getElementById("hud");
  const portrait = hud?.querySelector(".portrait-small");
  const radar = hud?.querySelector(".radar-card");
  if (!portrait || !radar) return;

  const character = document.createElement("button");
  character.type = "button";
  character.className = "mobile-character-open";
  character.setAttribute("aria-label", "Abrir painel do guerreiro");
  character.addEventListener("click", () => document.getElementById("character-button")?.click());
  portrait.parentElement.append(character);

  const map = document.createElement("button");
  map.type = "button";
  map.className = "mobile-radar-open";
  map.setAttribute("aria-label", "Abrir mapa local");
  map.addEventListener("click", () => {
    if (window.UZSurfaceAtlasUI?.open) window.UZSurfaceAtlasUI.open();
    else document.getElementById("map-button")?.click();
  });
  radar.append(map);

  const menuToggle = hud.querySelector(".mobile-menu-toggle span");
  if (menuToggle) menuToggle.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="/ui-symbols.svg#atlas"></use></svg>';
  const chatToggle = hud.querySelector(".mobile-chat-toggle span");
  if (chatToggle) chatToggle.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 8h32v26H23L12 41v-7H8z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 17h18M15 24h13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  const quest = hud.querySelector(".quest-card");
  if (!quest) return;
  const mobile = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 600px)");
  const extra = document.createElement("div");
  extra.className = "mobile-objective-extra";
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "mobile-objective-expand";
  expand.setAttribute("aria-label", "Mostrar detalhes do objetivo atual");
  expand.setAttribute("aria-controls", "quest-description");
  expand.setAttribute("aria-expanded", "false");
  quest.append(extra, expand);
  quest.setAttribute("aria-expanded", "false");

  const closeObjective = () => {
    if (!document.body.classList.contains("mobile-objective-open")) return;
    document.body.classList.remove("mobile-objective-open");
    quest.setAttribute("aria-expanded", "false");
    expand.setAttribute("aria-expanded", "false");
    expand.setAttribute("aria-label", "Mostrar detalhes do objetivo atual");
  };
  const readDetails = () => {
    extra.replaceChildren();
    const tutorial = document.querySelector(".tutorial-card:not([hidden])");
    if (tutorial) {
      const note = document.createElement("p");
      note.className = "mobile-objective-note";
      note.textContent = [tutorial.querySelector("strong")?.textContent, tutorial.querySelector("p")?.textContent]
        .filter(Boolean).join(" · ");
      extra.append(note);
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "mobile-objective-dismiss";
      dismiss.textContent = "Dispensar dica";
      dismiss.addEventListener("click", () => {
        tutorial.querySelector("button")?.click();
        readDetails();
      });
      extra.append(dismiss);
    }
    const lore = document.getElementById("lore-objective");
    if (lore?.textContent) {
      const note = document.createElement("p");
      note.className = "mobile-objective-note";
      note.textContent = lore.textContent;
      extra.append(note);
    }
  };
  const toggleObjective = () => {
    if (!mobile.matches || hud.hidden || document.body.classList.contains("combat-focus")) return;
    const open = !document.body.classList.contains("mobile-objective-open");
    document.body.classList.toggle("mobile-objective-open", open);
    quest.setAttribute("aria-expanded", String(open));
    expand.setAttribute("aria-expanded", String(open));
    expand.setAttribute("aria-label", open ? "Recolher objetivo atual" : "Mostrar detalhes do objetivo atual");
    if (open) {
      readDetails();
      document.body.classList.remove("mobile-menu-open", "mobile-chat-open");
      for (const button of hud.querySelectorAll(".mobile-menu-toggle, .mobile-chat-toggle"))
        button.setAttribute("aria-expanded", "false");
    }
  };
  expand.addEventListener("click", toggleObjective);
  document.getElementById("world")?.addEventListener("pointerdown", closeObjective);
  quest.querySelector("#campaign-button")?.addEventListener("click", closeObjective);
  hud.querySelector(".mobile-menu-toggle")?.addEventListener("click", closeObjective);
  hud.querySelector(".mobile-chat-toggle")?.addEventListener("click", closeObjective);
  document.addEventListener("beta-open", closeObjective);
  mobile.addEventListener("change", closeObjective);
  new MutationObserver(() => {
    if (document.body.classList.contains("combat-focus") &&
        document.body.classList.contains("mobile-objective-open")) closeObjective();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
