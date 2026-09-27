const test = require("node:test"),
  assert = require("node:assert/strict");
const { CHARACTERS, WORLDS, ORIGINS } = require("../shared/content");
const designs = require("../shared/character-designs");
test("every catalogue character, world encounter and player origin has an explicit model sheet", () => {
  for (const ch of CHARACTERS)
    assert.ok(designs[ch.skin], `${ch.id} has no design for ${ch.skin}`);
  for (const w of WORLDS) {
    assert.ok(designs[w.skin], w.skin);
    assert.ok(designs[w.enemySkin], w.enemySkin);
  }
  for (const o of ORIGINS) assert.ok(designs[o.skin], o.skin);
  for (const [id, d] of Object.entries(designs)) {
    for (const k of ["cloth", "trim", "skin"])
      assert.match(d[k], /^#[a-f0-9]{6}$/i, `${id}.${k}`);
    assert.ok(Array.isArray(d.flags));
  }
});
test("all models and animations produce finite drawing geometry and balanced canvas states", () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  let depth = 0,
    calls = 0;
  const context = new Proxy(
    {},
    {
      get(_, method) {
        if (method === "save") return () => depth++;
        if (method === "restore")
          return () => {
            depth--;
            assert.ok(depth >= 0);
          };
        if (method === "createRadialGradient")
          return () => ({ addColorStop() {} });
        return (...args) => {
          for (const a of args)
            if (typeof a === "number")
              assert.ok(Number.isFinite(a), String(method));
          calls++;
        };
      },
      set() {
        return true;
      },
    },
  );
  const sandbox = {
    Art: {},
    UZ: require("../shared/content"),
    UZDesigns: designs,
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../public/character-art.js"), "utf8"),
    sandbox,
  );
  for (const ch of CHARACTERS)
    for (const state of [
      "idle",
      "run",
      "fly",
      "dash",
      "attack",
      "guard",
      "charge",
      "chargeAim",
      "blast",
      "stun",
    ])
      for (const t of [0, 0.14, 0.85]) {
        sandbox.Art.fighter(
          context,
          {
            x: 0,
            y: 0,
            skin: ch.skin,
            form: ch.form,
            state,
            combo: 3,
            chargeRatio: 0.9,
            angle: 1.3,
          },
          t,
          1,
        );
        assert.equal(depth, 0, `${ch.id}/${state}`);
      }
  assert.ok(calls > 10000);
});
