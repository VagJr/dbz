"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { start } = require("../server");
const { chromium } = require(
  process.env.UZ_PLAYWRIGHT_PATH ||
    "C:/Users/vagmi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, msg) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await delay(50);
  }
  throw Error(msg);
}
(async () => {
  const dir = path.resolve(".preview-data/beta");
  await fs.mkdir(dir, { recursive: true });
  const app = await start({
      port: 0,
      host: "127.0.0.1",
      dataDir: await fs.mkdtemp(path.join(dir, "rhythm-")),
    }),
    browser = await chromium.launch({ channel: "msedge", headless: true }),
    report = [];
  try {
    app.engine.nextExploration = 1e9;
    app.engine.eventAt = 1e9;
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
      ["landscape", 844, 390],
      ["compact", 360, 640],
    ]) {
      const ctx = await browser.newContext({
          viewport: { width, height },
          hasTouch: name !== "desktop",
          isMobile: name !== "desktop",
        }),
        page = await ctx.newPage(),
        rival = await ctx.newPage(),
        errors = [];
      for (const [i, tab] of [page, rival].entries()) {
        tab.on("pageerror", (e) => {
          errors.push(e.message);
          console.error(e.message);
        });
        await tab.goto("http://localhost:" + app.server.address().port);
        await tab.locator("#player-name").fill(name + " " + i);
        await tab.locator("#join-button").click();
        await tab.locator("#skip-scene").click();
        await tab.locator("#tutorial-dismiss").click();
      }
      const a = [...app.engine.players.values()].find(
          (p) => p.name === name + " 0",
        ),
        b = [...app.engine.players.values()].find(
          (p) => p.name === name + " 1",
        );
      await page.bringToFront();
      a.x = 1810;
      a.y = 1740;
      a.mode = "ground";
      await delay(150);
      await page.keyboard.press("KeyE");
      await until(
        () => a.storyState.objectiveIndex === 2,
        "Bulma advances current story",
      );
      await page.locator("#scene-speaker").waitFor({ state: "visible" });
      assert.equal(await page.locator("#scene-speaker").textContent(), "Bulma");
      await page.screenshot({
        path: path.join(dir, name + "-story-current.png"),
      });
      await page.locator("#skip-scene").click();
      assert.match(
        await page.locator("#quest-description").textContent(),
        /pista/i,
      );
      for (const [p, x] of [
        [a, 1700],
        [b, 1800],
      ])
        Object.assign(p, {
          world: "earth",
          mode: "ground",
          x,
          y: 2200,
          vx: 0,
          vy: 0,
          altitude: 0,
          lastHit: -99,
          lastCombatAt: -99,
          invuln: 0,
        });
      const originalHP = [a.maxHp, b.maxHp];
      await delay(180);
      await page.locator("#beta-launcher").click();
      await page.locator('[data-beta-tab="combat"]').click();
      await page
        .getByLabel("Rival do duelo", { exact: true })
        .selectOption(b.id);
      await page
        .getByRole("button", { name: "Convidar para duelo", exact: true })
        .click();
      await until(() => !!b.duelInvite, "duel invitation");
      await page.locator(".beta-close").click();
      await rival.bringToFront();
      await rival.locator("#duel-status").click();
      await rival
        .getByRole("button", { name: "Aceitar duelo", exact: true })
        .click();
      await until(() => !!a.duelId && !!b.duelId, "accepted duel");
      assert.equal(a.hp, 600);
      assert.equal(b.hp, 600);
      await until(() => !a.roundLocked, "countdown complete");
      a.x = 1700;
      a.y = 2200;
      b.x = 1800;
      b.y = 2200;
      a.angle = 0;
      b.angle = Math.PI;
      await page.bringToFront();
      await page.mouse.move(width * 0.78, height * 0.5);
      await delay(150);
      const button = await page.locator('[data-action="attack"]').boundingBox();
      if (name === "desktop") {
        await page.mouse.move(
          button.x + button.width / 2,
          button.y + button.height / 2,
        );
        await page.mouse.down();
        await delay(60);
        assert.equal(b.hp, 600);
        await page.mouse.up();
      } else
        await page.touchscreen.tap(
          button.x + button.width / 2,
          button.y + button.height / 2,
        );
      await until(() => !!a.moveAction, "released action");
      assert.equal(b.hp, 600);
      await page.locator("#combat-rhythm").waitFor({ state: "visible" });
      await page.waitForFunction(() =>
        document
          .querySelector("#combat-rhythm strong")
          .textContent.includes("Golpe"),
      );
      await page.screenshot({ path: path.join(dir, name + "-rhythm.png") });
      await until(() => b.hp < 600, "delayed impact reaches rival");
      const hud = await page.locator("#combat-rhythm").boundingBox();
      assert.ok(
        hud.x >= 0 &&
          hud.x + hud.width <= width + 1 &&
          hud.y >= 0 &&
          hud.y + hud.height <= height + 1,
        "cadence visible in viewport",
      );
      await until(()=>!a.moveAction,'punch recovery');
      a.stun=b.stun=0;a.launch=b.launch=null;a.ki=b.ki=100;a.x=1700;b.x=1800;a.y=b.y=2200;a.angle=0;b.angle=Math.PI;
      app.engine.beginMove(a,'charged');app.engine.beginMove(b,'charged');
      await until(()=>!!a.clashId,'beam collision starts contest');
      await page.waitForFunction(()=>document.querySelector('#combat-rhythm strong').textContent.includes('DISPUTA DE KI'));
      await page.screenshot({path:path.join(dir,name+'-beam-clash.png')});
      await until(()=>!a.clashId,'contest releases participants');
      await page.locator("#duel-status").click();
      await page
        .getByRole("button", { name: "Desistir do duelo", exact: true })
        .click();
      await until(() => !a.duelId && !b.duelId, "duel restored");
      assert.equal(a.maxHp, originalHP[0]);
      assert.equal(b.maxHp, originalHP[1]);
      assert.deepEqual(errors, []);
      report.push({
        viewport: name,
        story: true,
        duel: true,
        delayedImpact: true,
        beamClash: true,
        restored: true,
        errors,
      });
      await ctx.close();
      await until(() => app.engine.players.size === 0, "clients disconnected");
    }
    await fs.writeFile(
      path.join(dir, "rhythm-report.json"),
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
