"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Engine } = require("../src/engine");
const C = require("../shared/quests");
const Nav = require("../shared/navigation");

function setup(profile = {}) {
  const game = new Engine();
  game.enemies = [];
  const player = game.addPlayer("p", { name: "Guerreiro", origin: "saiyan", ...profile });
  return { game, player };
}

function quest(player, id, objectiveIndex = 0) {
  const def = C.QUEST_BY_ID.get(id);
  assert.ok(def, "quest exists: " + id);
  Object.assign(player.storyState, {
    saga: def.saga,
    questId: id,
    objectiveIndex,
    sequenceIndex: 0,
    progress: 0,
    objectiveStartedAt: 0,
  });
}

function at(player, id) {
  const point = C.LANDMARKS[id];
  assert.ok(point, "landmark exists: " + id);
  player.world = point.world;
  player.x = point.x;
  player.y = point.y;
  return point;
}

function storyTick(game, player) {
  player.lastStoryCheck = -1;
  game.storyTick(player);
}

function spawnTagged(game, player, { world = player.world, questId = player.storyState.questId, objectiveId, key = "test:" + objectiveId, bossId = null, x = player.x + 50, y = player.y }) {
  return game.spawn(world, "Alvo de teste", bossId ? "vegeta" : "soldier", x, y, !!bossId, {
    hp: bossId ? C.BOSSES[bossId].hp : 80,
    maxHp: bossId ? C.BOSSES[bossId].hp : 80,
    storyEncounter: true,
    storyQuestId: questId,
    storyObjectiveId: objectiveId,
    storyEncounterKey: key,
    storyBossId: bossId,
    storyPhaseIndex: bossId ? 0 : undefined,
    storyParticipants: new Set(),
    ai: { ...(C.ENEMY_PROFILES.balanced) },
  });
}

test("new and legacy profiles initialize campaign state without losing old progress", () => {
  const { game, player } = setup({
    level: 11, xp: 17, zenni: 250, progress: { db: 3, z: 2 }, campaign: "z",
    power: "98765432101234567890", orbs: [1, 3], visited: ["earth", "namek"],
    techniques: ["ki", "kame"], lore: { done: ["kame"], snake: 14, bubbles: true },
  });
  assert.equal(player.storyState.questId, "db-paozu");
  assert.equal(player.storyState.migration, "legacy-profile");
  assert.deepEqual(player.progress, { db: 3, z: 2 });
  assert.equal(player.campaign, "z");
  assert.equal(player.level, 11);
  assert.equal(player.zenni, 250);
  assert.equal(player.power, "98765432101234567890");
  assert.deepEqual(player.orbs, [1, 3]);
  assert.deepEqual(player.lore.done, ["kame"]);
  assert.equal(game.profile(player).storyState.questId, "db-paozu");
});

test("story snapshot is compact and exposes the active objective, not private profile data", () => {
  const { game, player } = setup({ zenni: 999, power: "123456789" });
  const self = game.snapshot(player.id).self;
  assert.equal(self.storyObjective.questId, "db-paozu");
  assert.equal(self.storyObjective.objectiveId, "paozu");
  assert.equal(self.storyObjective.progress, 0);
  assert.equal(self.storyObjective.required, 1);
  assert.equal(self.storyState, undefined);
  assert.equal(self.rewardsClaimed, undefined);
});

test("campaign catalog covers the ordered Earth, Saiyan and Namek story arcs", () => {
  assert.equal(C.QUESTS.length, 28);
  assert.equal(C.QUEST_BY_ID.get("db-23rd").next, "saiyan-raditz");
  assert.equal(C.QUEST_BY_ID.get("saiyan-invasion").next, "namek-journey");
  assert.equal(C.QUEST_BY_ID.get("namek-escape").next, "android-warning");
  assert.ok(C.QUESTS.some(q => q.id === "db-ribbon-outposts"));
  assert.ok(C.QUESTS.some(q => q.id === "namek-ginyu"));
  const types = new Set(C.QUESTS.flatMap(q => q.objectives.flatMap(o => o.type === "sequence" ? [o.type, ...o.steps.map(s => s.type)] : [o.type])));
  for (const type of ["reach", "talk", "interact", "kill", "killCount", "defeatWave", "boss", "bossPhase", "collect", "train", "survive", "travel", "visitRegion", "returnTo", "sequence"]) assert.ok(types.has(type), "objective type " + type);
});

test("ordinary or wrong-objective enemies cannot advance a story kill count", () => {
  const { game, player } = setup();
  quest(player, "db-paozu", 3);
  const ordinary = game.spawn("earth", "Lobo", "soldier", player.x + 20, player.y);
  game.damage(player, ordinary, 9999);
  assert.equal(player.storyState.progress, 0);
  const taggedWrong = spawnTagged(game, player, { objectiveId: "another-wave" });
  game.damage(player, taggedWrong, 9999);
  assert.equal(player.storyState.progress, 0);
});

test("a story enemy in the wrong world cannot satisfy the current Namek objective", () => {
  const { game, player } = setup();
  quest(player, "namek-arrival", 3);
  player.world = "earth";
  const enemy = spawnTagged(game, player, { world: "earth", objectiveId: "freeza-scouts", questId: "namek-arrival" });
  game.damage(player, enemy, 9999);
  assert.equal(player.storyState.progress, 0);
  assert.equal(player.storyState.objectiveIndex, 3);
});

test("reach and region objectives complete only at their authoritative locations", () => {
  const { game, player } = setup();
  quest(player, "db-pilaf", 0);
  const point = C.LANDMARKS.pilafHideout;
  player.x = point.x + point.radius + 1;
  player.y = point.y;
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 0);
  player.x = point.x;
  player.y = point.y;
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 1);
  quest(player, "namek-arrival", 1);
  at(player, "namekVillage");
  player.x += 350;
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 2);
  at(player, "namekVillage");
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 3);
});

test("the Paozu patrol is a server-spawned killCount wave and advances exactly once", () => {
  const { game, player } = setup();
  quest(player, "db-paozu", 3);
  at(player, "pilafTrail");
  storyTick(game, player);
  for(let i=0;i<3;i++){
    storyTick(game,player);
    const wave=game.enemies.filter(e=>e.storyEncounterKey==='db-paozu:objective:pilaf-scouts'&&!e.dead);
    assert.equal(wave.length,1,'one introductory opponent at a time');
    game.damage(player,wave[0],9999);
    game.time+=2.1;
  }
  assert.equal(player.storyState.questId, "db-pilaf");
  assert.ok(player.storyState.completedQuests.includes("db-paozu"));
});

test("collectibles are per-profile, persistent and do not mutate Earth's Dragon Balls", () => {
  const { game, player } = setup();
  quest(player, "namek-dragon-balls", 2);
  player.world = "namek";
  at(player, "namekBall1");
  game.interact(player.id);
  game.interact(player.id);
  assert.equal(player.storyState.items.namekDragonBall, 1);
  assert.equal(player.storyState.items.namekDragonBalls, 1);
  assert.deepEqual(player.orbs, []);
  const restoredGame = new Engine();
  const restored = restoredGame.addPlayer("restored", JSON.parse(JSON.stringify(game.profile(player))));
  assert.equal(restored.storyState.items.namekDragonBalls, 1);
  assert.deepEqual(restored.storyState.collectedItems, ["namekBall1"]);
});

test("duplicate objective and boss completion calls never grant rewards twice", () => {
  const { game, player } = setup();
  const q = C.QUEST_BY_ID.get("db-pilaf");
  quest(player, q.id, q.objectives.length);
  assert.equal(game.storyCompleteQuest(player, q), true);
  const xp = player.xp, zenni = player.zenni, power = player.power;
  assert.equal(game.storyCompleteQuest(player, q), false);
  assert.equal(player.xp, xp);
  assert.equal(player.zenni, zenni);
  assert.equal(player.power, power);
  assert.equal(player.storyState.rewardsClaimed.filter(id => id === q.id).length, 1);
});

test("story boss spawn is shared and one nearby eligible teammate receives credit", () => {
  const { game, player } = setup();
  quest(player, "db-pilaf", 2);
  const teammate = game.addPlayer("nearby", { name: "Aliado", origin: "earthling", storyState: game.profile(player).storyState });
  at(player, "pilafHideout");
  teammate.world = player.world;
  teammate.x = player.x + 30;
  teammate.y = player.y + 30;
  storyTick(game, player);
  storyTick(game, teammate);
  const bosses = game.enemies.filter(e => e.storyBossId === "pilaf" && !e.dead);
  assert.equal(bosses.length, 1);
  game.damage(player, bosses[0], 99999);
  assert.equal(player.storyState.questId, "db-kame-training");
  assert.equal(teammate.storyState.questId, "db-kame-training");
  const distant = game.addPlayer("distant", { name: "Longe", origin: "namekian", storyState: game.profile(player).storyState });
  distant.world = "earth";
  distant.x = 20000;
  distant.y = 20000;
  assert.equal(distant.storyState.completedQuests.includes("db-pilaf"), true);
});

test("boss phase thresholds advance only once for Vegeta", () => {
  const { game, player } = setup();
  quest(player, "saiyan-invasion", 5);
  at(player, "saiyanBattlefield");
  storyTick(game, player);
  const boss = game.enemies.find(e => e.storyBossId === "vegeta" && !e.dead);
  assert.ok(boss);
  game.damage(player, boss, 500);
  assert.equal(boss.storyPhaseIndex, 1);
  assert.equal(player.storyState.objectiveIndex, 6);
  game.damage(player, boss, 430);
  assert.equal(boss.storyPhaseIndex, 2);
  assert.equal(player.storyState.objectiveIndex, 7);
  game.damage(player, boss, 20);
  assert.equal(boss.storyPhaseIndex, 2);
  assert.equal(player.storyState.objectiveIndex, 7);
});

test("Zarbon changes phase and the same encounter continues into his defeat objective", () => {
  const { game, player } = setup();
  quest(player, "namek-zarbon", 1);
  at(player, "namekCamp");
  storyTick(game, player);
  const boss = game.enemies.find(e => e.storyBossId === "zarbon" && !e.dead);
  game.damage(player, boss, 500);
  assert.equal(boss.storyPhaseIndex, 1);
  assert.equal(player.storyState.objectiveIndex, 2);
  game.damage(player, boss, 99999);
  assert.equal(player.storyState.questId, "namek-elder");
});

test("Freeza's five phases share one encounter and alter the AI profile", () => {
  const { game, player } = setup();
  quest(player, "namek-frieza", 1);
  at(player, "namekFinal");
  storyTick(game, player);
  const boss = game.enemies.find(e => e.storyBossId === "frieza" && !e.dead);
  assert.ok(boss);
  const initial = boss.ai.archetype;
  for (const damage of [420, 420, 420, 380]) game.damage(player, boss, damage);
  assert.equal(boss.storyPhaseIndex, 4);
  assert.equal(player.storyState.objectiveIndex, 5);
  assert.equal(boss.dead, false);
  assert.notEqual(boss.ai.archetype, initial);
  assert.equal(game.enemies.filter(e => e.storyBossId === "frieza" && !e.dead).length, 1);
  game.damage(player, boss, 99999);
  assert.equal(player.storyState.questId, "namek-escape");
});

test("Ginyu Force appears in order and never stacks duplicate bosses", () => {
  const { game, player } = setup();
  quest(player, "namek-ginyu", 1);
  at(player, "ginyuField");
  const order = ["guldo", "recoome", "burter", "jeice", "ginyu"];
  for (let i = 0; i < order.length; i++) {
    storyTick(game, player);
    const live = game.enemies.filter(e => e.storyBossId && !e.dead);
    assert.equal(live.length, 1);
    assert.equal(live[0].storyBossId, order[i]);
    game.damage(player, live[0], 99999);
    if (i + 1 < order.length) assert.equal(player.storyState.objectiveIndex, i + 2);
  }
  assert.equal(player.storyState.questId, "namek-frieza");
});

test("the ordered Kaio quest recognizes the existing Snake Way, Bubbles and training state", () => {
  const { game, player } = setup({ lore: { done: ["kaio"], snake: 25, bubbles: true } });
  quest(player, "saiyan-kaio", 3);
  player.world = "otherworld";
  storyTick(game, player);
  assert.equal(player.storyState.questId, "saiyan-invasion");
  assert.ok(player.storyState.flags.includes("kaio_training_complete"));
});

test("the Snake Way sequence resumes at its saved checkpoint after reload", () => {
  const { game, player } = setup({ lore: { done: [], snake: 13, bubbles: false } });
  quest(player, "saiyan-kaio", 1);
  player.storyState.sequenceIndex = 12;
  const restoredGame = new Engine();
  const restored = restoredGame.addPlayer("restored", JSON.parse(JSON.stringify(game.profile(player))));
  assert.equal(restored.storyState.sequenceIndex, 12);
  assert.match(restored.storyState.questId, /saiyan-kaio/);
  assert.match(restoredGame.storyObjective(restored).text, /marco 13\/25/);
});

test("Namek travel uses the existing atlas destination and planetary entry flow", () => {
  const { game, player } = setup();
  quest(player, "namek-journey", 0);
  assert.equal(game.route(player.id, "namek"), true);
  assert.equal(player.destination, "namek");
  const destination = Nav.get("namek");
  player.world = "space";
  player.x = destination.x;
  player.y = destination.y;
  assert.equal(game.enterPlanet(player.id), true);
  assert.equal(player.world, "namek");
  assert.equal(player.storyState.questId, "namek-arrival");
  assert.ok(player.visited.includes("namek"));
});

test("Namek escape advances only when the player reaches the existing space layer", () => {
  const { game, player } = setup();
  quest(player, "namek-escape", 0);
  player.storyState.objectiveStartedAt = 0;
  player.time = undefined;
  game.time = 11;
  at(player, "namekEscape");
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 2);
  assert.equal(player.storyState.questId, "namek-escape");
  player.destination = "namek";
  player.ascent = true;
  player.altitude = 0.99;
  player.lastHit = -10;
  game.navigationTick(player, 0.1);
  assert.equal(player.world, "space");
  storyTick(game, player);
  assert.equal(player.storyState.questId, "android-warning");
  assert.ok(player.storyState.flags.includes("namek_saga_complete"));
});

test("story profile serialization restores flags, phase records, rewards, collectibles and legacy campaigns", () => {
  const { game, player } = setup({ campaign: "db", progress: { db: 2 } });
  player.storyState.flags.push("frieza_defeated");
  player.storyState.bosses.frieza = 4;
  player.storyState.items.namekDragonBall = 5;
  player.storyState.collectedItems.push("namekBall1", "namekBall2");
  player.storyState.completedQuests.push("db-paozu");
  player.storyState.rewardsClaimed.push("db-paozu");
  const data = JSON.parse(JSON.stringify(game.profile(player)));
  const restored = new Engine().addPlayer("restored", data);
  assert.ok(restored.storyState.flags.includes("frieza_defeated"));
  assert.equal(restored.storyState.bosses.frieza, 4);
  assert.equal(restored.storyState.items.namekDragonBall, 5);
  assert.deepEqual(restored.storyState.collectedItems, ["namekBall1", "namekBall2"]);
  assert.equal(restored.storyState.completedQuests[0], "db-paozu");
  assert.equal(restored.storyState.rewardsClaimed[0], "db-paozu");
  assert.deepEqual(restored.progress, { db: 2 });
  assert.equal(restored.campaign, "db");
});

test("legacy campaign selection remains functional beside the new persistent saga", () => {
  const { game, player } = setup();
  assert.equal(game.campaign(player.id, "z"), true);
  assert.equal(player.campaign, "z");
  assert.equal(player.storyState.questId, "db-paozu");
  player.progress.z = 1;
  assert.equal(game.chapter(player).world, "earth");
});

test("killing a story boss twice cannot repeat its XP, items or quest reward", () => {
  const { game, player } = setup();
  quest(player, "db-pilaf", 2);
  at(player, "pilafHideout");
  storyTick(game, player);
  const boss = game.enemies.find(e => e.storyBossId === "pilaf" && !e.dead);
  game.damage(player, boss, 99999);
  const earned = { xp: player.xp, zenni: player.zenni, power: player.power, claimed: [...player.storyState.rewardsClaimed] };
  game.damage(player, boss, 99999);
  assert.equal(player.xp, earned.xp);
  assert.equal(player.zenni, earned.zenni);
  assert.equal(player.power, earned.power);
  assert.deepEqual(player.storyState.rewardsClaimed, earned.claimed);
});

test("players on different story objectives keep independent progress in the same world", () => {
  const { game, player } = setup();
  quest(player, "db-paozu", 3);
  const ally = game.addPlayer("ally", { name: "Aliado", origin: "namekian" });
  quest(ally, "db-pilaf", 0);
  at(player, "pilafTrail");
  ally.world = "earth";
  ally.x = player.x;
  ally.y = player.y;
  storyTick(game, player);
  for(let i=0;i<3;i++){storyTick(game,player);const enemy=game.enemies.find(e=>e.storyEncounterKey==='db-paozu:objective:pilaf-scouts'&&!e.dead);assert.ok(enemy);game.damage(player,enemy,9999);game.time+=2.1;}
  assert.equal(player.storyState.questId, "db-pilaf");
  assert.equal(ally.storyState.questId, "db-pilaf");
  assert.equal(ally.storyState.objectiveIndex, 0);
  assert.equal(player.storyState.completedQuests.includes("db-paozu"), true);
  assert.equal(ally.storyState.completedQuests.includes("db-paozu"), false);
  assert.notEqual(player.storyState.completedQuests, ally.storyState.completedQuests);
});

test("survive timers and returnTo checkpoints are checked by the server clock and coordinates", () => {
  const { game, player } = setup();
  quest(player, "namek-escape", 0);
  at(player, "namekEscape");
  game.time = 9.9;
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 0);
  game.time = 10.1;
  storyTick(game, player);
  assert.equal(player.storyState.objectiveIndex, 2);
});

test("wrong-quest and distant players do not receive shared boss progress", () => {
  const { game, player } = setup();
  quest(player, "db-pilaf", 2);
  at(player, "pilafHideout");
  const wrongQuest = game.addPlayer("wrong", { name: "Outro arco", origin: "earthling" });
  quest(wrongQuest, "db-paozu", 3);
  wrongQuest.world = "earth";
  wrongQuest.x = player.x;
  wrongQuest.y = player.y;
  const distant = game.addPlayer("far", { name: "Distante", origin: "namekian", storyState: game.profile(player).storyState });
  distant.world = "earth";
  distant.x = 30000;
  distant.y = 30000;
  storyTick(game, player);
  const boss = game.enemies.find(e => e.storyBossId === "pilaf" && !e.dead);
  game.damage(player, boss, 99999);
  assert.equal(player.storyState.questId, "db-kame-training");
  assert.equal(wrongQuest.storyState.questId, "db-paozu");
  assert.equal(wrongQuest.storyState.objectiveIndex, 3);
  assert.equal(distant.storyState.questId, "db-pilaf");
  assert.equal(distant.storyState.completedQuests.includes("db-pilaf"), false);
});

test("loading a saved quest clamps progress and ignores unknown flags, items and boss IDs", () => {
  const { game, player } = setup();
  const profile = game.profile(player);
  profile.storyState = {
    version: 1, saga: "dragon-ball", questId: "saiyan-kaio", objectiveIndex: 1,
    sequenceIndex: 999, progress: 999, completedQuests: ["db-paozu", "not-a-quest"],
    rewardsClaimed: ["db-pilaf", "forged"], flags: ["saiyan_saga_complete", "forged"],
    items: { namekDragonBall: 7, orbs: 7, forged: 900 },
    collectedItems: ["namekBall1", "forged"], bosses: { frieza: 999, forged: 7 },
  };
  const restoredGame = new Engine();
  const restored = restoredGame.addPlayer("restored", profile);
  assert.equal(restored.storyState.sequenceIndex, 24);
  assert.equal(restored.storyState.progress, 1);
  assert.deepEqual(restored.storyState.completedQuests, ["db-paozu"]);
  assert.deepEqual(restored.storyState.rewardsClaimed, ["db-pilaf"]);
  assert.deepEqual(restored.storyState.flags, ["saiyan_saga_complete"]);
  assert.deepEqual(restored.storyState.items, { namekDragonBall: 7 });
  assert.deepEqual(restored.storyState.collectedItems, ["namekBall1"]);
  assert.equal(restored.storyState.bosses.frieza, 4);
  assert.equal(restored.storyState.bosses.forged, undefined);
});
