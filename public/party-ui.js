"use strict";
(() => {
  const worldName = (id) => {
    try { return window.UZ?.getWorld(id)?.name || id; }
    catch { return id; }
  };
  const node = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  };
  const button = (label, action, title) => {
    const element = node("button", "party-action", label);
    element.type = "button";
    if (title) element.title = title;
    element.addEventListener("click", action);
    return element;
  };
  const hud = document.getElementById("hud");
  const nav = hud?.querySelector(".bottom-nav");
  if (!hud || !nav) return;

  const launcher = node("button", "party-launcher");
  launcher.type = "button";
  launcher.title = "Equipe e jogadores próximos · P";
  launcher.setAttribute("aria-label", "Equipe e jogadores próximos · P");
  launcher.style.setProperty("--nav-art", 'url("/assets/ui/generated/menu/46.png")');
  launcher.append(node("span", "", "Equipe"));
  nav.insertBefore(launcher, nav.lastElementChild);

  const presence = node("button", "party-presence");
  presence.type = "button";
  presence.hidden = true;
  presence.setAttribute("aria-label", "Abrir equipe");
  hud.append(presence);

  const panel = node("dialog", "party-panel");
  panel.id = "party-panel";
  panel.setAttribute("aria-label", "Equipe");
  const header = node("header");
  const heading = node("div");
  const onlineLabel = node("small", "eyebrow", "COOPERATIVO · ONLINE");
  heading.append(onlineLabel, node("h2", "", "Equipe"));
  const close = button("×", () => panel.close(), "Fechar equipe");
  close.setAttribute("aria-label", "Fechar equipe");
  header.append(heading, close);
  const body = node("div", "party-body");
  const status = node("p", "party-status", "Forme uma equipe de até quatro jogadores.");
  status.setAttribute("role", "status");
  const invites = node("section", "party-invites");
  const roster = node("section", "party-roster");
  const nearby = node("section", "party-nearby");
  const chat = node("section", "party-chat");
  const chatHeader = node("div", "party-section-head", "CANAL DA EQUIPE");
  const messages = node("div", "party-messages");
  messages.setAttribute("aria-live", "polite");
  const form = node("form", "party-chat-form");
  const input = node("input");
  input.placeholder = "Converse com a equipe…";
  input.maxLength = 160;
  input.setAttribute("aria-label", "Mensagem privada para a equipe");
  const send = node("button", "", "↗");
  send.type = "submit";
  send.setAttribute("aria-label", "Enviar para a equipe");
  form.append(input, send);
  chat.append(chatHeader, messages, form);
  body.append(status, invites, roster, nearby, chat);
  panel.append(header, body);
  document.body.append(panel);

  let socket = null;
  let state = null;
  let lastSignature = "";
  let lastPartyId = null;
  const say = (text) => { status.textContent = text; };
  const open = () => {
    if (hud.hidden) return;
    window.UZWindows?.open(panel, "right");
  };
  launcher.addEventListener("click", open);
  presence.addEventListener("click", open);
  window.addEventListener("keydown", (event) => {
    if (event.code !== "KeyP" || event.repeat || event.ctrlKey || event.metaKey ||
        event.altKey || hud.hidden || window.UZWindows?.blocksPlay() ||
        (event.target instanceof Element &&
          event.target.closest("input,textarea,select,[contenteditable='true']"))) return;
    event.preventDefault();
    if (panel.open) panel.close();
    else open();
  });

  const command = (action, target) => {
    if (!socket?.connected) return say("Conectando ao mundo…");
    socket.timeout(4000).emit("party:command", { action, target }, (error, result) => {
      if (error) return say("A equipe não respondeu. Tente novamente.");
      say(result?.message || (result?.ok ? "Ação concluída." : "Não foi possível concluir."));
    });
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !state?.party || !socket?.connected) return;
    input.value = "";
    socket.timeout(4000).emit("party:chat", text, (error, result) => {
      if (error || !result?.ok) {
        input.value = text;
        say(result?.message || "Mensagem não enviada. Tente novamente.");
      }
    });
  });

  function appendMessage(name, text, kind = "player") {
    const item = node("div", `party-message is-${kind}`);
    if (name) item.append(node("strong", "", `${name} · `));
    item.append(document.createTextNode(text));
    messages.append(item);
    while (messages.children.length > 36) messages.firstElementChild.remove();
    messages.scrollTop = messages.scrollHeight;
  }

  function meter(className, value, max) {
    const track = node("span", `party-meter ${className}`);
    const fill = node("i");
    fill.style.width = `${Math.max(0, Math.min(100, 100 * value / Math.max(1, max)))}%`;
    track.append(fill);
    return track;
  }

  function renderInvites(list) {
    invites.replaceChildren();
    if (!list.length) return;
    invites.append(node("div", "party-section-head", "CONVITES RECEBIDOS"));
    for (const invitation of list) {
      const card = node("div", "party-invite");
      const label = node("span", "", `${invitation.name} quer lutar ao seu lado.`);
      card.append(label,
        button("Aceitar", () => command("accept", invitation.from)),
        button("Recusar", () => command("decline", invitation.from)));
      invites.append(card);
    }
  }

  function renderRoster(party, selfId) {
    roster.replaceChildren();
    if (!party) {
      roster.append(node("div", "party-empty", "Junte-se a outros guerreiros para avançar em equipe."));
      chat.hidden = true;
      return;
    }
    chat.hidden = false;
    const head = node("div", "party-section-head");
    head.append(node("span", "", `EQUIPE · ${party.members.length}/${4}`),
      button("Sair", () => command("leave")));
    roster.append(head);
    for (const member of party.members) {
      const row = node("div", "party-member");
      const mark = node("span", "party-member-mark", member.name.slice(0, 1).toUpperCase());
      const info = node("div", "party-member-info");
      const identity = node("div", "party-member-identity");
      identity.append(node("strong", "", `${member.id === party.leader ? "♛ " : ""}${member.name}`),
        node("small", "", `NÍV. ${member.level}`));
      info.append(identity, meter("hp", member.hp, member.maxHp),
        meter("ki", member.ki, member.maxKi));
      const location = node("span", "party-member-place",
        member.down ? "CAÍDO" :
          member.id === selfId ? "VOCÊ" :
            member.distance == null ? worldName(member.world) :
              `${member.distance} m · ${member.mode === "flight" ? "voando" : "no solo"}`);
      info.append(location);
      row.append(mark, info);
      if (party.leader === selfId && member.id !== selfId) {
        const actions = node("div", "party-member-actions");
        actions.append(button("♛", () => command("promote", member.id), "Transferir liderança"),
          button("×", () => command("kick", member.id), "Remover da equipe"));
        row.append(actions);
      }
      roster.append(row);
    }
    roster.append(node("small", "party-assist-note",
      "Objetivos de encontro compartilhados entre aliados próximos; auxílio dá experiência extra."));
  }

  function renderNearby(players, self, party) {
    nearby.replaceChildren();
    nearby.append(node("div", "party-section-head", "GUERREIROS POR PERTO"));
    const members = new Set(party?.members.map((member) => member.id) || []);
    const candidates = players
      .filter((player) => player.id !== self.id && !members.has(player.id) &&
        player.world === self.world &&
        Math.hypot(player.x - self.x, player.y - self.y) <= 900)
      .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) -
        Math.hypot(b.x - self.x, b.y - self.y))
      .slice(0, 6);
    if (!candidates.length) {
      nearby.append(node("p", "party-empty", "Nenhum jogador próximo agora."));
      return;
    }
    for (const candidate of candidates) {
      const row = node("div", "party-peer");
      row.append(node("span", "", `${candidate.name} · Nív. ${candidate.level || 1}`));
      const invite = button("Convidar", () => command("invite", candidate.id));
      invite.disabled = !!party && (party.leader !== self.id || party.members.length >= 4);
      row.append(invite);
      nearby.append(row);
    }
  }

  function renderPresence(party, invitations) {
    presence.replaceChildren();
    if (!party && !invitations.length) {
      presence.hidden = true;
      launcher.classList.remove("party-alert");
      return;
    }
    presence.hidden = false;
    launcher.classList.toggle("party-alert", invitations.length > 0);
    if (invitations.length) {
      presence.append(node("strong", "", "✦ CONVITE DE EQUIPE"),
        node("span", "", `${invitations[0].name} convidou você · abrir`));
      return;
    }
    presence.append(node("strong", "", `♛ EQUIPE · ${party.members.length}/4`));
    for (const member of party.members.slice(0, 4)) {
      const row = node("span", "party-presence-row");
      row.append(node("span", "", member.name), meter("hp", member.hp, member.maxHp));
      presence.append(row);
    }
  }

  function update(next) {
    state = next;
    if (!next?.self) return;
    const party = next.party || null;
    const invitations = Array.isArray(next.partyInvites) ? next.partyInvites : [];
    if (lastPartyId && !party) {
      messages.replaceChildren();
      appendMessage("", "A equipe foi encerrada.", "system");
    }
    if (lastPartyId && party && lastPartyId !== party.id) messages.replaceChildren();
    lastPartyId = party?.id || null;
    onlineLabel.textContent = `COOPERATIVO · ${next.online || 1} ONLINE`;
    const nearbyKey = (next.players || [])
      .filter((member) => member.id !== next.self.id && member.world === next.self.world &&
        Math.hypot(member.x - next.self.x, member.y - next.self.y) <= 900)
      .map((member) => `${member.id}:${member.level}`).join("|");
    const signature = JSON.stringify([party, invitations, nearbyKey]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    renderPresence(party, invitations);
    renderInvites(invitations);
    renderRoster(party, next.self.id);
    renderNearby(next.players || [], next.self, party);
  }

  function connect(nextSocket) {
    socket = nextSocket;
    socket.on("party:invite", (invitation) => {
      say(`${invitation.name} convidou você para uma equipe.`);
      open();
    });
    socket.on("party:notice", (message) => {
      say(message);
      appendMessage("", message, "system");
    });
    socket.on("party:chat", (message) => appendMessage(message.name, message.text));
    socket.on("party:assist", (result) =>
      appendMessage("", `${result.members} aliados venceram ${result.enemy}.`, "assist"));
    socket.on("disconnect", () => {
      lastPartyId = null;
      lastSignature = "";
      presence.hidden = true;
      say("Reconectando à equipe…");
    });
  }

  window.UZPartyUI = { connect, update, open };
})();
