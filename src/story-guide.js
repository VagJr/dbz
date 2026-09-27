"use strict";
const Q = require("../shared/quests"),
  Lore = require("../shared/lore");
module.exports = (Engine) => {
  const chapter = Engine.prototype.chapter,
    add = Engine.prototype.addPlayer,
    profile = Engine.prototype.profile,
    campaign = Engine.prototype.campaign,
    interact = Engine.prototype.interact,
    snapshot = Engine.prototype.snapshot,
    storyTick = Engine.prototype.storyTick;
  Engine.prototype.addPlayer = function (id, data = {}) {
    const p = add.call(this, id, data);
    p.legacyCampaign = data.legacyCampaign === true;
    return p;
  };
  Engine.prototype.profile = function (p) {
    return { ...profile.call(this, p), legacyCampaign: !!p.legacyCampaign };
  };
  Engine.prototype.chapter = function (p) {
    return p.legacyCampaign ? chapter.call(this, p) : null;
  };
  Engine.prototype.campaign = function (id, name) {
    const p = this.players.get(id);
    if (p?.duelId) return false;
    const ok = campaign.call(this, id, name);
    if (ok) p.legacyCampaign = true;
    return ok;
  };
  Engine.prototype.storyTick = function (p) {
    if (!p.duelId && !p.legacyCampaign) return storyTick.call(this, p);
  };
  Engine.prototype.activeGuide = function (p) {
    if (p.legacyCampaign || p.duelId) return null;
    const q = this.storyObjective(p);
    if (!q) return null;
    const o = this.storyCurrent(p);
    let point = Number.isFinite(q.targetX)
      ? { x: q.targetX, y: q.targetY }
      : null;
    if (!point && o?.type === "train") {
      const site = Lore.sites.find((s) => s.id === o.loreId);
      if (site) point = site;
    }
    if (!point && o?.type === "loreCheckpoint")
      point = Lore.snake[(o.checkpoint || 1) - 1];
    if (!point && o?.type === "loreBubbles")
      point = {
        x: 16000 + Math.cos(this.time * 0.8) * 150,
        y: 1740 + Math.sin(this.time * 0.8) * 110,
      };
    return {
      ...q,
      targetX: point?.x,
      targetY: point?.y,
      radius: Q.LANDMARKS[o?.target]?.radius || 160,
      interactable: ["talk", "interact", "collect"].includes(o?.type),
      speaker:
        o?.target === "bulma" || o?.target === "capsuleLab"
          ? "Bulma"
          : o?.target === "kameHouse"
            ? "Mestre Kame"
            : "Objetivo",
      skin:
        o?.target === "bulma" || o?.target === "capsuleLab"
          ? "bulma"
          : o?.target === "kameHouse"
            ? "roshi"
            : null,
    };
  };
  Engine.prototype.interact = function (id) {
    const p = this.players.get(id);
    if (!p || p.duelId) return false;
    if (p.legacyCampaign) return interact.call(this, id);
    const result = this.storyInteract(p);
    if (result) return result;
    if (
      Lore.sites.some(
        (s) => s.world === p.world && Math.hypot(p.x - s.x, p.y - s.y) < 200,
      )
    )
      return interact.call(this, id);
    const guide = this.activeGuide(p),
      mentor = this.maps[p.world]?.mentor;
    if (mentor && Math.hypot(p.x - mentor.x, p.y - mentor.y) < 150) {
      if (this.time - Math.max(p.lastHit, p.lastCombatAt ?? -99) > 10) {
        p.hp = p.maxHp;
        p.ki = 100;
      }
      const text = guide
        ? "Seu próximo passo: " + guide.objective
        : "Você concluiu as crônicas. Explore, pratique ou participe das expedições.";
      p.lastDialogue = {
        id:
          "guidance:" +
          p.storyState.questId +
          ":" +
          p.storyState.objectiveIndex,
        title: "Orientação",
        speaker: this.maps[p.world].world.mentor,
        skin: "roshi",
        text,
      };
      return text;
    }
    if (
      (p.world === "earth" &&
        this.maps.earth.orbs.some(
          (o) =>
            !p.orbs.includes(o.id) && Math.hypot(o.x - p.x, o.y - p.y) < 95,
        )) ||
      p.orbs.length === 7
    )
      return interact.call(this, id);
    return guide
      ? "Siga o marcador: " + guide.objective
      : "Abra a Central para escolher uma atividade.";
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id),
      guide = this.activeGuide(p);
    s.self.storyObjective = guide;
    s.self.guide = guide;
    s.self.legacyCampaign = !!p.legacyCampaign;
    if (!p.legacyCampaign) {
      s.self.chapter = null;
      s.self.loreObjective = null;
    }
    s.self.storyJournal = Q.QUESTS.map((q) => ({
      id: q.id,
      title: q.title,
      saga: Q.SAGAS[q.saga]?.title,
      description: q.description,
      status: p.storyState.completedQuests.includes(q.id)
        ? "completed"
        : p.storyState.questId === q.id
          ? "active"
          : "locked",
    }));
    return s;
  };
};
