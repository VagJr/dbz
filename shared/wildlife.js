(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UZWildlife = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Peaceful ambient creatures. These are scenery actors, never combat targets.
  const species = Object.freeze({
    skybird: Object.freeze({ id: "skybird", world: "earth", kind: "bird", name: "Pássaro das montanhas", color: "#dca966", accent: "#f3dfae", size: 0.96, speed: 86 }),
    fieldbird: Object.freeze({ id: "fieldbird", world: "earth", kind: "bird", name: "Ave do campo", color: "#6e9b91", accent: "#e9d59b", size: 0.84, speed: 71 }),
    minisaur: Object.freeze({ id: "minisaur", world: "earth", kind: "dinosaur", name: "Pequeno dinossauro", color: "#83a66d", accent: "#d6bd7e", size: 1.25, speed: 49 }),
    hornsaur: Object.freeze({ id: "hornsaur", world: "earth", kind: "dinosaur", name: "Dinossauro de chifres", color: "#bd9270", accent: "#e4c59d", size: 1.18, speed: 43 }),
    bluefin: Object.freeze({ id: "bluefin", world: "namek", kind: "fish", name: "Peixe de Namekusei", color: "#55b8bd", accent: "#c8eee0", size: 0.98, speed: 56 }),
    ripplefin: Object.freeze({ id: "ripplefin", world: "namek", kind: "fish", name: "Peixe das três luas", color: "#8c9fcb", accent: "#d1e6d2", size: 0.88, speed: 67 }),
    ajisa_frog: Object.freeze({ id: "ajisa_frog", world: "namek", kind: "amphibian", name: "Anfíbio ajisa", color: "#87bb87", accent: "#cfdfac", size: 1.07, speed: 34 }),
    moss_hopper: Object.freeze({ id: "moss_hopper", world: "namek", kind: "amphibian", name: "Saltador dos lagos", color: "#b8a382", accent: "#d9d4ac", size: 0.96, speed: 42 }),
    vampa_beetle: Object.freeze({ id: "vampa_beetle", world: "vampa", kind: "beetle", name: "Besouro de Vampa", color: "#767b50", accent: "#d4aa6e", size: 1.13, speed: 49 }),
    vampa_scorpion: Object.freeze({ id: "vampa_scorpion", world: "vampa", kind: "scorpion", name: "Escorpião de Vampa", color: "#a77a56", accent: "#e1b77d", size: 1.16, speed: 57 }),
    dust_mantis: Object.freeze({ id: "dust_mantis", world: "vampa", kind: "mantis", name: "Louva-a-deus do ermo", color: "#a0a65f", accent: "#ead4a0", size: 1.12, speed: 62 }),
  });
  const byWorld = Object.freeze({
    earth: Object.freeze(["skybird", "fieldbird", "minisaur", "hornsaur"]),
    namek: Object.freeze(["bluefin", "ripplefin", "ajisa_frog", "moss_hopper"]),
    vampa: Object.freeze(["vampa_beetle", "vampa_scorpion", "dust_mantis"]),
  });
  return Object.freeze({ species, byWorld, MAX_GLOBAL: 80, MAX_VISIBLE: 28, STEP_SECONDS: 0.2 });
});
