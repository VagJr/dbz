// Visual integration check. Uses an isolated game server and never opens the real saved profiles.
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const runtime =
  process.env.UZ_PLAYWRIGHT_PATH ||
  "C:/Users/vagmi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = require(runtime);
const { start } = require("../server");
(async () => {
  const folder = path.resolve(".preview-data/celestial");
  await fs.mkdir(folder, { recursive: true });
  const app = await start({ port: 0, dataDir: path.join(folder, "profiles") });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const report = [];
  const only = process.argv.find((a) => a.startsWith("--view="))?.split("=")[1];
  try {
    for (const [name, width, height, touch] of [
      ["desktop", 1440, 900, false],
      ["mobile", 390, 844, true],
      ["landscape", 844, 390, true],
      ["compact", 360, 640, true],
    ]) {
      if (only && only !== name) continue;
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: touch,
        hasTouch: touch,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.stack));
      const shot = async (label) => {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            Array.from(document.images).map((im) =>
              im.decode().catch(() => {}),
            ),
          );
        });
        await page.screenshot({
          animations: "disabled",
          path: path.join(folder, `${name}-${label}.png`),
        });
      };
      await page.goto(`http://localhost:${app.server.address().port}`, {
        waitUntil: "networkidle",
      });
      assert.equal(await page.locator(".origin-choice img").count(), 4);
      await shot("welcome");
      for (const origin of ["earthling", "namekian", "majin", "saiyan"]) {
        await page.locator(`[data-origin="${origin}"]`).click();
        assert.equal(
          await page
            .locator(`[data-origin="${origin}"]`)
            .getAttribute("aria-pressed"),
          "true",
        );
      }
      await page.locator("#player-name").fill("Visual " + name);
      await page.locator("#join-button").click();
      await page.locator("#skip-scene").waitFor({ state: "visible" });
      await page.locator("#skip-scene").click();
      await page.locator("#tutorial-dismiss").click();
      await page.locator("#toast").waitFor({ state: "hidden", timeout: 12000 });
      await shot("hud");
      const vitals = await page.locator(".bar").evaluateAll((nodes) =>
        nodes.map((n) => ({
          h: n.clientHeight,
          text: n.querySelector("span").getBoundingClientRect().height,
        })),
      );
      assert.ok(
        vitals.every((v) => v.h >= v.text),
        "Vital text must fit inside its bar",
      );
      for (const kind of ["atlas", "campaigns", "character", "settings"]) {
        await page.locator(`.bottom-nav [data-panel="${kind}"]`).click();
        await page.locator("#panel[open]").waitFor();
        await shot(kind);
        const metrics = await page.locator("#panel-body").evaluate((el) => ({
          width: el.clientWidth,
          scrollWidth: el.scrollWidth,
          height: el.clientHeight,
          scrollHeight: el.scrollHeight,
        }));
        assert.equal(
          metrics.width,
          metrics.scrollWidth,
          `${name}/${kind} must not overflow horizontally`,
        );
        if (kind === "atlas") {
          assert.ok(
            (await page.locator(".world-grid .world-card").count()) >= 19,
          );
          await page.locator('.world-card[data-world="namek"]').click();
          await page.waitForFunction(
            () =>
              document.getElementById("route-name").textContent === "Namekusei",
          );
        } else {
          if (kind === "character") {
            assert.ok((await page.locator(".character-model").count()) >= 136);
            await page.locator(".character-gallery summary").click();
            assert.ok(
              (await page
                .locator(".character-gallery")
                .getAttribute("open")) !== null,
            );
          }
          if (kind === "settings") {
            await page
              .locator(".settings-row")
              .filter({ hasText: "Movimento reduzido" })
              .locator("button")
              .click();
            assert.ok(
              await page
                .locator("body")
                .evaluate((e) => e.classList.contains("reduced-motion")),
            );
          }
          await page.locator("#close-panel").click();
        }
        report.push({ name, kind, metrics });
      }
      await page.locator("#help-button").click();
      await shot("help");
      await page.locator("#close-panel").click();
      // Render the largest possible action dock using a test-only authoritative player state.
      const player = [...app.engine.players.values()].find(
        (p) => p.name === "Visual " + name,
      );
      if (!player.lore.done.includes("kaio")) player.lore.done.push("kaio");
      player.focus = 100;
      await page
        .locator('[data-action="kaioken"]')
        .waitFor({ state: "visible" });
      await shot("all-actions");
      const buttons = await page
        .locator(".action-dock button:visible,.bottom-nav button:visible")
        .evaluateAll((nodes) =>
          nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return {
              name: n.textContent.trim(),
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
            };
          }),
        );
      assert.ok(
        buttons.every(
          (r) =>
            r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.w <= width + 1 &&
            r.y + r.h <= height + 1,
        ),
        `${name}: all action buttons must fit`,
      );
      for (let i = 0; i < buttons.length; i++)
        for (let j = i + 1; j < buttons.length; j++) {
          const a = buttons[i],
            b = buttons[j];
          assert.ok(
            !(
              a.x < b.x + b.w - 1 &&
              a.x + a.w > b.x + 1 &&
              a.y < b.y + b.h - 1 &&
              a.y + a.h > b.y + 1
            ),
            `${name}: ${a.name} overlaps ${b.name}`,
          );
        }
      await page.locator('[data-action="cycleTarget"]').click();
      await page.locator("#target-card").waitFor({ state: "visible" });
      await shot("target");
      await page.locator('[data-action="attack"]').click();
      const before = { x: player.x, y: player.y };
      if (touch) {
        const r = await page.locator("#stick").boundingBox();
        assert.equal(
          await page
            .locator("#stick")
            .evaluate((n) => getComputedStyle(n).pointerEvents),
          "auto",
        );
        await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
        await page.mouse.down();
        await page.mouse.move(r.x + r.width * 0.85, r.y + r.height / 2);
        await page.waitForTimeout(400);
        await page.mouse.up();
        assert.ok(
          await page
            .locator("#stick span")
            .evaluate((n) => n.style.transform === ""),
        );
      } else {
        await page.keyboard.down("KeyD");
        await page.waitForTimeout(400);
        await page.keyboard.up("KeyD");
      }
      assert.ok(
        Math.hypot(player.x - before.x, player.y - before.y) > 10,
        name + ": movement must reach the server",
      );
      await shot("verified");
      assert.deepEqual(errors, [], `${name} browser errors`);
      report.push({ name, errors, vitals, visibleButtons: buttons.length });
      await context.close();
    }
    await fs.writeFile(
      path.join(folder, only ? `report-${only}.json` : "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
