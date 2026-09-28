"use strict";

const { randomUUID } = require("node:crypto");

const MAX_MEMBERS = 4;
const INVITE_LIFETIME_MS = 30_000;
const INVITE_RANGE = 900;
const ASSIST_RANGE = 700;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class Parties {
  constructor(engine, io) {
    this.engine = engine;
    this.io = io;
    this.groups = new Map();
    this.memberOf = new Map();
    this.invitations = new Map();
  }

  player(id) {
    return this.engine.players.get(id);
  }

  group(id) {
    return this.groups.get(this.memberOf.get(id));
  }

  blocked(a, b) {
    return !!(
      a.beta?.blocked?.includes(b.citizenId) ||
      b.beta?.blocked?.includes(a.citizenId)
    );
  }

  notify(id, message) {
    this.io.to(id).emit("party:notice", message);
  }

  inform(group, message) {
    for (const id of group.members) this.notify(id, message);
  }

  expireInvitations() {
    const now = Date.now();
    for (const [target, invitations] of this.invitations) {
      for (const [source, invitation] of invitations)
        if (invitation.expiresAt <= now || !this.player(source))
          invitations.delete(source);
      if (!invitations.size || !this.player(target)) this.invitations.delete(target);
    }
  }

  invitationsFor(id) {
    this.expireInvitations();
    return [...(this.invitations.get(id)?.values() || [])]
      .filter((invitation) => {
        const source = this.player(invitation.from);
        const target = this.player(id);
        return source && target && !this.blocked(source, target);
      })
      .map(({ from, name, expiresAt }) => ({ from, name, expiresAt }));
  }

  snapshot(id) {
    const group = this.group(id);
    if (!group) return null;
    const self = this.player(id);
    return {
      id: group.id,
      leader: group.leader,
      members: [...group.members]
        .map((memberId) => {
          const member = this.player(memberId);
          if (!member) return null;
          return {
            id: memberId,
            name: member.name,
            origin: member.origin,
            skin: member.skin,
            level: member.level,
            hp: Math.max(0, Math.round(member.hp)),
            maxHp: Math.max(1, Math.round(member.maxHp)),
            ki: Math.max(0, Math.round(member.ki)),
            maxKi: Math.max(1, Math.round(member.maxKi || 100)),
            world: member.world,
            mode: member.mode,
            distance:
              self.world === member.world
                ? Math.round(distance(self, member) / 10) * 10
                : null,
            down: member.state === "dead",
          };
        })
        .filter(Boolean),
    };
  }

  view(id) {
    return {
      party: this.snapshot(id),
      partyInvites: this.invitationsFor(id),
    };
  }

  invite(id, targetId) {
    const source = this.player(id),
      target = this.player(targetId),
      group = this.group(id);
    if (!source || !target || source.id === target.id)
      return { ok: false, message: "Jogador indisponível." };
    if (source.world !== target.world || distance(source, target) > INVITE_RANGE)
      return { ok: false, message: "Aproxime-se do jogador para convidá-lo." };
    if (this.blocked(source, target))
      return { ok: false, message: "Convite indisponível para este jogador." };
    if (this.group(targetId))
      return { ok: false, message: "Este jogador já está em uma equipe." };
    if (group && (group.leader !== id || group.members.size >= MAX_MEMBERS))
      return {
        ok: false,
        message: group.leader !== id ? "Somente o líder pode convidar." : "A equipe está completa.",
      };
    let invitations = this.invitations.get(targetId);
    if (!invitations) {
      invitations = new Map();
      this.invitations.set(targetId, invitations);
    }
    this.expireInvitations();
    if (!this.invitations.has(targetId)) this.invitations.set(targetId, invitations);
    if (!invitations.has(id) && invitations.size >= 4)
      return { ok: false, message: "Este jogador já recebeu vários convites." };
    const entry = {
      from: id,
      name: source.name,
      groupId: group?.id || null,
      expiresAt: Date.now() + INVITE_LIFETIME_MS,
    };
    invitations.set(id, entry);
    this.io.to(targetId).emit("party:invite", {
      from: id,
      name: source.name,
      expiresAt: entry.expiresAt,
    });
    return { ok: true, message: `Convite enviado para ${target.name}.` };
  }

  accept(id, from) {
    this.expireInvitations();
    const invitation = this.invitations.get(id)?.get(from);
    if (!invitation)
      return { ok: false, message: "Este convite expirou." };
    const source = this.player(from),
      target = this.player(id);
    if (!source || !target || this.blocked(source, target))
      return { ok: false, message: "Convite indisponível." };
    if (this.group(id))
      return { ok: false, message: "Saia da sua equipe antes de aceitar." };
    let group = this.group(from);
    if (invitation.groupId !== (group?.id || null) ||
        (group && (group.leader !== from || group.members.size >= MAX_MEMBERS)))
      return { ok: false, message: "A equipe mudou desde o convite." };
    if (!group) {
      group = { id: randomUUID(), leader: from, members: new Set([from]) };
      this.groups.set(group.id, group);
      this.memberOf.set(from, group.id);
    }
    group.members.add(id);
    this.memberOf.set(id, group.id);
    this.invitations.delete(id);
    this.inform(group, `${target.name} entrou na equipe.`);
    return { ok: true, message: "Você entrou na equipe." };
  }

  decline(id, from) {
    const invitations = this.invitations.get(id);
    if (!invitations?.delete(from))
      return { ok: false, message: "Convite não encontrado." };
    if (!invitations.size) this.invitations.delete(id);
    this.notify(from, `${this.player(id)?.name || "Jogador"} recusou o convite.`);
    return { ok: true, message: "Convite recusado." };
  }

  remove(id, targetId) {
    const group = this.group(id);
    if (!group || !group.members.has(targetId))
      return { ok: false, message: "Jogador fora da equipe." };
    if (id !== targetId && group.leader !== id)
      return { ok: false, message: "Somente o líder pode remover membros." };
    const departing = this.player(targetId);
    group.members.delete(targetId);
    this.memberOf.delete(targetId);
    if (group.leader === targetId)
      group.leader = group.members.values().next().value || null;
    if (group.members.size < 2) {
      for (const memberId of group.members) {
        this.memberOf.delete(memberId);
        this.notify(memberId, "A equipe foi encerrada.");
      }
      this.groups.delete(group.id);
    } else {
      this.inform(group, `${departing?.name || "Um jogador"} saiu da equipe.`);
    }
    if (targetId !== id) this.notify(targetId, "Você saiu da equipe.");
    return { ok: true, message: targetId === id ? "Você saiu da equipe." : "Membro removido." };
  }

  promote(id, targetId) {
    const group = this.group(id);
    if (!group || group.leader !== id || !group.members.has(targetId) || targetId === id)
      return { ok: false, message: "Transferência de liderança indisponível." };
    group.leader = targetId;
    this.inform(group, `${this.player(targetId)?.name || "Jogador"} agora lidera a equipe.`);
    return { ok: true, message: "Liderança transferida." };
  }

  blockPair(blockerId, targetId) {
    this.invitations.get(blockerId)?.delete(targetId);
    this.invitations.get(targetId)?.delete(blockerId);
    const group = this.group(blockerId);
    if (!group || group !== this.group(targetId)) return;
    this.remove(blockerId, group.leader === blockerId ? targetId : blockerId);
  }

  command(id, data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      return { ok: false, message: "Pedido inválido." };
    const { action, target } = data;
    if (typeof action !== "string" || action.length > 20)
      return { ok: false, message: "Ação inválida." };
    if (action === "leave") return this.remove(id, id);
    if (typeof target !== "string" || target.length < 1 || target.length > 64)
      return { ok: false, message: "Jogador inválido." };
    if (action === "invite") return this.invite(id, target);
    if (action === "accept") return this.accept(id, target);
    if (action === "decline") return this.decline(id, target);
    if (action === "kick") return this.remove(id, target);
    if (action === "promote") return this.promote(id, target);
    return { ok: false, message: "Ação desconhecida." };
  }

  chat(id, rawText) {
    const group = this.group(id),
      source = this.player(id);
    if (!group || !source || typeof rawText !== "string")
      return { ok: false, message: "Entre em uma equipe para conversar." };
    const text = rawText.replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, 160);
    if (!text) return { ok: false, message: "Escreva uma mensagem." };
    const message = { id, name: source.name, text, at: Date.now() };
    for (const memberId of group.members) {
      const member = this.player(memberId);
      if (member && !this.blocked(source, member))
        this.io.to(memberId).emit("party:chat", message);
    }
    return { ok: true };
  }

  enemyDefeated(attacker, enemy) {
    const group = this.group(attacker.id);
    if (!group || group.members.size < 2) return;
    let assisted = 0;
    for (const id of group.members) {
      const member = this.player(id);
      if (!member || member.world !== enemy.world || member.state === "dead" ||
          distance(member, enemy) > ASSIST_RANGE) continue;
      assisted++;
      if (enemy.storyEncounter) {
        enemy.storyParticipants ||= new Set();
        enemy.storyParticipants.add(id);
        const runtime = this.engine.storyEncounterRuntime?.get(enemy.storyEncounterKey);
        if (runtime) {
          runtime.participants ||= new Set();
          runtime.participants.add(id);
        }
      } else if (id !== attacker.id) {
        const reward = enemy.rewardXP ?? (enemy.boss ? 100 : 28);
        if (reward > 0)
          this.engine.reward(member, Math.max(1, Math.floor(reward * 0.1)));
      }
    }
    if (assisted > 1)
      for (const id of group.members)
        this.io.to(id).emit("party:assist", {
          enemy: String(enemy.name || "Adversário").slice(0, 60),
          members: assisted,
        });
  }

  disconnect(id) {
    this.invitations.delete(id);
    for (const [target, invitations] of this.invitations) {
      invitations.delete(id);
      if (!invitations.size) this.invitations.delete(target);
    }
    if (this.group(id)) this.remove(id, id);
  }
}

module.exports = { Parties };
