"use strict";
(() => {
  const labels = {
    sleep: "Descansando", eat: "Fazendo uma refeição", train: "Treinando",
    work: "Trabalhando", duty: "Em serviço", adventure: "Explorando",
    social: "Conversando", travel: "Viajando", accompany: "Ao seu lado",
    respond: "A caminho de um evento",
  };
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  let socket = null, notice = null, state = null, panel = null;
  let current = null, pending = false, requestSerial = 0, lastSignature = "";
  let name, activity, confidence, fill, companionLine, actions, status;

  function ensurePanel() {
    if (panel) return panel;
    const hud = document.getElementById("hud");
    if (!hud) return null;
    panel = node("section", "living-npc-panel");
    panel.id = "living-npc-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Personagem próximo e acompanhante");
    const identity = node("header", "living-npc-identity");
    const marker = node("span", "living-npc-marker", "◇");
    marker.setAttribute("aria-hidden", "true");
    const description = node("div", "living-npc-description");
    name = node("strong", "living-npc-name");
    activity = node("span", "living-npc-activity");
    description.append(name, activity);
    const relationship = node("div", "living-npc-relationship");
    confidence = node("small", "living-npc-confidence");
    const meter = node("span", "living-npc-meter");
    meter.setAttribute("aria-hidden", "true");
    fill = node("i");
    meter.append(fill);
    relationship.append(confidence, meter);
    identity.append(marker, description, relationship);
    companionLine = node("p", "living-npc-companion");
    companionLine.hidden = true;
    actions = node("div", "living-npc-actions");
    status = node("p", "living-npc-status");
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(identity, companionLine, actions, status);
    for (const type of ["pointerdown", "pointerup", "touchstart", "touchend", "keydown"])
      panel.addEventListener(type, event => event.stopPropagation());
    hud.append(panel);
    return panel;
  }

  function report(message) {
    if (!message) return;
    status.textContent = message;
    status.hidden = false;
    status.dataset.feedback = "true";
    if (typeof notice === "function") notice(message);
  }

  function command(npcId, action) {
    if (pending) return;
    if (!socket?.connected) return report("Conectando ao mundo…");
    pending = true;
    const serial = ++requestSerial;
    let finished = false;
    update(state);
    const complete = (error, result) => {
      if (finished || serial !== requestSerial) return;
      finished = true;
      pending = false;
      update(state);
      report(error ? "O personagem não respondeu. Tente novamente." :
        result?.message || (result?.ok ? "Ação concluída." : "Ação indisponível agora."));
    };
    if (typeof socket.timeout === "function")
      socket.timeout(4000).emit("npc:action", { npcId, action }, complete);
    else {
      const timer = setTimeout(() => complete(true), 4000);
      socket.emit("npc:action", { npcId, action }, result => {
        clearTimeout(timer);
        complete(null, result);
      });
    }
  }

  function actionButton(label, npcId, action, disabled, reason) {
    const button = node("button", "living-npc-action is-" + action, label);
    button.type = "button";
    button.disabled = pending || disabled;
    if (reason) button.title = reason;
    button.setAttribute("aria-label", reason && disabled ? label + ". " + reason : label);
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      command(npcId, action);
    });
    return button;
  }

  function findNearby(next) {
    const me = next?.self;
    if (!me) return null;
    let best = null, bestDistance = 185;
    for (const npc of next.npcs || []) {
      if (!npc?.characterId || npc.companion || (npc.world && npc.world !== me.world) ||
          !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) continue;
      const distance = Math.hypot(npc.x - me.x, npc.y - me.y);
      if (distance < bestDistance) { best = npc; bestDistance = distance; }
    }
    return best;
  }

  function update(next) {
    state = next;
    if (!ensurePanel()) return;
    const me = next?.self;
    const companion = me?.npcCompanion;
    current = findNearby(next) || (companion && (next.npcs || []).find(npc =>
      npc?.characterId === companion.id && npc.companion)) || null;
    if (!me || me.state === "dead" || me.afterlife?.pending || (!current && !companion)) {
      panel.hidden = true;
      lastSignature = "";
      return;
    }
    const id = current?.characterId || companion.id;
    const trust = Math.max(0, Math.min(100, Number(me.npcBonds?.[id]) || 0));
    const isCompanion = id === companion?.id;
    const signature = JSON.stringify([id, current?.name, current?.activity,
      !!current?.canFollow, !!current?.canSpar, companion?.id, companion?.name, trust, pending]);
    panel.hidden = false;
    panel.classList.toggle("is-accompanying", !current || isCompanion);
    if (signature === lastSignature) return;
    const previousId = panel.dataset.characterId;
    lastSignature = signature;
    panel.dataset.characterId = id;
    name.textContent = current?.name || companion.name;
    activity.textContent = current ? (labels[current.activity] || "Converse para conhecê-lo") : "Acompanhante";
    confidence.textContent = "Vínculo " + trust + "%";
    fill.style.width = trust + "%";
    companionLine.hidden = !current || !companion || isCompanion;
    companionLine.textContent = companion ? "Com você: " + companion.name : "";
    if (previousId !== id) delete status.dataset.feedback;
    if (!status.dataset.feedback) {
      const hint = current && !companion && current.canFollow && trust < 25
        ? "25% de vínculo para companhia. Converse ou treine para criar confiança."
        : current?.canSpar && trust < 5 ? "Converse antes do primeiro treino amistoso." : "";
      status.hidden = !hint;
      status.textContent = hint;
    }
    actions.replaceChildren();
    if (current) {
      actions.append(actionButton("Conversar", id, "talk", false));
      if (companion)
        actions.append(actionButton("Dispensar", companion.id, "release", false,
          "Dispensar " + companion.name));
      else if (current.canFollow)
        actions.append(actionButton("Convidar", id, "follow", trust < 25,
          trust < 25 ? "Confiança 25% para viajar juntos. Converse ou treine para criar vínculo." : "Viajar juntos"));
      if (current.canSpar) {
        const occupied = ["sleep", "eat", "travel"].includes(current.activity);
        actions.append(actionButton("Treinar", id, "train", occupied || trust < 5,
          occupied ? "Volte durante o período de treino." : trust < 5 ? "Converse antes de treinar." : "Combate amistoso"));
      }
    } else {
      actions.append(actionButton("Conversar", companion.id, "talk", false));
      actions.append(actionButton("Dispensar", companion.id, "release", false));
    }
    panel.setAttribute("aria-busy", pending ? "true" : "false");
  }

  function init(options = {}) {
    socket = options.socket || socket;
    notice = typeof options.notice === "function" ? options.notice : notice;
    ensurePanel();
    if (state) update(state);
  }

  window.UZLivingNpcsUI = { init, update };
})();
