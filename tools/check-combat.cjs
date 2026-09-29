"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { start } = require("../server");
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
  const dir = path.resolve(".preview-data/beta");
  await fs.mkdir(dir, { recursive: true });
  const app = await start({
      port: 0,
      dataDir: await fs.mkdtemp(path.join(dir, "combat-")),
    }),
    browser = await chromium.launch({ channel: "msedge", headless: true });
  const report = [];
  try {
    for (const [name, w, h] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
      ["landscape", 844, 390],
      ["compact", 360, 640],
    ]) {
      if (process.argv[2] && process.argv[2] !== name) continue;
      const context = await browser.newContext({
          viewport: { width: w, height: h },
          hasTouch: name !== "desktop",
          isMobile: name !== "desktop",
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://localhost:" + app.server.address().port);
      await page.locator("#start-game").click();
      await page.locator("#player-name").fill("Dojo " + name);
      await page.locator("#join-button").click();
      await page.locator("#skip-scene").click();
      if (await page.locator("#tutorial-dismiss").isVisible())
        await page.locator("#tutorial-dismiss").click();
      else {
        await page.locator(".mobile-objective-expand").click();
        await page.locator(".mobile-objective-dismiss").click();
      }
      const p = [...app.engine.players.values()].find(
        (p) => p.name === "Dojo " + name,
      );
      app.engine.nextExploration = 1e9;
      app.engine.enemies = [];
      p.mode = "ground";
      p.altitude = 0;
      p.invuln = 1e9;
      Object.assign(p, app.engine.maps[p.world].mentor);
      await openCentral(page);
      await page.locator('[data-beta-tab="combat"]').click();
      await page
        .getByRole("button", { name: "Treinar Artilharia", exact: true })
        .click();
      await page.waitForFunction(
        () => !document.querySelector("#beta-hub").open,
      );
      assert.ok(p.sparring);
      const e = app.engine.enemies.find((e) => e.id === p.sparring.enemyId);
      e.x = p.x + 330;
      e.y = p.y;
      e.homeX = e.x;
      e.homeY = e.y;
      e.mode = "flight";
      p.mode = "flight";
      await page.waitForFunction(
        () => !document.getElementById("target-card").hidden,
      );
      const seen = new Set();
      let windup = false,
        projectile = false;
      for (let i = 0; i < 36; i++) {
        await page.waitForTimeout(100);
        seen.add(e.state);
        if (e.state === "windup" && !windup) {
          await page.screenshot({
            path: path.join(dir, name + "-combat-windup.png"),
          });
          windup = true;
        }
        if (app.engine.shots.some((s) => s.hostile) && !projectile) {
          await page.screenshot({
            path: path.join(dir, name + "-combat-projectile.png"),
          });
          projectile = true;
        }
      }
      assert.ok(windup, "visible windup");
      assert.ok(projectile, "visible projectile");
      await openCentral(page);
      await page.locator('[data-beta-tab="combat"]').click();
      await page
        .getByRole("button", { name: "Encerrar sparring", exact: true })
        .click();
      await page.waitForTimeout(200);
      assert.equal(p.sparring, null);
      assert.deepEqual(errors, []);
      report.push({
        name,
        states: [...seen],
        windup,
        projectile,
        dojo: true,
        errors,
      });
      await context.close();
    }
    await fs.writeFile(
      path.join(dir, "combat-report.json"),
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
