"use strict";
(() => {
  const catalog = () => window.UZWorldEconomy;
  const fallbacks = {
    explorer: { name: "Explorador" }, miner: { name: "Minerador" },
    botanist: { name: "Botânico" }, hunter: { name: "Caçador" },
    fisher: { name: "Pescador" }, engineer: { name: "Engenheiro" },
    cook: { name: "Cozinheiro" }, builder: { name: "Construtor" },
    trader: { name: "Comerciante" }, martial: { name: "Artista marcial" },
  };
  const descriptions = {
    explorer: "Cartografe regiões e acompanhe expedições.",
    miner: "Extraia minérios, pedras e cristais.",
    botanist: "Colha plantas e prepare tônicos.",
    hunter: "Enfrente criaturas e recolha espólios.",
    fisher: "Colete peixes para provisões e comércio.",
    engineer: "Fabrique ferramentas, dispositivos e peças.",
    cook: "Prepare alimentos para longas viagens.",
    builder: "Instale construções e ajude assentamentos.",
    trader: "Venda lotes e conclua entregas.",
    martial: "Treine técnicas e pratique combate.",
  };
  const icons = {
    explorer: "◎", miner: "⛏", botanist: "✿", hunter: "⌖", fisher: "≈",
    engineer: "⚒", cook: "♨", builder: "⌂", trader: "◇", martial: "✧",
  };
  const stages = { early: "Primeiros passos", mid: "Expedições", end: "Grandes desafios", legend: "Legado" };
  const metrics = {
    power: { label: "Poder", unit: "BP", explanation: "Poder de luta registrado no universo." },
    exploration: { label: "Exploração", unit: "regiões", explanation: "Cada região descoberta conta uma vez." },
    craft: { label: "Ofícios", unit: "níveis", explanation: "Soma dos três ofícios mais desenvolvidos." },
    community: { label: "Comunidade", unit: "ações", explanation: "Contribuições em projetos, eventos e expedições." },
  };
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const action = (label, fn, className = "economy-action") => {
    const button = create("button", className, label);
    button.type = "button";
    button.addEventListener("click", fn);
    return button;
  };
  const number = value => new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  const power = value => {
    const digits = /^\d{1,220}$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, "") : "0";
    if (digits.length > 15) return `${digits.slice(0, 3)}… (${digits.length} dígitos)`;
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  const hud = document.getElementById("hud");
  const nav = hud?.querySelector(".bottom-nav");
  let socket = null, notice = null, state = null, view = "professions";
  let metric = "power", pending = false, lastSignature = "";

  const launcher = action("", () => open(), "economy-launcher");
  launcher.id = "world-economy-launcher";
  launcher.title = "Ofícios & Ranking";
  launcher.setAttribute("aria-label", "Abrir ofícios e ranking");
  launcher.setAttribute("aria-controls", "world-economy-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.style.setProperty("--nav-art", 'url("/assets/ui/generated/hud/25.png")');
  launcher.append(create("span", "", "Ofícios & Ranking"));
  launcher.hidden = true;
  if (nav) nav.insertBefore(launcher, nav.lastElementChild);
  else document.body.append(launcher);

  const panel = create("dialog", "economy-panel");
  panel.id = "world-economy-panel";
  panel.setAttribute("aria-labelledby", "world-economy-title");
  panel.dataset.kind = "economy";
  const header = create("header");
  const heading = create("div");
  const title = create("h2", "", "Ofícios & Ranking");
  title.id = "world-economy-title";
  heading.append(create("small", "eyebrow", "VIDA NO UNIVERSO"), title);
  const close = action("×", () => panel.close());
  close.setAttribute("aria-label", "Fechar ofícios e ranking");
  header.append(heading, close);
  const tabs = create("div", "economy-tabs");
  tabs.setAttribute("aria-label", "Conteúdo da janela");
  for (const [id, label] of [["professions", "Ofícios"], ["ranking", "Ranking"]]) {
    const tab = action(label, () => { view = id; lastSignature = ""; render(); });
    tab.dataset.view = id;
    tabs.append(tab);
  }
  const status = create("p", "economy-status");
  status.setAttribute("role", "status");
  const body = create("div", "economy-body");
  panel.append(header, tabs, status, body);
  document.body.append(panel);
  panel.addEventListener("close", () => launcher.setAttribute("aria-expanded", "false"));

  function say(message, error = false) {
    status.textContent = message || "";
    status.dataset.error = String(error);
    if (error && notice) notice(message);
  }
  function open(which = view) {
    if (!state?.self?.economy || hud?.hidden ||
        document.querySelector(".cinematic:not([hidden])")) return;
    if (!window.UZWindows) return;
    if (["professions", "ranking"].includes(which)) view = which;
    lastSignature = "";
    render();
    window.UZWindows.open(panel, "right");
    launcher.setAttribute("aria-expanded", "true");
  }
  function selectProfession(id) {
    if (pending) return;
    const connection = socket || window.UZClient?.socket;
    if (!connection || connection.connected === false || typeof connection.timeout !== "function") {
      say("Conectando ao universo. Aguarde um instante.", true);
      return;
    }
    pending = true;
    say("Atualizando profissão…");
    render();
    connection.timeout(6000).emit("sandbox", { action: "profession", profession: id }, (error, response) => {
      pending = false;
      say(error ? "Sem confirmação. Aguarde a atualização antes de repetir."
        : response?.message || "Resposta indisponível.", !!error || !response?.ok);
      lastSignature = "";
      if (panel.open) render();
    });
  }
  function meter(value, max, label) {
    const track = create("div", "economy-meter");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", label);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(Math.max(1, max)));
    track.setAttribute("aria-valuenow", String(Math.min(max, Math.max(0, value))));
    const fill = create("i");
    fill.style.width = `${Math.max(0, Math.min(100, value / Math.max(1, max) * 100))}%`;
    track.append(fill);
    return track;
  }
  function professionProgress(id, level) {
    let residual = Math.max(0, Number(state.self.economy.proficiency?.[id]) || 0);
    const next = catalog()?.professionXpToNext;
    if (typeof next !== "function") return { xp: residual, next: 0 };
    for (let i = 1; i < Math.min(1000, level); i++) residual -= next(i);
    return { xp: Math.max(0, residual), next: next(level) };
  }
  function renderProfessions() {
    const data = state.self.economy;
    const professionCatalog = catalog()?.professions || fallbacks;
    const progression = state.economy?.progression;
    if (progression) {
      const summary = create("section", "economy-progression");
      const label = create("div", "economy-line");
      label.append(create("strong", "", `Nível ${number(progression.level)}`),
        create("span", "", stages[progression.stage] || "Jornada"));
      summary.append(label,
        meter(Number(progression.xp) || 0, Number(progression.next) || 1, "Experiência de personagem"),
        create("small", "", `${number(progression.xp)} / ${number(progression.next)} XP`));
      body.append(summary);
    }
    const active = professionCatalog[data.activeProfession]?.name || "Explorador";
    body.append(create("p", "economy-hint", `Ativa: ${active} · +20% de prática. A prática de todos os ofícios é permanente.`));
    const remaining = Math.max(0, Math.ceil(((Number(data.switchedAt) || 0) + 600000 - Date.now()) / 60000));
    if (remaining) body.append(create("small", "economy-cooldown", `Próxima troca em até ${remaining} min.`));
    const list = create("div", "economy-profession-list");
    for (const [id, info] of Object.entries(professionCatalog)) {
      const row = create("article", "economy-profession");
      const level = Math.max(1, Number(state.economy?.professions?.[id]) ||
        catalog()?.professionLevel?.(data.proficiency?.[id]) || 1);
      const selected = data.activeProfession === id;
      row.dataset.active = String(selected);
      const mark = create("span", "economy-profession-icon", icons[id] || "◇");
      mark.setAttribute("aria-hidden", "true");
      const copy = create("div", "economy-profession-copy");
      const identity = create("div", "economy-line");
      identity.append(create("strong", "", info.name), create("small", "", `Nív. ${number(level)}`));
      copy.append(identity, create("p", "", descriptions[id] || "Avance com atividades no universo."));
      const progress = professionProgress(id, level);
      if (progress.next) {
        const bar = meter(progress.xp, progress.next, `Prática de ${info.name}`);
        bar.title = `${number(progress.xp)} / ${number(progress.next)} prática`;
        copy.append(bar);
      }
      const choose = action(selected ? "Ativa" : "Escolher", () => selectProfession(id));
      choose.disabled = selected || pending || remaining > 0 || !socket && !window.UZClient?.socket;
      choose.setAttribute("aria-label", selected ? `${info.name}: profissão ativa` : `Ativar ${info.name}`);
      choose.setAttribute("aria-pressed", String(selected));
      row.append(mark, copy, choose);
      list.append(row);
    }
    body.append(list);
    const link = action("Abrir fabricação", () => { window.UZSandboxUI?.open("craft"); panel.close(); }, "economy-text-action");
    if (!window.UZSandboxUI) link.disabled = true;
    body.append(link);
  }
  function renderRankings() {
    const filter = create("div", "economy-ranking-filter");
    const label = create("label", "", "Classificação");
    label.htmlFor = "economy-ranking-metric";
    const select = create("select");
    select.id = "economy-ranking-metric";
    for (const [id, data] of Object.entries(metrics)) {
      const option = create("option", "", data.label);
      option.value = id;
      select.append(option);
    }
    select.value = metric;
    select.addEventListener("change", () => { metric = select.value; lastSignature = ""; render(); });
    filter.append(label, select);
    body.append(filter, create("p", "economy-hint", metrics[metric].explanation));
    const rows = state.economy?.rankings?.[metric] || [];
    if (!rows.length) {
      body.append(create("p", "economy-empty", "O ranking será preenchido conforme os guerreiros explorarem o universo."));
      return;
    }
    const table = create("table", "economy-ranking-table");
    const head = create("thead"), headers = create("tr");
    for (const text of ["#", "Guerreiro", metrics[metric].label]) {
      const cell = create("th", "", text);
      cell.scope = "col";
      headers.append(cell);
    }
    head.append(headers);
    const content = create("tbody");
    for (const [index, data] of rows.slice(0, 10).entries()) {
      const row = create("tr");
      const isSelf = state.self.citizenId && data.id === state.self.citizenId;
      row.dataset.self = String(!!isSelf);
      const rank = create("td", "economy-rank", number(data.rank || index + 1));
      const name = create("td");
      name.append(create("strong", "", `${data.name || "Guerreiro"}${isSelf ? " · você" : ""}`),
        create("small", "", `Nível ${number(data.level)}`));
      const value = create("td", "economy-rank-value", metric === "power" ? power(data.power) : number(data[metric]));
      value.title = `${metric === "power" ? String(data.power || "0") : number(data[metric])} ${metrics[metric].unit}`;
      row.append(rank, name, value);
      content.append(row);
    }
    table.append(head, content);
    body.append(table, create("small", "economy-ranking-note", "Até 10 guerreiros por categoria · atualização ao vivo."));
  }
  function render() {
    if (!state?.self?.economy) return;
    const scroll = body.scrollTop;
    body.replaceChildren();
    panel.dataset.view = view;
    tabs.querySelectorAll("button").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.view === view)));
    if (view === "professions") renderProfessions();
    else renderRankings();
    body.scrollTop = scroll;
  }
  function update(next) {
    state = next;
    launcher.hidden = !next?.self?.economy;
    if (!next?.self?.economy) { if (panel.open) panel.close(); return; }
    const signature = JSON.stringify({ view, metric, economy: next.self.economy,
      professions: next.economy?.professions, progression: next.economy?.progression,
      ranks: view === "ranking" ? next.economy?.rankings?.[metric] : null,
      cooldown: Math.ceil(Math.max(0, (next.self.economy.switchedAt || 0) + 600000 - Date.now()) / 60000), pending });
    if (panel.open && signature !== lastSignature) { render(); lastSignature = signature; }
  }
  function init(options = {}) {
    socket = options.socket || window.UZClient?.socket || socket;
    notice = typeof options.notice === "function" ? options.notice : notice;
    if (panel.open) render();
  }
  window.UZWorldEconomyUI = { init, connect: connection => init({ socket: connection }), update, open };
})();
