"use strict";
(() => {
  const root = "/assets/ui/generated/",
    $ = (id) => document.getElementById(id);
  const image = (group, n) =>
    `${root}${group}/${String(n).padStart(2, "0")}.png`;
  const title = document.createElement("section");
  title.id = "title-screen";
  title.setAttribute("aria-label", "Menu inicial de Universe Z");
  title.innerHTML = `<div class="title-landscape" aria-hidden="true"></div><div class="title-atmosphere" aria-hidden="true"></div>
    <div class="title-content"><small>UMA NOVA LENDA / UNIVERSO 7</small><img class="title-logo" src="/logo.svg" alt="Universe Z — Destroy the Galaxy">
    <p>O poder é só o começo.<br>O universo é a sua jornada.</p><button id="start-game">START GAME <span>→</span></button>
    <div class="title-actions"><button id="title-fullscreen">Tela cheia</button><button id="title-controls">Controles</button></div>
    <small class="title-version">AVENTURA MULTIPLAYER · BETA 1.0</small></div><div class="title-chapters" aria-hidden="true">
    <span><img src="${image("menu", 1)}" alt="">01 / O CHAMADO</span><span><img src="${image("menu", 8)}" alt="">02 / ALÉM DA TERRA</span><span><img src="${image("menu", 45)}" alt="">03 / SUPERE SEUS LIMITES</span></div>`;
  document.body.append(title);
  const start = () => {
    title.hidden = true;
    $("player-name").focus();
  };
  $("start-game").onclick = start;
  const full = async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };
  $("title-fullscreen").onclick = full;
  $("title-controls").onclick = () => {
    start();
    $("help-button").click();
  };
  const fullButton = document.createElement("button");
  fullButton.className = "icon-button";
  fullButton.textContent = "⛶";
  fullButton.title = "Tela cheia";
  fullButton.setAttribute("aria-label", "Alternar tela cheia");
  fullButton.onclick = full;
  document.querySelector(".server-state").append(fullButton);
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        !title.hidden &&
        e.code === "Enter" &&
        !e.target.closest("button,a")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        start();
      }
    },
    true,
  );
  const artFor = (text) => {
    const s = text.toLowerCase();
    if (/ki|golpe|combate|duelo|defesa|dojo/.test(s)) return image("menu", 45);
    if (/constru|ofício|fabric|projeto/.test(s)) return image("menu", 36);
    if (/equip|mochila|invent|coleção|armadura/.test(s))
      return image("menu", 38);
    if (/conta|acesso|segurança|convite/.test(s)) return image("menu", 3);
    if (/esfera|crônica|jornada|história/.test(s)) return image("menu", 42);
    if (/comunidade|grupo|amig|cooper/.test(s)) return image("menu", 46);
    if (/galáxia|atlas|rota|órbita/.test(s)) return image("menu", 44);
    return image("menu", 1);
  };
  const iconCache = new Map();
  function tabIcon(source) {
    const canvas = document.createElement("canvas");
    canvas.className = "tab-art";
    canvas.width = canvas.height = 64;
    canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d");
    function paint(icon) {
      ctx.clearRect(0, 0, 64, 64);
      const side = Math.max(icon.width, icon.height) * 1.13;
      ctx.drawImage(icon, (64 - icon.width * 64 / side) / 2, (64 - icon.height * 64 / side) / 2,
        icon.width * 64 / side, icon.height * 64 / side);
    }
    const cached = iconCache.get(source);
    if (cached) paint(cached);
    else {
      const img = new Image();
      img.onload = () => {
        const work = document.createElement("canvas");
        work.width = img.naturalWidth; work.height = img.naturalHeight;
        const wc = work.getContext("2d", { willReadFrequently: true });
        wc.drawImage(img, 0, 0);
        const pixels = wc.getImageData(0, 0, work.width, work.height).data;
        let x0 = work.width, y0 = work.height, x1 = 0, y1 = 0;
        for (let y = 0; y < work.height; y++) for (let x = 0; x < work.width; x++) {
          if (pixels[(y * work.width + x) * 4 + 3] < 45) continue;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        if (x1 < x0) return;
        const icon = document.createElement("canvas");
        icon.width = x1 - x0 + 1; icon.height = y1 - y0 + 1;
        icon.getContext("2d").drawImage(work, x0, y0, icon.width, icon.height,
          0, 0, icon.width, icon.height);
        iconCache.set(source, icon);
        for (const target of document.querySelectorAll("canvas.tab-art"))
          if (target.dataset.source === source) {
            const c = target.getContext("2d");
            c.clearRect(0, 0, 64, 64);
            const side = Math.max(icon.width, icon.height) * 1.13;
            c.drawImage(icon, (64 - icon.width * 64 / side) / 2,
              (64 - icon.height * 64 / side) / 2, icon.width * 64 / side,
              icon.height * 64 / side);
          }
      };
      img.src = source;
    }
    canvas.dataset.source = source;
    return canvas;
  }
  function decorate(dialog) {
    if (!dialog.open) return;
    const heading =
      dialog.querySelector("h2")?.textContent ||
      dialog.dataset.presentation ||
      "";
    dialog.style.setProperty(
      "--panel-art",
      `url("${artFor(heading + " " + dialog.dataset.presentation)}")`,
    );
    for (const button of dialog.querySelectorAll(
      ".beta-tabs button,.sandbox-tabs button",
    )) {
      if (button.querySelector(".tab-art")) continue;
      const label = button.textContent.trim();
      button.title = label;
      button.setAttribute("aria-label", label);
      const tabArt = {
        inventory: ["hud", 25],
        explore: ["hud", 35],
        craft: ["menu", 36],
        build: ["hud", 28],
        practice: ["combat", 22],
        contracts: ["hud", 22],
        market: ["hud", 41],
        legacy: ["hud", 39],
        journey: ["menu", 42],
        expeditions: ["menu", 44],
        combat: ["combat", 1],
        collection: ["combat", 39],
        community: ["menu", 46],
        account: ["hud", 40],
        release: ["hud", 27],
      }[button.dataset.tab || button.dataset.betaTab];
      const source = tabArt ? image(...tabArt) : artFor(label);
      button.replaceChildren(tabIcon(source));
    }
    const body = dialog.querySelector(
      "#panel-body,.panel-body,.beta-body,.sandbox-body",
    );
    if (!body) return;
    for (const section of body.querySelectorAll(
      ".beta-section,.sandbox-section",
    )) {
      if (!section.querySelector(":scope > .section-art")) {
        const im = new Image();
        im.className = "section-art";
        im.alt = "";
        im.loading = "lazy";
        im.src = artFor(section.querySelector("h3")?.textContent || heading);
        section.prepend(im);
      }
    }
    for (const p of body.querySelectorAll(
      ".beta-section > p,.sandbox-section > p,.beta-card > p,.panel-intro",
    )) {
      if (p.textContent.length < 190 || p.closest("details")) continue;
      const details = document.createElement("details"),
        summary = document.createElement("summary");
      details.className = "story-detail";
      summary.textContent = "Conheça os detalhes";
      p.replaceWith(details);
      details.append(summary, p);
    }
    for (const row of body.querySelectorAll(
      ".sandbox-row,.technique-row,.chapter-card,.help-item,.place-row",
    )) {
      if (row.querySelector("img,canvas,svg")) continue;
      const im = new Image();
      im.className = "row-art";
      im.alt = "";
      im.loading = "lazy";
      im.src = artFor(row.textContent);
      row.prepend(im);
    }
  }
  const panorama = (world) =>
    root +
    ({ earth: "paozu", namek: "namek", arena: "arena", otherworld: "kame" }[
      world
    ] || "paozu") +
    "-background.jpg";
  window.UZProduction = {
    titleVisible: () => !title.hidden,
    decorate,
    scene(frame, index, world) {
      const cinema = document.querySelector(".cinematic");
      cinema.style.setProperty("--cinema-art", `url("${panorama(world)}")`);
      cinema.dataset.shot = String(index % 3);
      cinema.classList.remove("shot-enter");
      requestAnimationFrame(() => cinema.classList.add("shot-enter"));
    },
  };
})();
