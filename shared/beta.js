(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.UZBeta = value;
})(globalThis, () => {
  const cosmetics = [
    {
      id: "trail-cyan",
      name: "Rastro celeste",
      slot: "trail",
      color: "#77e8ff",
      art: 68,
      need: "explore",
      count: 2,
      text: "Descubra duas regiões.",
    },
    {
      id: "trail-gold",
      name: "Rastro dourado",
      slot: "trail",
      color: "#ffc86c",
      art: 67,
      need: "story",
      count: 3,
      text: "Conclua três capítulos.",
    },
    {
      id: "trail-violet",
      name: "Rastro violeta",
      slot: "trail",
      color: "#d6a2ff",
      art: 71,
      need: "challenge",
      count: 1,
      text: "Supere uma expedição.",
    },
    {
      id: "frame-grove",
      name: "Moldura do explorador",
      slot: "frame",
      color: "#9cd78c",
      art: 0,
      need: "explore",
      count: 4,
      text: "Descubra quatro regiões.",
    },
    {
      id: "frame-forge",
      name: "Moldura do inventor",
      slot: "frame",
      color: "#efad76",
      art: 67,
      need: "craft",
      count: 20,
      text: "Acumule 20 pontos de prática de fabricação.",
    },
    {
      id: "frame-legacy",
      name: "Moldura do legado",
      slot: "frame",
      color: "#bca4ff",
      art: 71,
      need: "story",
      count: 28,
      text: "Conclua a campanha persistente.",
    },
  ];
  const expeditions = [
    {
      id: "vanguard",
      name: "Linha de contenção",
      world: "earth",
      x: 6200,
      y: -9400,
      minLevel: 5,
      role: "scout",
      skin: "soldier",
      art: "earth",
      description:
        "Duas ondas: batedores abrem caminho para uma unidade de artilharia.",
    },
    {
      id: "echoes",
      name: "Ecos do vale",
      world: "namek",
      x: 5100,
      y: 3900,
      minLevel: 9,
      role: "artillery",
      skin: "soldier",
      art: "namek",
      description:
        "Interrompa a artilharia e enfrente o executor na segunda onda.",
    },
    {
      id: "ruin",
      name: "Sinal na cidade morta",
      world: "future",
      x: 3200,
      y: 2900,
      minLevel: 14,
      role: "duelist",
      skin: "android",
      art: "future",
      description: "Vença duelistas protegidos por um comandante de choque.",
    },
  ];
  return {
    version: "1.0.0-beta.1",
    cosmetics,
    expeditions,
    policy: {
      payments: false,
      tradeable: false,
      stats: false,
      randomPurchases: false,
    },
  };
});
