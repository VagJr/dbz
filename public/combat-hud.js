"use strict";
(() => {
  const status = document.createElement("div");
  status.id = "combat-rhythm";
  status.hidden = true;
  status.setAttribute("aria-label", "Ritmo do combate");
  const label = document.createElement("strong"),
    bar = document.createElement("i"),
    hint = document.createElement("span");
  status.append(label, bar, hint);
  document.body.append(status);
  const duel = document.createElement("button");
  duel.id = "duel-status";
  duel.hidden = true;
  duel.onclick = () => UZBetaUI.open("combat");
  document.body.append(duel);
  window.UZCombatHUD = {
    update: (s) => {
      const p = s.self,
        m = p.combatAction;
      const technicalMove = m && !["jab", "link", "finisher"].includes(m.key);
      status.hidden = !(
        technicalMove ||
        p.counterUntil > s.time ||
        p.clash ||
        p.beamControl
      );
      if (p.clash) {
        const q = p.clash,
          beat = Math.floor((s.time - q.start) / q.period),
          phase = ((s.time - q.start) / q.period) % 1;
        label.textContent =
          q.type === "beam" ? "DISPUTA DE KI" : "TROCAÇÃO · ATAQUE / DEFESA";
        const expected =
          q.type === "beam" ? "KI" : beat % 2 ? "DEFESA" : "ATAQUE";
        hint.textContent =
          expected +
          " no centro da barra · " +
          q.scores[q.side].toFixed(1) +
          " × " +
          q.scores[1 - q.side].toFixed(1);
        bar.style.width = phase * 100 + "%";
        status.dataset.phase = "DISPUTA";
      } else if (p.beamControl) {
        label.textContent = "BEAM · CONTROLE DE CURVA";
        bar.style.width = "100%";
        hint.textContent = "Mova a mira · curva limitada por 0,65 s";
        status.dataset.phase = "IMPACTO";
      } else if (technicalMove) {
        const stage =
          s.time < m.impact
            ? "PREPARAÇÃO"
            : s.time < m.activeEnd
              ? "IMPACTO"
              : "RECUPERAÇÃO";
        label.textContent = m.name + " · " + stage;
        bar.style.width =
          Math.min(100, ((s.time - m.start) / (m.end - m.start)) * 100) + "%";
        status.dataset.phase = stage;
        hint.textContent =
          m.exhausted ? "SEM KI · golpes mais lentos e fracos" : ["jab","link","finisher"].includes(m.key) ? "Clique para continuar · direcione com a mira" : m.confirmed && ["jab", "link"].includes(m.key)
            ? "Acerto confirmado · encadeie golpe ou ki"
            : stage === "RECUPERAÇÃO"
              ? m.end - s.time <= UZCombat.buffer
                ? "Próximo comando disponível"
                : "Espere a abertura"
              : "Direção comprometida · observe o rival";
      } else {
        label.textContent =
          p.counterUntil > s.time
            ? "CONTRA-ATAQUE DISPONÍVEL"
            : "DISTÂNCIA · LEITURA · KI";
        bar.style.width = "0%";
        hint.textContent = "Golpe → confirmar → continuar ou reposicionar";
      }
      duel.hidden = !(p.duel || p.duelInvite || p.duelResult);
      duel.textContent = p.duel
        ? p.duel.countdown > 0
          ? "PREPARE-SE · " + Math.ceil(p.duel.countdown)
          : "ROUND " +
            p.duel.round +
            " · " +
            p.duel.score.join(" × ") +
            " · " +
            p.duel.seconds +
            " s"
        : p.duelInvite
          ? "Convite de " + p.duelInvite.name + " · abrir Dojo"
          : p.duelResult
            ? p.duelResult.reason + " · " + p.duelResult.score.join(" × ")
            : "";
    },
  };
})();
