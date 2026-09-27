"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    socket = io({ autoConnect: true, reconnection: true }),
    renderer = new Art.Renderer($("world"));
  window.UZSandboxUI?.connect(socket);
  window.UZBetaUI?.connect(socket,type=>openPanel(type));
  let seenDialogue=null;
  let state = null,
    id = null,
    selected = "saiyan",
    panelType = "",
    campaignTab = "db",
    joining = false,
    lastWorld = "",
    lastPhase = -1,
    wasNew = false,
    toastTimer,
    scene = null,
    sceneIndex = 0,
    tutorialIndex = 0,
    tutorialStart = null;
  const keys = new Set(),
    touch = { x: 0, y: 0 },
    held = { guard: false, charge: false, boost: false },
    pointer = { x: innerWidth / 2 + 100, y: innerHeight / 2, used: false };
  let savedToken = "";
  try {
    savedToken = localStorage.getItem("uz-token") || "";
  } catch {}
  const tutorial = [
    {
      title: "Seu primeiro passo",
      body: "Mova-se com WASD ou com o controle à esquerda. Siga o marcador dourado da sua história.",
      done: (p) =>
        tutorialStart &&
        Math.hypot(p.x - tutorialStart.x, p.y - tutorialStart.y) > 100,
    },
    {
      title: "Aprender com quem sabe",
      body: "Encontre Bulma no marcador dourado e use Conversar (E). A investigação abre sua aventura.",
      done: (p) => p.guide?.questId !== "db-paozu" || p.guide?.objectiveId === "pilaf-intel",
    },
    {
      title: "Acerte o ritmo",
      body: "Investigue a pista indicada. O primeiro confronto vem depois; não há pressa.",
      done: (p) => p.guide?.objectiveId === "pilaf-scouts" || p.guide?.questId !== "db-paozu",
    },
    {
      title: "Encontre sua distância",
      body: "Solte Golpe para atacar e confirme o impacto antes de continuar. Segure por 450 ms para um pesado. Após o terceiro acerto, Esquiva persegue por 28 ki.",
      done: (p) => p.guide?.questId !== "db-paozu" || p.guide?.progress > 0,
    },
    {
      title: "Voe, pouse e continue explorando",
      body: "SHIFT ou BOOST acelera. F alterna voo e caminhada. Marque um destino no Atlas, suba à órbita com V e siga a seta; perto de outro planeta, F entra na atmosfera. Defenda no instante do impacto para contra-atacar. Ataque na recuperação do inimigo para causar mais dano.",
      done: () => false,
    },
  ];
  function notice(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 6500);
  }
  function portrait(canvas, skin, scale = 1, form = false, illustrated = false) {
    if(window.UZPortrait?.canvas(canvas,skin))return;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    (illustrated ? Art.character : Art.fighter)(
      c,
      {
        x: canvas.width / 2,
        y: canvas.height * 0.52,
        skin,
        state: "idle",
        angle: -Math.PI / 2,
        form,
      },
      performance.now() / 1000,
      scale,
    );
  }
  for (const o of UZ.ORIGINS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "origin-choice";
    b.dataset.origin = o.id;
    b.setAttribute("aria-label", o.name);
    const cv = document.createElement("canvas");
    cv.width = 84;
    cv.height = 94;
    b.append(cv, document.createTextNode(o.name));
    $("origin-options").append(b);
    portrait(cv, o.skin, 1.2);
    b.onclick = () => select(o.id);
  }
  function select(origin) {
    selected = origin;
    const o = UZ.ORIGINS.find((o) => o.id === origin);
    document.querySelectorAll(".origin-choice").forEach((b) => {
      b.classList.toggle("selected", b.dataset.origin === origin);
      b.setAttribute("aria-pressed", String(b.dataset.origin === origin));
    });
    $("origin-name").textContent = o.name;
    $("origin-style").textContent = o.style;
    $("origin-description").textContent = o.description;
    portrait($("portrait"), o.skin, 1.8, false, true);
    window.UZUI?.origin(origin);
    window.UZCreator?.origin(origin);
  }
  select(selected);
  $("resume-button").hidden = !savedToken;
  const betaInvite=()=>{try{return sessionStorage.getItem('uz-invite')||'';}catch{return '';}};
  function join(resume) {
    if (!socket.connected) {
      notice("Conectando ao servidor. Aguarde um instante.");
      return;
    }
    if (joining) return;
    joining = true;
    wasNew = !resume;
    $("join-button").disabled = true;
    $("join-button").textContent = "Entrando no mundo…";
    socket.emit(
      "join",
      resume
        ? { token: savedToken,invite:betaInvite() }
        : { invite:betaInvite(),name: $("player-name").value.trim(), origin: selected, creation: window.UZCreator?.value() },
    );
    setTimeout(() => {
      if (!id) {
        joining = false;
        $("join-button").disabled = false;
        $("join-button").textContent = "Começar aventura ↗";
      }
    }, 6000);
  }
  $("join-form").onsubmit = (e) => {
    e.preventDefault();
    join(false);
  };
  $("resume-button").onclick = () => join(true);
  socket.on("connect", () => {
    $("connection-dot").classList.add("online");
    $("connection").textContent = "Servidor conectado";
    if (id && savedToken) socket.emit("join", { token: savedToken });
  });
  socket.on("disconnect", () => {
    $("connection-dot").classList.remove("online");
    $("connection").textContent = "Reconectando…";
    resetInput();
  });
  socket.on("connect_error", () => {
    $("connection").textContent = "Servidor indisponível";
  });
  socket.on("joined", (data) => {
    id = data.id;
    savedToken = data.token;
    joining = false;
    try {
      localStorage.setItem("uz-token", savedToken);
    } catch {}
    $("welcome").hidden = true;
    $("welcome-footer").hidden = true;
    $("hud").hidden = false;
    if (wasNew) {
      wasNew = false;
      setTimeout(() => intro(), 300);
    }
  });
  socket.on("notice", notice);
  socket.on("chat", (message) => {
    const p = document.createElement("div"),
      name = document.createElement("b");
    name.textContent = message.name + ": ";
    name.tabIndex=0;name.setAttribute("role","button");name.title="Opções da comunidade";name.onclick=()=>window.UZBetaUI?.community(message.id);name.onkeydown=e=>{if(e.key==="Enter")name.click();};
    p.append(name, document.createTextNode(message.text));
    $("chat-messages").append(p);
    while ($("chat-messages").children.length > 12)
      $("chat-messages").firstChild.remove();
    $("chat-messages").scrollTop = 10000;
  });
  socket.on("snapshot", (next) => {
    state = next;
    window.UZSandboxUI?.update(next);
    window.UZBetaUI?.update(next);
    const p = state.self;
    if(p.dialogue&&p.dialogue.id!==seenDialogue&&!scene&&!$('panel').open&&!document.querySelector('dialog[open]')){seenDialogue=p.dialogue.id;playScene([p.dialogue]);}
    if (lastWorld !== p.world) {
      lastWorld = p.world;
      renderer.setWorld(p.world);
      Sound.setRegion(p.world);
      const world = UZ.getWorld(p.world);
      $("world-name").textContent = world.name.toUpperCase();
      $("region-name").textContent = world.region;
      resetInput();
    }
    for (const fx of next.effects) {
      renderer.effect(fx);
      Sound.play(fx.type);
      if (fx.type === "complete")
        notice(
          fx.text || "Capítulo concluído! Consulte a Jornada para o próximo objetivo.",
        );
      if (fx.type === "level")
        notice("Novo nível! Você ganhou 3 pontos de atributo. Abra Guerreiro.");
    }
    window.UZCombatHUD?.update(next);
    hud();
    checkTutorial();
  });
  const combatHints = {
    beam: "Disparo: saia da linha ou defenda no instante do impacto para devolver o ki.",
    ring: "Onda circular: ganhe distância antes do impacto.",
    cone: "Golpe frontal: flanqueie ou defenda no tempo certo.",
    rush: "Investida: esquive para o lado e contra-ataque.",
  };
  const combatRoles = {
    scout: "BATEDOR", brawler: "LUTADOR", duelist: "DUELISTA",
    skirmisher: "ESCARAMUÇA", artillery: "ARTILHARIA",
    juggernaut: "COLOSSO", aggressive: "AGRESSIVO",
    tank: "DEFENSOR", speedster: "VELOCISTA", zoner: "CONTROLE",
    technical: "TÉCNICO", balanced: "EQUILIBRADO", ranged: "ATIRADOR",
  };
  function targetHud(p) {
    const selected = [...state.enemies,...state.players].find((e) => e.id === p.targetId && !e.dead);
    const warning = state.enemies
      .filter((e) => e.state === "windup" && Math.hypot(e.x - p.x, e.y - p.y) < 850)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const enemy = selected || warning;
    document.body.classList.toggle("combat-focus",!!enemy||state.enemies.some(e=>e.combatTargetId===p.id&&Math.hypot(e.x-p.x,e.y-p.y)<650));
    const card = $("target-card");
    card.hidden = !enemy;
    if (!enemy) return;
    const role = enemy.ai?.archetype || enemy.combatStyle || (enemy.boss ? "duelist" : "brawler");
    card.classList.toggle("is-boss", !!enemy.boss);
    card.classList.toggle("is-warning", enemy.state === "windup");
    $("target-role").textContent = (enemy.boss ? "CHEFE" : enemy.rank==="elite"?"ELITE":enemy.rank==="veteran"?"VETERANO":"ALVO") + " · " + (combatRoles[role] || "COMBATENTE");
    $("target-name").textContent = enemy.name;
    $("target-hp-fill").style.width = Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100)) + "%";
    $("target-advice").textContent = ['recover','breathe'].includes(enemy.state)?'ABERTURA · ataque agora para causar +20% de dano.':enemy.state==='guard'?'GUARDA · flanqueie ou segure Golpe para quebrá-la.':combatHints[enemy.pattern] || "Observe a postura e mantenha sua distância.";
    const tell = $("target-telegraph");
    tell.hidden = enemy.state !== "windup";
    if (!tell.hidden) {
      const remaining = Math.max(0, enemy.attackAt - state.time);
      tell.textContent = (enemy.counterStrike ? "CONTRA-ATAQUE" : enemy.pattern === "beam" ? "DISPARO" : enemy.pattern === "ring" ? "ONDA" : "GOLPE") + " · " + remaining.toFixed(1) + "s";
      card.style.setProperty("--tell", Math.min(100, Math.max(0, 100 * (state.time - enemy.windupAt) / Math.max(0.1, enemy.attackAt - enemy.windupAt))) + "%");
    }
    if (card.dataset.skin !== enemy.skin) {
      portrait($("target-portrait"), enemy.skin, 0.65, !!enemy.form, true);
      card.dataset.skin = enemy.skin;
    }
  }  function hud() {
    if (!state) return;
    const p = state.self,
      o = UZ.ORIGINS.find((o) => o.id === p.origin);
    $("name").textContent = p.name;
    $("level").textContent = p.level;
    $("form-label").textContent = p.form ? "DESPERTADO" : o.name.toUpperCase();
    $("hp-fill").style.width = `${(p.hp / p.maxHp) * 100}%`;
    $("ki-fill").style.width = `${p.ki}%`;
    $("hp-value").textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $("ki-value").textContent = `${Math.floor(p.ki)} KI`;
    $("xp-fill").style.width =
      `${Math.min(100, (p.xp / (p.level * 130)) * 100)}%`;
    $("power").textContent = compact(p.power) + " BP";
    $("focus-value").textContent = Math.floor(p.focus) + "% · R";
    $("awaken-button").disabled = p.focus < 100;
    $("technique-name").textContent =
      UZ.TECHNIQUES.find((t) => t.id === p.equipped)?.name || "Disparo de ki";
    if (window.UZUI) { UZUI.equipped(p.equipped); UZUI.state(p); }
    if (window.FlightUI) FlightUI.update(p);
    $("flight-label").textContent =
      p.world === "space"
        ? "ENTRAR · F"
        : p.mode === "flight"
          ? "POUSO · F"
          : "DECOLAR · F";
    $("flight-button").title =
      p.mode === "flight"
        ? "Pousar na superfície; perto de um planeta, entrar na atmosfera (F)"
        : "Voltar a voar (F)";
    $("flight-button").classList.toggle("grounded", p.mode === "ground");
    portrait($("hud-portrait"), p.skin, 0.92, p.form);
    $("quest-title").textContent = p.storyObjective?.title || p.chapter?.title || "Uma lenda sem fim";
    const world = UZ.getWorld(p.chapter?.world || p.world);
    $("quest-description").textContent = p.storyObjective
      ? p.storyObjective.objective + (p.storyObjective.required > 1 ? ` · ${p.storyObjective.progress}/${p.storyObjective.required}` : "")
      : !p.chapter
        ? "Explore o mundo, pratique no Dojo ou escolha uma expedição na Central."
        : p.chapter.world !== p.world
          ? `Viaje para ${world.name} pelo Atlas.`
          : p.questPhase === 0
            ? `Converse com ${UZ.getWorld(p.world).mentor}.`
            : p.questPhase === 1
              ? `Derrote a patrulha · ${Math.min(3, p.questKills)} / 3`
              : `Enfrente ${p.chapter.boss} na clareira a nordeste.`;
    const goal=p.guide, progressKey=goal?[goal.questId,goal.objectiveId,goal.progress,goal.required].join(':'):[p.questPhase,p.questKills].join(':');
    if ($('quest-progress').dataset.progress!==progressKey) {
      $('quest-progress').replaceChildren();
      const required=goal?Math.min(12,goal.required||1):p.legacyCampaign?3:0;
      for(let i=0;i<required;i++){const dot=document.createElement('i');dot.className=(goal?goal.progress>i:p.questKills>i||p.questPhase===2)?'done':'';$('quest-progress').append(dot);}
      $('quest-progress').dataset.progress=progressKey;
    }
    renderer.combatTarget=[...state.enemies,...state.players].find(e=>e.id===p.targetId);
    targetHud(p);
    const kaiokenButton=document.querySelector('[data-action="kaioken"]');if(kaiokenButton)kaiokenButton.hidden=!p.lore?.done.includes('kaio');
    if(!p.loreObjective)document.getElementById('lore-objective')?.remove();
    const loreSite=UZLore.sites.find(s=>s.world===p.world&&Math.hypot(p.x-s.x,p.y-s.y)<150);
    if(p.loreObjective){
      let box=document.getElementById('lore-objective');
      if(!box){box=document.createElement('div');box.id='lore-objective';box.className = "lore-objective"; box.setAttribute("role", "status");document.body.append(box);}
      const q=p.loreObjective;box.textContent=q.name+' · '+UZ.getWorld(q.world).name+' — '+q.text+' '+(q.world===p.world?Math.round(Math.hypot(q.targetX-p.x,q.targetY-p.y))+' m':'Abra o atlas (M).');
    }
    const guide=p.guide,storyNear=guide?.interactable&&guide.world===p.world&&Number.isFinite(guide.targetX)&&Math.hypot(p.x-guide.targetX,p.y-guide.targetY)<=guide.radius;
    const map = renderer.data,
      near = !!loreSite || (p.loreObjective?.id==='kaio'&&p.world==='otherworld'&&Math.hypot(p.x-p.loreObjective.targetX,p.y-p.loreObjective.targetY)<90) || Math.hypot(p.x - map.mentor.x, p.y - map.mentor.y) < 135,
      orb =
        p.world === "earth" &&
        map.orbs.some(
          (o) =>
            !p.orbs.includes(o.id) && Math.hypot(p.x - o.x, p.y - o.y) < 95,
        ),
      wish =
        p.world === "earth" &&
        p.orbs.length === 7 &&
        Math.hypot(p.x - 1700, p.y - 1740) < 180;
    $("interaction").hidden = !(storyNear || near || orb || wish) || !!scene;
    $("train-button").hidden = !near;
    $("interact-label").textContent = storyNear ? (guide.type==='collect'?'Investigar pista':'Conversar com '+guide.speaker) : wish
      ? "Invocar Shenlong"
      : orb
        ? "Coletar esfera"
        : `Conversar com ${loreSite?.master || map.world.mentor}`;
    $("orbs").replaceChildren();
    for (let i = 1; i <= 7; i++) {
      const s = document.createElement("span");
      s.textContent = i;
      s.className = p.orbs.includes(i) ? "found" : "";
      $("orbs").append(s);
    }
    $("event-banner").hidden = !state.event;
    $("event-banner").textContent = state.event
      ? `✦ Invasão · ${UZ.getWorld(state.event.world).name}`
      : "";
    $("death-screen").hidden = p.state !== "dead";
    $("training").hidden = !p.training;
    $("training-score").textContent = p.training
      ? `${p.training.hits} acertos · ${p.training.attempts}/8 tentativas`
      : "";
    if (p.training)
      $("rhythm-cursor").style.left =
        `${Math.max(0, Math.min(100, 50 + (state.time - p.training.beat) * 36))}%`;
    document.querySelectorAll(".action[data-action]").forEach((b) => {
      const remaining = Math.max(
          0,
          (p.cooldowns[b.dataset.action] || 0) - state.time,
        ),
        duration =
          b.dataset.action === "dash"
            ? 0.75
            : b.dataset.action === "blast"
              ? 1
              : 0.42;
      const cooldownMask = b.querySelector("i");
      if (cooldownMask) cooldownMask.style.height =
        `${Math.min(100, (remaining / duration) * 100)}%`;
    });
  }
  function compact(value) {
    const s = String(value || 0);
    return s.length > 9
      ? s.slice(0, 3) + "e" + (s.length - 1)
      : Number(s).toLocaleString("pt-BR");
  }
  const dialog = $("panel");
  function closePanel() {
    dialog.close();
    document.activeElement?.blur();
    panelType = "";
    resetInput();
  }
  $("close-panel").onclick = closePanel;
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closePanel();
    }
  });
  dialog.addEventListener("close", () => {
    panelType = "";
    resetInput();
  });
  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function button(text, fn, cls = "small-button") {
    const b = el("button", text, cls);
    b.onclick = fn;
    return b;
  }
  function planetEmblem(canvas, world, index) {
    const c = canvas.getContext("2d"), x = 40, y = 40, r = 25;
    c.clearRect(0, 0, 80, 80);
    c.save();
    c.translate(x, y);
    c.rotate(index * 0.39 - 0.24);
    c.strokeStyle = "#9edfff55";
    c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 3, 37, 11, 0, 0, Math.PI * 2); c.stroke();
    const globe = c.createRadialGradient(-10, -14, 2, 3, 5, 36);
    globe.addColorStop(0, "#fff4cb"); globe.addColorStop(0.24, world.color);
    globe.addColorStop(0.75, world.color); globe.addColorStop(1, "#092334");
    c.fillStyle = globe; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
    c.strokeStyle = "#effaff56"; c.lineWidth = 3;
    for (let i = -1; i <= 2; i++) {
      c.beginPath();
      c.ellipse(0, i * 11, 28, 5 + (index % 3), 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "#e8faffaa"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r, -2.4, -0.6); c.stroke();
    c.restore();
    c.fillStyle = "#fff5c7"; c.fillRect(6, 9, 2, 2); c.fillRect(67, 17, 1.5, 1.5);
  }  function openPanel(type) {
    resetInput();
    panelType = type;
    dialog.dataset.kind = type;
    window.UZUI?.panel(type);
    const p = state?.self,
      body = $("panel-body");
    body.replaceChildren();
    $("panel-title").textContent = {
      atlas: "O universo espera.",
      campaigns: "Crônicas de uma lenda.",
      character: "Seu poder. Seu caminho.",
      settings: "Do seu jeito.",
      help: "Poucos comandos. Muitas possibilidades.",
    }[type];
    if (!dialog.open) dialog.showModal();
    if (type === "atlas") {
      body.append(
        el(
          "p",
          "Marque um destino. Suba à órbita com V, siga a bússola e aproxime-se para descer com F. Aprenda a Transmissão instantânea em Yardrat para retornar aos lugares descobertos.",
          "panel-intro",
        ),
      );
      const chart = el("section", undefined, "star-chart"),
        chartHead = el("div", undefined, "star-chart-head"),
        starLayer = el("div", undefined, "star-layer"),
        universes = el("div", undefined, "universe-index");
      chartHead.append(
        el("strong", "MAPA ESTELAR · ROTAS DO MULTIVERSO"),
        el("span", "NAVEGAÇÃO NARRATIVA"),
      );
      const anchors = {
        earth:[20,54,7],namek:[34,74,7],vegeta:[12,20,7],future:[42,18,7],
        otherworld:[57,13,7],demon:[76,86,'REINO DEMONÍACO'],vampa:[66,56,7],
        divine:[60,36,7],arena:[89,80,7],yardrat:[42,49,7],cereal:[48,70,7],
        sadala:[80,18,6],champa:[89,39,6],tsufuru:[22,33,7],kanassa:[10,78,7],
        konatsu:[28,92,7],sacred:[61,87,7],zeno:[90,59,'PALÁCIO REAL'],frieza:[30,10,7]
      };
      const routes = [
        ["earth", "vegeta"],
        ["vegeta", "frieza"],
        ["frieza", "namek"],
        ["namek", "yardrat"],
        ["yardrat", "cereal"],
        ["earth", "future"],
        ["earth", "tsufuru"],
        ["tsufuru", "kanassa"],
        ["kanassa", "konatsu"],
        ["earth", "otherworld"],
        ["otherworld", "sacred"],
        ["sacred", "divine"],
        ["divine", "vampa"],
        ["earth", "arena"],
        ["sadala", "champa"],
        ["divine", "zeno"],
        ["sacred", "demon"],
      ];
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      for (const [from, to] of routes) {
        const a = anchors[from],
          b = anchors[to];
        if (!a || !b) continue;
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`);
        path.setAttribute(
          "class",
          a[2] === b[2] ? "route" : "route rift-route",
        );
        svg.append(path);
      }
      starLayer.append(svg);
      UZ.WORLDS.forEach((w, i) => {
        const [x, y, universe] = anchors[w.id] || [
          20 + ((i * 17) % 65),
          18 + ((i * 23) % 68),
          7,
        ];
        const universeName =
          typeof universe === "number" ? `U${universe}` : universe;
        const point = button(
          "",
          () => {
            socket.emit("route", w.id);
            closePanel();
          },
          "star-point" + (p?.world === w.id ? " current" : ""),
        );
        point.style.left = `${x}%`;
        point.style.top = `${y}%`;
        point.setAttribute("aria-label", `${w.name}, ${universeName}. Viajar`);
        point.title = `${w.name} · ${universeName}`;
        point.append(el("i", w.icon), el("span", w.name));
        starLayer.append(point);
      });
      for (let i = 1; i <= 12; i++) {
        const badge = el("span", `U${i}`, i === 6 || i === 7 ? "charted" : "");
        badge.title = `Universo ${i}`;
        universes.append(badge);
      }
      const mapViewport=el('div',undefined,'star-map-viewport');
      mapViewport.tabIndex=0;
      mapViewport.setAttribute('aria-label','Mapa estelar. Role horizontalmente para explorar todos os destinos.');
      mapViewport.append(starLayer);
      chart.append(chartHead, mapViewport, universes);
      body.append(chart);
      const grid = el("div", undefined, "world-grid");
      for (const [i, w] of UZ.WORLDS.entries()) {
        const b = button(
          "",
          () => {
            socket.emit("route", w.id);
            closePanel();
          },
          "world-card" + (p?.world === w.id ? " current" : ""),
        );
        window.UZUI?.worldCard(b, w.id);
        const symbol = el("span", w.icon, "planet-symbol");
        symbol.style.background = w.color;
        const globe = document.createElement("canvas");
        globe.width = globe.height = 80;
        globe.className = "planet-emblem";
        planetEmblem(globe, w, i);
        b.append(
          globe,
          symbol,
          el("strong", w.name),
          el("small", w.region),
          el(
            "span",
            p?.world === w.id
              ? "VOCÊ ESTÁ AQUI"
              : p?.visited.includes(w.id)
                ? "EXPLORADO"
                : "EXPLORAR",
            "tag",
          ),
        );
        grid.append(b);
      }
      body.append(el('h3','Escolha seu próximo destino'), grid);
      const places = el('details', undefined, 'places-library');
      places.append(el('summary', 'Mestres & lugares de treinamento'));
      for (const site of UZLore.sites) {
        const row = el('div', undefined, 'place-row'), copy=el('div');
        copy.append(el('strong',site.name),el('p',site.description),el('small',UZ.getWorld(site.world).name+' · Nível '+site.level+' · '+(p?.lore?.done.includes(site.id)?'Concluído':'A explorar')));
        row.append(copy, button('Marcar planeta',()=>{socket.emit('route',site.world);closePanel();}));
        places.append(row);
      }
      body.append(places);
      const rift = el("div", undefined, "rift-card"),
        copy = el("div");
      copy.append(
        el("strong", "Além do universo conhecido"),
        el(
          "p",
          "Setores gerados por semente. A paisagem se mantém ao revisitar.",
        ),
      );
      const next = p?.world.startsWith("rift:")
        ? (BigInt(p.world.slice(5)) + 1n).toString()
        : String(
            (p?.visited.filter((v) => v.startsWith("rift:")).length || 0) + 1,
          );
      rift.append(
        copy,
        button("Explorar fronteira ↗", () => {
          socket.emit("travel", "rift:" + next);
          closePanel();
        }),
      );
      body.append(rift);
    }
    if (type === "campaigns") {
      body.append(el('p','A mesma história que orienta o mundo, os diálogos e seu marcador.','panel-intro'));
      const guide=p?.guide;if(guide){body.append(el('h3',guide.title),el('p',guide.objective),button('Marcar objetivo atual',()=>{if(guide.world!==p.world)socket.emit('route',guide.world);closePanel();}));}
      for(const ch of p?.storyJournal||[]){const row=el('div',undefined,'chapter-row'+(ch.status==='active'?' current':''));const copy=el('div');copy.append(el('strong',ch.title),el('p',ch.description),el('small',ch.saga+' · '+({completed:'Concluído',active:'Em andamento',locked:'A seguir'})[ch.status]));row.append(el('span',ch.status==='completed'?'✓':ch.status==='active'?'◆':'○','chapter-number'),copy);body.append(row);}
    }
    if (type === "legacy-campaigns") {
      body.append(
        el(
          "p",
          "Encontros jogáveis inspirados nos principais arcos. GT e filmes ficam em linhas alternativas. As adaptações ainda não cobrem todos os episódios.",
          "panel-intro",
        ),
      );
      const tabs = el("div", undefined, "campaign-tabs");
      for (const c of UZ.CAMPAIGNS)
        tabs.append(
          button(
            c.name,
            () => {
              campaignTab = c.id;
              openPanel("campaigns");
            },
            campaignTab === c.id ? "selected" : "",
          ),
        );
      body.append(tabs);
      const c = UZ.CAMPAIGNS.find((c) => c.id === campaignTab);
      body.append(
        button(
          p?.campaign === c.id
            ? "Campanha em andamento"
            : "Seguir esta campanha",
          () => {
            socket.emit("campaign", c.id);
            closePanel();
          },
        ),
      );
      c.chapters.forEach((ch, i) => {
        const current = Number(p?.progress[c.id] || 0),
          row = el(
            "div",
            undefined,
            "chapter-row" + (i === current ? " current" : ""),
          ),
          copy = el("div");
        copy.append(
          el("strong", ch.title),
          el("p", ch.story),
          el(
            "small",
            UZ.getWorld(ch.world).name +
              " · " +
              ch.boss +
              " · " +
              ch.reward +
              " XP",
          ),
        );
        window.UZUI?.worldCard(row, ch.world);
        const bossPortrait = document.createElement("canvas");
        bossPortrait.width = bossPortrait.height = 64;
        bossPortrait.className = "chapter-portrait";
        portrait(bossPortrait, ch.skin, 1.05);
        row.append(
          bossPortrait,
          el(
            "span",
            i < current ? "✓" : String(i + 1).padStart(2, "0"),
            "chapter-number",
          ),
          copy,
        );
        body.append(row);
      });
    }
    if (type === "character" && p) {
      const hero = el("div", undefined, "character-hero");
      const heroPortrait = document.createElement("canvas");
      heroPortrait.width = 126; heroPortrait.height = 112;
      portrait(heroPortrait, p.skin, 1.05, p.form, true);
      hero.append(heroPortrait, el("div", undefined, "character-hero-copy"));
      hero.lastChild.append(
        el("small", UZ.ORIGINS.find((o) => o.id === p.origin).name.toUpperCase() + " · NÍVEL " + p.level),
        el("strong", p.name),
        el("span", compact(p.power) + " BP · " + p.zenni + " zenni"),
        el("span", p.xp + " / " + (p.level * 130) + " XP"),
      );
      window.UZUI?.hero(hero,p.origin,p.form);
      body.append(hero);
      body.append(
        el(
          "p",
          `${p.points} pontos de atributo disponíveis. O poder cresce com treino e combate; técnica e timing continuam decisivos.`,
        ),
      );
      const stats = el("div", undefined, "build-stats");
      for (const [key, name] of [
        ["force", "FORÇA"],
        ["spirit", "ESPÍRITO"],
        ["vitality", "VITALIDADE"],
      ]) {
        const d = el("div", undefined, "build-stat"),
          add = button("+", () => {
            socket.emit("attribute", key);
            setTimeout(() => openPanel("character"), 130);
          });
        add.disabled = p.points < 1;
        d.append(el("small", name), el("strong", String(p.stats[key])), add);
        stats.append(d);
      }
      body.append(stats, el("h3", "Técnicas & mestres"));
      for (const t of UZ.TECHNIQUES) {
        const row = el("div", undefined, "technique-row"),
          copy = el("div");
        copy.append(
          el("strong", t.name),
          el("p", t.description),
          el(
            "small",
            `Nível ${t.level} · ${UZ.getWorld(t.world).mentor} · ${UZ.getWorld(t.world).name} · ${t.cost} zenni`,
          ),
        );
        const learned = p.techniques.includes(t.id),
          b = button(
            t.id === "teleport" && learned
              ? "Desbloqueada"
              : p.equipped === t.id
                ? "Equipada"
                : learned
                  ? "Equipar"
                  : "Aprender",
            () => {
              socket.emit(learned ? "equip" : "learn", t.id);
              setTimeout(() => openPanel("character"), 150);
            },
          );
        b.disabled = p.equipped === t.id || (t.id === "teleport" && learned);
        row.append(copy, b);
        window.UZUI?.technique(row, t.id);
        body.append(row);
      }
      body.append(
        el(
          "p",
          "Treine perto dos mestres com T. Aprender exige nível, zenni e presença junto ao mestre. Usar uma técnica desenvolve seu domínio até +30% de dano.",
          "panel-note",
        ),
      );
      const gallery = el("details", undefined, "character-gallery"),
        summary = el(
          "summary",
          `Modelos das crônicas · ${UZ.CHARACTERS.length} personagens`,
        ),
        models = el("div", undefined, "character-model-grid");
      gallery.append(
        summary,
        el(
          "p",
          "Retratos vetoriais compactos, com paletas e silhuetas por personagem. Formas e energia mudam durante os combates das sagas.",
        ),
      );
      for (const ch of UZ.CHARACTERS) {
        const figure = el("div", undefined, "character-model"),
          cv = document.createElement("canvas");
        cv.width = 72;
        cv.height = 48;
        Art.fighter(
          cv.getContext("2d"),
          {
            x: 36,
            y: 27,
            skin: ch.skin,
            angle: -0.1,
            state: "idle",
            form: ch.form,
          },
          performance.now() / 1000,
          0.9,
        );
        figure.append(cv, el("strong", ch.name), el("small", ch.kind));
        models.append(figure);
      }
      gallery.append(models);
      body.append(gallery);
      const studio = el(
        "a",
        "Abrir estúdio de personagens e animações ↗",
        "panel-intro",
      );
      studio.href = "/models.html";
      studio.target = "_blank";
      studio.rel = "noopener";
      const artLibrary=el('a','Explorar o acervo ilustrado · 147 peças ↗','art-library-link');
      artLibrary.href='/art-kit.html';artLibrary.target='_blank';artLibrary.rel='noopener';
      body.append(studio,artLibrary);
    }
    if (type === "settings") {
      const row = (name, control) => {
        const r = el("div", undefined, "settings-row");
        r.append(el("span", name), control);
        body.append(r);
      };
      row(
        "Áudio",
        button(Sound.enabled ? "Desativar" : "Ativar", () => {
          toggleSound();
          openPanel("settings");
        }),
      );
      for (const [name, key] of [
        ["Volume dos efeitos", "volume"],
        ["Volume da música", "musicVolume"],
      ]) {
        const input = el("input");
        input.type = "range";
        input.min = 0;
        input.max = 1;
        input.step = 0.05;
        input.value = Sound[key];
        input.setAttribute("aria-label", name);
        input.oninput = () =>
          key === "musicVolume"
            ? Sound.setMusic(Number(input.value))
            : (Sound.volume = Number(input.value));
        row(name, input);
      }
      row(
        "Movimento reduzido",
        button(renderer.reduced ? "Ativado" : "Desativado", () => {
          renderer.reduced = !renderer.reduced;
          document.body.classList.toggle("reduced-motion", renderer.reduced);
          openPanel("settings");
        }),
      );
      row(
        "Duelos consentidos",
        button(p?.pvp ? "Desativar PvP" : "Ativar PvP", () => {
          socket.emit("pvp");
          closePanel();
        }),
      );
      row(
        "Tutorial",
        button("Recomeçar", () => {
          closePanel();
          startTutorial();
        }),
      );
      body.append(
        el(
          "p",
          "Abra Central → Conta para guardar sua chave de recuperação ou exportar seu progresso. A chave é privada e dá acesso ao personagem.",
          "panel-note",
        ),
      );
    }
    if (type === "help") {
      const grid = el("div", undefined, "help-grid");
      for (const [key, title, description] of [
        ["TAB / botão Alvo", "Selecionar adversário", "Alterne alvos próximos ou clique/toque no inimigo. O anel dourado mostra a seleção. Aproxime-se pelo movimento; cada golpe só avança um passo."],
        [
          "WASD / joystick",
          "Movimento livre",
          "Mantenha distância e observe a área vermelha antes do ataque inimigo.",
        ],
        [
          "J / clique / toque",
          "Combo de três",
          "Toque e solte para golpear. Confirme o acerto antes de continuar; errar ou bater na guarda quebra a sequência. Segure 450 ms para pesado (20 ki).",
        ],
        [
          "K / clique direito",
          "Técnica de ki",
          "Toque para disparar; segure para concentrar. Dois golpes e uma técnica rápida produzem Ruptura de ki (+6 ki), pressionando a guarda.",
        ],
        [
          "ESPAÇO",
          "Esquiva & ruptura",
          "Em posição neutra, esquive por 20 ki. Durante atordoamento, rompa a sequência por 45 ki (recarga de 12 s). Golpes comprometidos precisam terminar.",
        ],
        [
          "CTRL ESQUERDO · SHIFT",
          "Defesa & contra-ataque",
          "Ctrl esquerdo defende; SHIFT acelera o voo. Uma defesa nos primeiros 133 ms devolve projéteis e abre contra-ataque. Treine seis tipos de rival em Central → Dojo.",
        ],
        [
          "Q / botão KI",
          "Recuperar energia",
          "Segure para recuperar ki. Você fica mais lento e vulnerável.",
        ],
        [
          "R",
          "Despertar",
          "Acerte golpes para encher o foco. Desperte por 15 segundos.",
        ],
        [
          "V / F / Atlas",
          "Um universo para explorar",
          "Marque o destino no Atlas. V sobe à órbita; voe seguindo a seta. Perto do planeta, F entra na atmosfera. Na superfície, F alterna voo e caminhada. Em Yardrat, aprenda a retornar a pontos descobertos por teleporte.",
        ],
        [
          "E / T / C / M",
          "Sua jornada",
          "Converse, treine, desenvolva o personagem e abra o atlas.",
        ],
      ]) {
        const d = el("div");
        d.append(el("kbd", key), el("strong", title), el("p", description));
        grid.append(d);
      }
      body.append(grid);
    }
  }
  $("map-button").onclick = () => openPanel("atlas");
  $("flight-button").onclick = () => action("flight");
  $("orbit-button").onclick = () => action("orbit");
  $("teleport-button").onclick = () => {
    if (state) socket.emit("travel", state.self.destination);
  };
  $("campaign-button").onclick = () => {
    campaignTab = state?.self.campaign || "db";
    openPanel("campaigns");
  };
  $("character-button").onclick = () => openPanel("character");
  $("help-button").onclick = () => openPanel("help");
  document
    .querySelectorAll("[data-panel]")
    .forEach((b) => (b.onclick = () => openPanel(b.dataset.panel)));
  $("event-banner").onclick = () => openPanel("atlas");
  function toggleSound() {
    Sound.toggle();
    $("audio-button").textContent = Sound.enabled ? "♫" : "♪";
    $("audio-button").setAttribute(
      "aria-label",
      Sound.enabled ? "Desativar áudio" : "Ativar áudio",
    );
    notice(
      Sound.enabled
        ? "Áudio ativado. Volume disponível em Ajustes."
        : "Áudio desativado.",
    );
  }
  $("audio-button").onclick = toggleSound;
  document.addEventListener("sandbox-open", resetInput);
  document.addEventListener("beta-open",resetInput);
  function action(a) {
    if (!state || dialog.open || document.querySelector('dialog[open]') || scene || !socket.connected) return;
    sendCombatInput();
    socket.emit("action", a);
  }
  function resetInput() {
    if (id) socket.emit("action", "cancelCharge");
    keys.clear();
    touch.x = touch.y = 0;
    held.guard = held.charge = held.boost = false;
    pointer.used = false;
    document
      .querySelectorAll(".action")
      .forEach((b) => b.classList.remove("pressed"));
    $("stick").firstElementChild.style.transform = "";
    if (id)
      socket.emit("input", {
        x: 0,
        y: 0,
        angle: state?.self.angle || 0,
        guard: false,
        charge: false,
      });
  }
  function interact() {
    if (scene || dialog.open || document.querySelector('dialog[open]') || !state) return;
    const p = state.self,
      map = renderer.data;
    if(!p.legacyCampaign){socket.emit('interact');return;}
    if(UZLore.sites.some(s=>s.world===p.world&&Math.hypot(p.x-s.x,p.y-s.y)<180)){socket.emit("interact");return;}
    if (
      p.questPhase === 0 &&
      p.chapter &&
      p.chapter.world === p.world &&
      Math.hypot(p.x - map.mentor.x, p.y - map.mentor.y) < 135
    ) {
      playScene(
        [
          {
            speaker: map.world.mentor,
            skin: map.world.skin,
            title: p.chapter.title,
            text: p.chapter.story,
          },
          {
            speaker: p.name,
            skin: p.skin,
            title: "Uma nova missão",
            text: "Vou investigar. Antes, preciso entender o ritmo desses adversários.",
          },
          {
            speaker: map.world.mentor,
            skin: map.world.skin,
            title: "Observe. Responda.",
            text: `Derrote três patrulheiros. Depois, ${p.chapter.boss} estará na clareira a nordeste. Não desperdice energia: uma boa defesa abre o contra-ataque.`,
          },
        ],
        () => socket.emit("interact"),
      );
    } else socket.emit("interact");
  }
  $("interact-button").onclick = interact;
  $("train-button").onclick = () => socket.emit("train");
  $("awaken-button").onclick = () => action("form");
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) {
      if (e.code === "Escape") e.target.blur();
      return;
    }
    if (scene) {
      if (["Space", "Enter"].includes(e.code)) {
        e.preventDefault();
        nextScene();
      }
      return;
    }
    if (e.code === "Escape") {
      if (dialog.open) closePanel();
      return;
    }
    if (dialog.open || document.querySelector('dialog[open]')) return;
    if (
      [
        "Space",
        "ControlLeft",
        "Tab",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    )
      e.preventDefault();
    if(keys.has("ControlLeft"))e.preventDefault();
    keys.add(e.code);
    if (e.code === "ControlLeft") sendCombatInput();
    if (e.repeat) return;
    if (e.code === "KeyJ") action("attackStart");
    if (e.code === "Tab") action("cycleTarget");
    if (e.code === "KeyK") action("blastStart");
    if (e.code === "Space") action("dash");
    if (e.code === "KeyR") action("form");
    if (e.code === "KeyX") action("kaioken");
    if (e.code === "KeyE") interact();
    if (e.code === "KeyT") socket.emit("train");
    if (e.code === "KeyM") openPanel("atlas");
    if (e.code === "KeyF") action("flight");
    if (e.code === "KeyV") action("orbit");
    if (e.code === "KeyC") openPanel("character");
    if (e.code === "Enter") {
      $("chat-input").focus();
      resetInput();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if(e.code === "ControlLeft"){e.preventDefault();sendCombatInput();}
    if (e.code === "KeyJ") action("attackRelease");
    if (e.code === "KeyK" && !e.target.matches("input")) action("blast");
  });
  window.addEventListener("blur", resetInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetInput();
  });
  $("world").addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.used = true;
  });
  $("world").addEventListener("contextmenu", (e) => e.preventDefault());
  $("world").addEventListener("pointerdown", (e) => {
    if(e.pointerType!=="touch"){pointer.x=e.clientX;pointer.y=e.clientY;pointer.used=true;}
    if(state){const wx=renderer.cam.x+(e.clientX-innerWidth/2)/renderer.zoom,wy=renderer.cam.y+(e.clientY-innerHeight/2)/renderer.zoom;const hit=[...state.enemies,...state.players.filter(p=>p.id!==state.self.id&&p.pvp)].find(a=>Math.hypot(a.x-wx,a.y-wy)<65);if(hit)action('target:'+hit.id);}
    if (e.pointerType === "touch") return;
    document.activeElement?.blur();
    if (e.button === 0) action("attackStart");
    if (e.button === 2) action("blastStart");
    $("world").setPointerCapture(e.pointerId);
  });
  $("world").addEventListener("pointercancel", () => action("cancelCharge"));
  $("world").addEventListener("pointerup", (e) => {
    if (e.button === 0 && e.pointerType !== "touch") action("attackRelease");
    if (e.button === 2) action("blast");
  });
  for (const b of document.querySelectorAll("[data-action]")) {
    const a = b.dataset.action;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add("pressed");
      if (a === "guard") held.guard = true;
      else action(a === "blast" ? "blastStart" : a === "attack" ? "attackStart" : a);
    });
    const release = (e) => {
      b.classList.remove("pressed");
      if (a === "guard") held.guard = false;
      else if (a === "blast" && e.type === "pointerup") action("blast");
      else if(a === "attack") action(e.type === "pointerup" ? "attackRelease" : "cancelCharge");
    };
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("lostpointercapture", () => {
      if (a === "guard") held.guard = false;
      b.classList.remove("pressed");
    });
  }
  const stick = $("stick");
  let stickPointer = null;
  function moveStick(e) {
    if (e.pointerId !== stickPointer) return;
    const r = stick.getBoundingClientRect(),
      dx = e.clientX - r.left - r.width / 2,
      dy = e.clientY - r.top - r.height / 2,
      n = Math.max(36, Math.hypot(dx, dy));
    touch.x = dx / n;
    touch.y = dy / n;
    stick.firstElementChild.style.transform = `translate(${touch.x * 30}px,${touch.y * 30}px)`;
  }
  stick.onpointerdown = (e) => {
    if (stickPointer !== null) return;
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  };
  stick.onpointermove = moveStick;
  const releaseStick = () => {
    stickPointer = null;
    touch.x = touch.y = 0;
    stick.firstElementChild.style.transform = "";
  };
  stick.onpointerup = releaseStick;
  stick.onpointercancel = releaseStick;
  stick.onlostpointercapture = releaseStick;
  $("touch-charge").onpointerdown = (e) => {
    held.charge = true;
    e.target.setPointerCapture(e.pointerId);
  };
  $("touch-charge").onpointerup =
    $("touch-charge").onpointercancel =
    $("touch-charge").onlostpointercapture =
      () => (held.charge = false);
  $("touch-boost").onpointerdown = (e) => {
    held.boost = true;
    e.target.setPointerCapture(e.pointerId);
  };
  $("touch-boost").onpointerup =
    $("touch-boost").onpointercancel =
    $("touch-boost").onlostpointercapture =
      () => (held.boost = false);
  function sendCombatInput() {
    if (!state || !socket.connected) return;
    const disabled =
      dialog.open ||
      !!scene ||
      document.activeElement.matches("input,textarea");
    let x = disabled
        ? 0
        : (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
          (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
          touch.x,
      y = disabled
        ? 0
        : (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
          (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) +
          touch.y;
    let angle = state.self.angle;
    if (!disabled) {
      if (pointer.used)
        angle = Math.atan2(
          renderer.cam.y + (pointer.y-innerHeight/2)/renderer.zoom - state.self.y,
          renderer.cam.x + (pointer.x-innerWidth/2)/renderer.zoom - state.self.x,
        );
      else if (Math.hypot(x, y) > 0.1) angle = Math.atan2(y, x);
      else {
        const target = state.enemies
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - state.self.x, a.y - state.self.y) -
              Math.hypot(b.x - state.self.x, b.y - state.self.y),
          )[0];
        if (
          target &&
          Math.hypot(target.x - state.self.x, target.y - state.self.y) < 500
        )
          angle = Math.atan2(target.y - state.self.y, target.x - state.self.x);
      }
    }
    socket.emit("input", {
      x,
      y,
      angle,
      guard: !disabled && (keys.has("ControlLeft") || held.guard),
      manualAim:!disabled&&pointer.used,
      charge: !disabled && (keys.has("KeyQ") || held.charge),
      boost:
        !disabled &&
        (keys.has("ShiftLeft") || keys.has("ShiftRight") || held.boost),
    });
  }
  setInterval(sendCombatInput,33);
  $("chat-form").onsubmit = (e) => {
    e.preventDefault();
    const input = $("chat-input");
    if (input.value.trim()) socket.emit("chat", input.value);
    input.value = "";
    input.blur();
  };
  // Cinematic vector scenes: authored dialogue, skippable, independent of rendering.
  const cinematic = el("section", undefined, "cinematic");
  cinematic.hidden = true;
  cinematic.innerHTML =
    '<canvas id="scene-art" width="1000" height="600"></canvas><div class="cinema-top"><span>UNIVERSE Z · CRÔNICAS</span><button id="skip-scene">Pular cena ↗</button></div><div class="scene-caption"><small id="scene-title"></small><h2 id="scene-speaker"></h2><p id="scene-text"></p><button id="next-scene">Continuar <span>→</span></button><small id="scene-count"></small></div>';
  document.body.append(cinematic);
  let sceneCallback = null;
  function playScene(frames, callback) {
    resetInput();
    scene = frames;
    sceneIndex = 0;
    sceneCallback = callback;
    cinematic.hidden = false;
    drawScene();
    $("next-scene").focus();
  }
  function nextScene() {
    if (!scene) return;
    sceneIndex++;
    if (sceneIndex >= scene.length) {
      cinematic.hidden = true;
      scene = null;
      const cb = sceneCallback;
      sceneCallback = null;
      cb?.();
      return;
    }
    drawScene();
  }
  $("next-scene").onclick = nextScene;
  $("skip-scene").onclick = () => {
    if (scene) {
      sceneIndex = scene.length - 1;
      nextScene();
    }
  };
  function drawScene() {
    const frame = scene[sceneIndex];
    $("scene-title").textContent = frame.title;
    $("scene-speaker").textContent = frame.speaker;
    $("scene-text").textContent = frame.text;
    $("scene-count").textContent =
      `${sceneIndex + 1} / ${scene.length} · ENTER PARA CONTINUAR`;
    const c = $("scene-art").getContext("2d");
    const gradient = c.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, "#b1c3b0");
    gradient.addColorStop(1, "#e2d5ad");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 1000, 600);
    Art.ellipse(c, 720, 145, 80, 80, "#f4e4b5");
    for (let i = 0; i < 7; i++) {
      const x = i * 190 - 100;
      Art.poly(
        c,
        [
          [x, 450],
          [x + 110, 140 + (i % 3) * 40],
          [x + 175, 200],
          [x + 220, 470],
        ],
        i % 2 ? "#769183" : "#8ca491",
      );
    }
    Art.poly(
      c,
      [
        [0, 470],
        [250, 350],
        [540, 390],
        [750, 325],
        [1000, 420],
        [1000, 600],
        [0, 600],
      ],
      "#547464",
    );
    for (let i = 0; i < 12; i++)
      Art.line(
        c,
        [
          [i * 100, 450],
          [i * 100 + 60, 440],
        ],
        "#ffffff12",
        2,
      );
    Art.character(
      c,
      { x: 700, y: 570, skin: frame.skin, state: "idle", angle: Math.PI },
      0,
      5.7,
    );
    window.UZPortrait?.draw(c,frame.skin,460,20,540,540);
    c.fillStyle = "#172b2740";
    c.fillRect(0, 0, 1000, 600);
  }
  window.addEventListener('portrait-ready',()=>{if(scene)drawScene();});
  function intro() {
    playScene(
      [
        {
          title: "PRÓLOGO · UMA NOVA JORNADA",
          speaker: "Cada lenda começa com um passo.",
          skin: "goku",
          text: "Entre montanhas, cidades e estrelas, existem guerreiros capazes de mudar o destino de um universo. Mas antes do poder, vem a escolha de começar.",
        },
        {
          title: "MONTE PAOZU · TERRA",
          speaker: "Bulma",
          skin: "bulma",
          text: "Meu radar captou um sinal nestas montanhas. Antes de procurar confusão, venha conversar comigo. Podemos investigar juntos a trilha ao norte.",
        },
        {
          title: "SUA HISTÓRIA",
          speaker: state?.self.name || "Guerreiro",
          skin: state?.self.skin || "goku",
          text: "Vou conhecer esse mundo, encontrar novos mestres e construir meu próprio caminho. Um combate de cada vez.",
        },
      ],
      startTutorial,
    );
  }
  const tutorialCard = el("aside", undefined, "tutorial-card");
  tutorialCard.hidden = true;
  tutorialCard.innerHTML =
    '<small id="tutorial-step"></small><strong id="tutorial-title"></strong><p id="tutorial-text"></p><button id="tutorial-dismiss">Dispensar</button>';
  document.body.append(tutorialCard);
  function startTutorial() {
    tutorialIndex = 0;
    tutorialStart = state ? { x: state.self.x, y: state.self.y } : null;
    tutorialCard.hidden = false;
    showTutorial();
  }
  function showTutorial() {
    const step = tutorial[tutorialIndex];
    $("tutorial-step").textContent =
      `PRIMEIROS PASSOS · ${tutorialIndex + 1} / ${tutorial.length}`;
    $("tutorial-title").textContent = step.title;
    $("tutorial-text").textContent = step.body;
  }
  function checkTutorial() {
    if (tutorialCard.hidden || !state) return;
    if (
      tutorial[tutorialIndex].done(state.self) &&
      tutorialIndex < tutorial.length - 1
    ) {
      tutorialIndex++;
      showTutorial();
    }
  }
  $("tutorial-dismiss").onclick = () => (tutorialCard.hidden = true);
  function frame(now) {
    renderer.draw(state, { keys, touch }, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
