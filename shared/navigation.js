(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./content"));
  else root.UZNav = factory(root.UZ);
})(typeof globalThis !== "undefined" ? globalThis : this, function (UZ) {
  // Travel coordinates are gameplay distances, not canonical astronomical measurements.
  const nodes = UZ.WORLDS.map((world, i) => ({
    ...world,
    x: i === 0 ? 0 : Math.cos(i * 2.399963) * (6500 + Math.sqrt(i) * 4200),
    y: i === 0 ? 0 : Math.sin(i * 2.399963) * (6500 + Math.sqrt(i) * 4200),
    radius: 520 + (world.seed % 5) * 65,
    realm: [
      "otherworld",
      "demon",
      "divine",
      "arena",
      "sacred",
      "zeno",
      "future",
    ].includes(world.id),
  }));
  const get = (id) => nodes.find((n) => n.id === id);
  const nearest = (p) =>
    nodes.reduce((best, n) => {
      const distance = Math.max(0, Math.hypot(p.x - n.x, p.y - n.y) - n.radius);
      return !best || distance < best.distance ? { ...n, distance } : best;
    }, null);
  return { nodes, get, nearest, entryRange: 650 };
});
