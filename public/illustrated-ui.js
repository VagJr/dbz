"use strict";
(() => {
  const root = "/assets/ui/generated/";
  const worlds = {
    earth: 1,
    namek: 8,
    vegeta: 22,
    future: 24,
    otherworld: 17,
    demon: 27,
    vampa: 29,
    divine: 20,
    arena: 4,
    yardrat: 23,
    cereal: 31,
    sadala: 22,
    champa: 20,
    tsufuru: 33,
    kanassa: 8,
    konatsu: 32,
    sacred: 19,
    zeno: 21,
    frieza: 11,
  };
  const techniques = {
    ki: 8,
    kame: 9,
    makan: 11,
    galick: 10,
    genki: 16,
    divine: 21,
    teleport: 29,
  };
  const origins = { saiyan: 22, earthling: 12, namekian: 27, majin: 28 };
  const asset = (group, index) =>
    `${root}${group}/${String(index).padStart(2, "0")}.png?v=celestial1`;
  const picture = (group, index, cls = "") => {
    const im = new Image();
    im.src = asset(group, index);
    im.alt = "";
    im.className = cls;
    return im;
  };
  window.UZUI = {
    worldCard(node, world) {
      node.dataset.world = world;
      node.style.setProperty(
        "--card-scene",
        `url("${asset("menu", worlds[world] || 44)}")`,
      );
    },
    technique(node, id) {
      const im = picture("combat", techniques[id] || 8, "technique-art");
      im.loading = "lazy";
      node.prepend(im);
    },
    equipped(id) {
      const node = document.querySelector('[data-action="blast"]');
      if (node && node.dataset.art !== id) {
        node.dataset.art = id;
        node.style.setProperty(
          "--button-art",
          `url("${asset("combat", techniques[id] || 8)}")`,
        );
      }
    },
    origin(id) {
      let im = document.getElementById("origin-art");
      if (!im) {
        im = picture("combat", 22);
        im.id = "origin-art";
        document.querySelector(".origin-preview").prepend(im);
      }
      im.src = UZPortrait.origin(id) || asset("combat", origins[id] || 22);
      document.querySelectorAll(".origin-choice").forEach((b) => {
        if (!b.querySelector("img"))
          {const icon=new Image();icon.alt='';icon.src=UZPortrait.origin(b.dataset.origin);b.prepend(icon);}
      });
    },
    hero(node, origin, form) {
      const im = picture(
        "combat",
        form && origin === "saiyan" ? 23 : origins[origin] || 22,
        "hero-illustration",
      );
      im.src=UZPortrait.origin(origin)||im.src;
      node.prepend(im);
    },
    panel(type) {
      const panel = document.getElementById("panel");
      panel.append(document.getElementById("close-panel"));
      let im = panel.querySelector(".panel-emblem");
      if (!im) {
        im = picture("menu", 44, "panel-emblem");
        panel.querySelector("header").prepend(im);
      }
      const entries = {
        atlas: ["menu", 44, "01 / EXPLORAÇÃO"],
        campaigns: ["menu", 42, "02 / CRÔNICAS"],
        character: ["combat", 49, "03 / GUERREIRO"],
        settings: ["hud", 40, "04 / SISTEMA"],
        help: ["hud", 27, "05 / MANUAL DE COMBATE"],
      };
      const [group, index, label] = entries[type] || entries.help;
      im.src = asset(group, index);
      document.getElementById("panel-eyebrow").textContent = label;
    },
    state(p) {
      document.body.classList.toggle("in-combat", !!p.targetId);
      document.body.classList.toggle("has-lore", !!p.loreObjective);
    },
  };
  for (const [action, index] of Object.entries({
    cycleTarget: 7,
    attack: 1,
    blast: 8,
    dash: 6,
    guard: 5,
    kaioken: 25,
  })) {
    const b = document.querySelector(`[data-action="${action}"]`);
    if (!b) continue;
    b.style.setProperty("--button-art", `url("${asset("combat", index)}")`);
    if (!b.querySelector("i")) {
      const mask = document.createElement("i");
      mask.setAttribute("aria-hidden", "true");
      b.append(mask);
    }
    if (action === "cycleTarget") {
      const k = document.createElement("kbd");
      k.textContent = "TAB";
      b.prepend(k);
    }
    if (action === "kaioken") {
      b.replaceChildren();
      const label = document.createElement("strong");
      label.textContent = "Kaioken";
      const k = document.createElement("kbd");
      k.textContent = "X";
      b.append(k, label, document.createElement("i"));
    }
  }
  document
    .getElementById("awaken-button")
    .style.setProperty("--button-art", `url("${asset("combat", 49)}")`);
  const nav = {
    atlas: ["menu", 44],
    campaigns: ["menu", 42],
    character: ["combat", 22],
    settings: ["hud", 40],
  };
  document.querySelectorAll(".bottom-nav button").forEach((b) => {
    const [group, index] = nav[b.dataset.panel];
    b.style.setProperty("--nav-art", `url("${asset(group, index)}")`);
    b.setAttribute("aria-label", b.textContent.trim());
    b.title = b.textContent.trim();
  });
})();
