const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { start } = require("../server");
const { chromium } = require(
  process.env.UZ_PLAYWRIGHT_PATH ||
    "C:/Users/vagmi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
async function openCentral(page) {
  if (await page.locator("#beta-launcher").isVisible())
    await page.locator("#beta-launcher").click();
  else {
    await page.locator(".mobile-menu-toggle").click();
    await page.locator(".mobile-central").click();
  }
}
(async () => {
  const folder = path.resolve(".preview-data/beta");
  await fs.mkdir(folder, { recursive: true });
  const captures = await fs.mkdtemp(path.join(folder, "screens-"));
  const app = await start({
    port: 0,
    dataDir: await fs.mkdtemp(path.join(folder, "run-")),
  });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const report = [];
  try {
    for (const [name, width, height, touch] of [
      ["desktop", 1440, 900, false],
      ["mobile", 390, 844, true],
      ["landscape", 844, 390, true],
      ["compact", 360, 640, true],
    ]) {
      if (process.argv[2] && process.argv[2] !== name) continue;
      const ctx = await browser.newContext({
          viewport: { width, height },
          hasTouch: touch,
          isMobile: touch,
        }),
        page = await ctx.newPage(),
        errors = [],
        missing = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) missing.push(r.status() + " " + r.url());
      });
      await page.goto("http://localhost:" + app.server.address().port, {
        waitUntil: "networkidle",
      });
      await page.screenshot({ path: path.join(captures, name + "-welcome.png") });
      await page.locator("#start-game").click();
      await page.locator("#player-name").fill("Beta " + name);
      await page.locator("#join-button").click();
      await page.locator("#skip-scene").click();
      if (await page.locator("#tutorial-dismiss").isVisible())
        await page.locator("#tutorial-dismiss").click();
      else {
        await page.locator(".mobile-objective-expand").click();
        await page.locator(".mobile-objective-dismiss").click();
      }
      const p = [...app.engine.players.values()].find(
        (p) => p.name === "Beta " + name,
      );
      app.engine.enemies = [];
      p.invuln = app.engine.time + 10000;
      p.sandbox.discoveries = ["earth:a", "earth:b"];
      await openCentral(page);
      for (const tab of [
        "journey",
        "expeditions",
        "combat",
        "collection",
        "community",
        "account",
        "release",
      ]) {
        await page.locator('[data-beta-tab="' + tab + '"]').click();
        await page.waitForTimeout(120);
        const size = await page
          .locator(".beta-body")
          .evaluate((e) => ({
            w: e.clientWidth, sw: e.scrollWidth,
            overflow: [...e.querySelectorAll("*")]
              .filter((item) => item.getBoundingClientRect().right > e.getBoundingClientRect().right + 1)
              .slice(0, 6).map((item) => `${item.tagName.toLowerCase()}.${item.className}`),
          }));
        assert.ok(
          size.sw <= size.w + 1,
          name + " " + tab + " horizontal overflow " + JSON.stringify(size),
        );
        await page.screenshot({
          path: path.join(captures, name + "-" + tab + ".png"),
        });
      }
      const pos = { x: p.x, y: p.y };
      await page.keyboard.down("KeyW");
      await page.keyboard.press("KeyJ");
      await page.waitForTimeout(350);
      await page.keyboard.up("KeyW");
      assert.ok(
        Math.hypot(pos.x - p.x, pos.y - p.y) > 10,
        "Utility windows preserve movement while playing",
      );
      await page.locator('[data-beta-tab="collection"]').click();
      const cyan = page
        .locator(".beta-card")
        .filter({ hasText: "Rastro celeste" });
      await cyan.getByRole("button", { name: "Resgatar", exact: true }).click();
      await cyan.getByRole("button", { name: "Aplicar", exact: true }).click();
      await cyan
        .getByRole("button", { name: "Remover", exact: true })
        .waitFor();
      assert.equal(p.beta.equipped.trail, "trail-cyan");
      await page.locator('[data-beta-tab="account"]').click();
      await page
        .getByRole("button", {
          name: "Gerar código de recuperação",
          exact: true,
        })
        .click();
      const code = await page
        .getByRole("textbox", {
          name: "Código privado de recuperação",
          exact: true,
        })
        .inputValue();
      assert.match(code, /^[a-f0-9]{64}$/);
      await page.locator('[data-beta-tab="community"]').click();
      await page
        .getByRole("textbox", { name: "Descrição do relato" })
        .fill("Teste de navegação da beta em " + name);
      await page
        .getByRole("button", { name: "Enviar relato", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".beta-status")
          .textContent.includes("registrado"),
      );
      await page.locator('[data-beta-tab="journey"]').click();
      await page
        .getByRole("button", { name: "Abrir mochila", exact: true })
        .click();
      await page.locator("#sandbox-panel").waitFor({ state: "visible" });
      await page
        .getByRole("button", { name: "Fechar vida no universo" })
        .click();
      await openCentral(page);
      await page
        .locator("#beta-hub")
        .getByRole("button", { name: "Abrir atlas", exact: true })
        .click();
      await page.locator("#game-panel-atlas").waitFor({ state: "visible" });
      await page.locator("#game-panel-atlas header button[aria-label='Fechar janela']").click();
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, []);
      report.push({
        name,
        tabs: 7,
        claim: true,
        equip: true,
        recovery: true,
        report: true,
        navigation: true,
        errors,
      });
      await ctx.close();
    }
    await fs.writeFile(
      path.join(captures, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
