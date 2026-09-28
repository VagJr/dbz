"use strict";
const { Engine } = require("../src/engine");
const { SnapshotWire } = require("../src/snapshot-wire");
const { performance } = require("node:perf_hooks");
const counts = [8, 24];
for (const count of counts)
  for (const protocol of ["full", "delta"]) {
    const game = new Engine();
    for (let i = 0; i < count; i++) {
      const p = game.addPlayer("bench-" + i);
      p.x = 1700 + i * 12;
      p.y = 1740;
      p.mode = "flight";
      // Measure encounters as well as travel; skip peaceful onboarding in this
      // synthetic scenario. Nearby exploration may create additional patrols.
      p.storyState.questId = "db-pilaf";
      p.storyState.objectiveIndex = 0;
    }
    for (let i = 0; i < 36; i++)
      game.spawn("earth", "Rival", "soldier", 2150 + i * 20, 1820, false, {
        hp: 600,
        maxHp: 600,
      });
    let bytes = 0;
    const wires = new Map(
      [...game.players.keys()].map((id) => [id, new SnapshotWire()]),
    );
    const samples = [];
    for (let i = 0; i < 120; i++) {
      for (const p of game.players.values())
        game.input(p.id, { x: Math.sin(i * 0.05), y: 0, angle: 0 });
      const start = performance.now();
      game.tick();
      if (i % 2 === 0)
        for (const p of game.players.values()) {
          const state = game.snapshot(p.id);
          bytes += Buffer.byteLength(
            JSON.stringify(
              protocol === "delta" ? wires.get(p.id).encode(state) : state,
            ),
          );
        }
      game.effects = [];
      if (i >= 30) samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        protocol,
        players: count,
        enemies: game.enemies.length,
        tickMedianMs: +samples[Math.floor(samples.length * 0.5)].toFixed(2),
        tickP95Ms: +samples[Math.floor(samples.length * 0.95)].toFixed(2),
        outboundKBpsPerPlayer: +(bytes / 4 / count / 1024).toFixed(1),
      }),
    );
  }
