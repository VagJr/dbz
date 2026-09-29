"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    socket = io({
      autoConnect: true,
      reconnection: true,
      transports: ["websocket"],
      auth: { protocol: "uz-2" },
    }),
    renderer = new Art.Renderer($("world")),
    realtime = new UZRealtime.Presentation();
  let wireState = null;
  let lastInputAt = 0;
  renderer.canvas.tabIndex = 0;
  document.addEventListener("close", e => {
    if (e.target.tagName === "DIALOG" && state) renderer.canvas.focus({ preventScroll: true });
  }, true);
  const latencyBadge = document.createElement("small");
  latencyBadge.className = "latency-badge";
  $("connection").parentElement.append(latencyBadge);
  function measureLatency() {
    if (!socket.connected) return;
    const start = performance.now();
    socket.timeout(2500).emit("latency", (err) => {
      if (err) { latencyBadge.textContent = "Rede instável"; return; }
      realtime.rtt = performance.now() - start;
      latencyBadge.textContent = `${Math.round(realtime.rtt)} ms`;
      latencyBadge.dataset.quality = realtime.rtt < 100 ? "good" : realtime.rtt < 200 ? "fair" : "slow";
    });
  }
  setInterval(measureLatency, 5000);
  window.UZSandboxUI?.connect(socket);
  window.UZBetaUI?.connect(socket,type=>openPanel(type));
  window.UZPartyUI?.connect(socket);
  window.UZWorldEconomyUI?.init({socket, notice});
  window.UZLivingNpcsUI?.init({socket, notice});
  window.UZSurfaceAtlasUI?.init({socket, notice});
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
    held = { guard: false, charge: false, boost: false, ascend: false, descend: false },
    pointer = { x: innerWidth / 2 + 100, y: innerHeight / 2, used: false };
  const desktopControls = new UZDesktopControls();
  let mobileAimTargetId = null;
  try {
    desktopControls.setMode(localStorage.getItem("uz-desktop-movement-v1"));
  } catch {}
  function setDesktopMovement(mode) {
    desktopControls.setMode(mode);
    try { localStorage.setItem("uz-desktop-movement-v1", desktopControls.mode); } catch {}
    sendCombatInput(true);
  }
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
    wireState = null;
    realtime.connected = true;
    measureLatency();
    $("connection-dot").classList.add("online");
    $("connection").textContent = "Servidor conectado";
    if (id && savedToken) socket.emit("join", { token: savedToken });
  });
  socket.on("disconnect", () => {
    realtime.connected = false;
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
    if (next.actorsDelta) {
      const mergeActors = (list,old) => {
        const byId = new Map((old || []).map(e=>[e.id,e]));
        return list.map(e=>({ ...byId.get(e.id), ...e }));
      };
      next.players = mergeActors(next.players,wireState?.players);
      next.enemies = mergeActors(next.enemies,wireState?.enemies);
    }
    if (next.delta) next = { ...wireState, ...next,
      self: { ...wireState?.self, ...next.self },
      sandbox: { ...wireState?.sandbox, ...next.sandbox } };
    wireState = next;
    state = next;
    window.UZSandboxUI?.update(next);
    window.UZBetaUI?.update(next);
    window.UZPartyUI?.update(next);
    window.UZWorldEconomyUI?.update(next);
    window.UZLivingNpcsUI?.update(next);
    window.UZSurfaceAtlasUI?.update(next);
    const p = state.self;
    if (panels.get("character")?.open) {
      const signature = JSON.stringify([p.stats, p.points, p.power, p.level, p.zenni, p.sandbox?.equipment, p.sandbox?.inventory, p.techniques, p.equipped, p.appearance]);
      if (signature !== characterSignature) {
        characterSignature = signature;
        openPanel("character");
      }
    }
    if(p.dialogue&&p.dialogue.id!==seenDialogue&&!scene&&!window.UZWindows.blocksPlay()){seenDialogue=p.dialogue.id;playScene([p.dialogue]);}
    if (lastWorld !== p.world) {
      lastWorld = p.world;
      renderer.setWorld(p.world);
      Sound.setRegion(p.world);
      const world = UZ.getWorld(p.world);
      $("world-name").textContent = world.name.toUpperCase();
      $("region-name").textContent = world.region;
      resetInput();
    }
    realtime.receive(next, performance.now() / 1000);
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
      tell.textContent = (enemy.counterStrike ? "CONTRA-ATAQUE" : enemy.pattern === "beam" ? "DISPARO DE KI" : enemy.pattern === "ring" ? "ATAQUE EM ÁREA" : enemy.pattern === "rush" ? "INVESTIDA" : "ATAQUE FRONTAL") + " · " + remaining.toFixed(1) + "s";
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
      `${Math.min(100, (p.xp / (state.economy?.progression?.next || p.level * 130)) * 100)}%`;
    $("power").textContent = compact(p.power) + " BP";
    $("focus-value").textContent = Math.floor(p.focus) + "% · R";
    $("awaken-button").disabled = p.focus < 100;
    $("technique-name").textContent =
      UZ.TECHNIQUES.find((t) => t.id === p.equipped)?.name || "Disparo de ki";
    if (window.UZUI) { UZUI.equipped(p.equipped); UZUI.state(p); }
    if (window.FlightUI) FlightUI.update(p);
    if (p.surfaceRoute?.world === p.world) {
      $("route-name").textContent = p.surfaceRoute.name;
      $("route-distance").textContent = p.surfaceRoute.distance + ' m · rota local';
    }
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
    $("touch-ascend").hidden = $("touch-descend").hidden = true;
    $("touch-boost").textContent = p.mode === "ground" ? "PULAR" : "BOOST";
    $("touch-boost").setAttribute("aria-label", p.mode === "ground" ? "Pular" : "Acelerar o voo");
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
    const afterlife=p.afterlife?.pending===true,
      enmaNear=afterlife&&p.world==='otherworld'&&Math.hypot(p.x-p.afterlife.enmaX,p.y-p.afterlife.enmaY)<155;
    const guide=p.guide,storyNear=!afterlife&&guide?.interactable&&guide.world===p.world&&Number.isFinite(guide.targetX)&&Math.hypot(p.x-guide.targetX,p.y-guide.targetY)<=guide.radius;
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
    $("interaction").hidden = !(enmaNear || (!afterlife && (storyNear || near || orb || wish))) || !!scene;
    $("train-button").hidden = afterlife || !near;
    $("interact-label").textContent = enmaNear ? 'Pedir retorno a Enma' : storyNear ? (guide.type==='collect'?'Investigar pista':'Conversar com '+guide.speaker) : wish
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
      ? `✦ ${state.event.title || "Invasão"} · ${UZ.getWorld(state.event.world).name}`
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
      const queued = p.queuedAction;
      const isQueued = !!queued && [queued.kind, queued.tailKind].some(kind => kind &&
        (kind === "ki" ? b.dataset.action === "blast" : b.dataset.action === "attack"));
      b.classList.toggle("queued", isQueued);
      const move = p.combatAction;
      b.classList.toggle("confirmed", b.dataset.action === "attack" &&
        !!move?.confirmed && ["jab", "link", "finisher", "heavy"].includes(move.key));
      b.dataset.combatResult = b.dataset.action === "attack" && move?.result || "";
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
  const panels = new Map();
  const panelTemplate = dialog.cloneNode(true);
  function utilityPanel(type) {
    if (panels.has(type)) return panels.get(type);
    const panel = panels.size ? panelTemplate.cloneNode(true) : dialog;
    panel.id = `game-panel-${type}`;
    for (const child of panel.querySelectorAll("[id]")) child.removeAttribute("id");
    panel.querySelector("h2").id = `${panel.id}-title`;
    panel.setAttribute("aria-labelledby", `${panel.id}-title`);
    panel.lastElementChild.classList.add("panel-body");
    panel.querySelector("header button").onclick = () => panel.close();
    if (panel !== dialog) document.body.append(panel);
    window.UZWindows.register(panel, "left");
    panels.set(type, panel);
    return panel;
  }
  function togglePanel(type) {
    const panel = panels.get(type);
    if (panel?.open) panel.close();
    else openPanel(type);
  }
  function closePanel() {
    dialog.close();
    document.activeElement?.blur();
    panelType = "";
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
  let selectedGearSlot = null;
  let characterSignature = "";
  let modelAngleOffset = 0;
  let warriorPreview = null;
  let lastWarriorFrame = 0;
  function renderWarrior(body, p) {
    const C = UZSandbox;
    const identity = el("div", undefined, "warrior-identity");
    identity.append(el("strong", p.name), el("small", `Nível ${p.level} · ${compact(p.power)} BP`));
    const doll = el("section", undefined, "paper-doll");
    doll.setAttribute("aria-label", "Personagem e slots de equipamento");
    const canvas = document.createElement("canvas");
    canvas.width = 540; canvas.height = 560;
    canvas.className = "paper-doll-art";
    canvas.setAttribute("aria-label", "Ilustração do seu guerreiro");
    const c = canvas.getContext("2d");
    const drawModel = (actor = p, clock = 0) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.scale(2, 2);
      // This is the very same live rig the map draws, at the actor's current
      // direction and animation state. The camera rotation is optional.
      Art.fighter(c, { ...actor, x: 135, y: 133, previewModel: true,
        angle: (actor.angle || 0) + modelAngleOffset,
        combatClock: actor.combatClock ?? clock }, clock, 3.15);
      c.fillStyle = "#e8f5ef";
      c.font = "700 8px system-ui";
      c.textAlign = "center";
      const label = actor.mode === "flight" ? "EM VOO" :
        actor.grounded === false ? (actor.vz > 0 ? "PULANDO" : "EM QUEDA") :
        actor.state === "run" ? "EM MOVIMENTO" :
        actor.state === "guard" ? "EM DEFESA" :
        ["attack", "windup"].includes(actor.state) ? "EM COMBATE" : "NO MUNDO";
      c.fillText(label, 135, 263);
    };
    warriorPreview = { canvas, draw: drawModel };
    drawModel();
    doll.append(canvas);
    const turn = button("↻", () => {
      modelAngleOffset = (modelAngleOffset + Math.PI / 2) % (Math.PI * 2);
      turn.title = "Girar câmera ao redor do personagem";
      turn.setAttribute("aria-label", turn.title);
      drawModel(state?.self || p, performance.now() / 1000);
    }, "doll-turn");
    turn.title = "Girar câmera ao redor do personagem";
    turn.setAttribute("aria-label", turn.title);
    doll.append(turn);
    const ghosts = { head: 0, body: 14, legs: 42, feet: 56, hands: 70, waist: 84, back: 98, weapon: 112, accessory: 140, device: 126 };
    const order = ["head", "body", "hands", "legs", "feet", "back", "weapon", "waist", "accessory", "device"];
    for (const [index, slot] of order.entries()) {
      const item = p.sandbox.equipment[slot];
      const cell = button("", () => { selectedGearSlot = selectedGearSlot === slot ? null : slot; openPanel("character"); }, "gear-cell");
      cell.dataset.slot = slot;
      cell.dataset.empty = String(!item);
      cell.style.setProperty("--slot-row", index % 5);
      cell.style.setProperty("--slot-side", index < 5 ? 0 : 1);
      cell.setAttribute("aria-pressed", String(selectedGearSlot === slot));
      cell.setAttribute("aria-label", `${C.slots[slot]} · ${item ? C.items[item].name : "Vazio"}`);
      cell.title = cell.getAttribute("aria-label");
      const im = new Image();
      im.alt = "";
      const sprite = C.items[item]?.sprite;
      im.src = `/assets/world-kit/equipment/${String(sprite?.index ?? ghosts[slot]).padStart(3, "0")}.png`;
      cell.append(im, el("small", C.slots[slot]));
      doll.append(cell);
    }
    body.append(identity, doll);
    if (selectedGearSlot) {
      const tray = el("section", undefined, "gear-picker");
      const current = p.sandbox.equipment[selectedGearSlot];
      tray.append(el("strong", C.slots[selectedGearSlot]));
      const sendGear = data => socket.timeout(6000).emit("sandbox", data, (err, result) => {
        if (err || !result?.ok) notice(err ? "Sem confirmação. Aguarde antes de repetir." : result?.message || "Não foi possível trocar o equipamento.");
      });
      if (current) tray.append(button("Guardar", () => sendGear({ action: "unwear", slot: selectedGearSlot })));
      const owned = Object.keys(p.sandbox.inventory).filter(id => p.sandbox.inventory[id] > 0 && C.items[id]?.slot === selectedGearSlot);
      const grid = el("div", undefined, "gear-options");
      for (const id of owned) {
        const item = C.items[id];
        const b = button("", () => sendGear({ action: "wear", item: id }), "gear-choice");
        b.title = `${item.name} · +${item.bonus} ${item.stat}`;
        b.setAttribute("aria-label", `Equipar ${item.name}`);
        const im = new Image(); im.alt = "";
        im.src = `/assets/world-kit/equipment/${String(item.sprite.index).padStart(3, "0")}.png`;
        b.append(im); grid.append(b);
      }
      tray.append(grid);
      if (!owned.length) tray.append(el("small", "Nenhum item compatível na mochila."));
      body.append(tray);
    }
    const stats = el("div", undefined, "warrior-stats");
    for (const [key, name] of [["force", "Força"], ["spirit", "Espírito"], ["vitality", "Vitalidade"]]) {
      const tile = el("div");
      const add = button("+", () => socket.emit("attribute", key));
      add.disabled = p.points < 1;
      add.setAttribute("aria-label", `Aumentar ${name}`);
      tile.append(el("small", name), el("strong", String(p.stats[key])), add);
      stats.append(tile);
    }
    body.append(stats, el("small", `${p.points} pontos disponíveis · ${p.zenni} zenni`, "warrior-wallet"));
    const techniques = el("details", undefined, "warrior-techniques");
    techniques.append(el("summary", "Técnicas & mestres"));
    const grid = el("div", undefined, "technique-grid");
    for (const t of UZ.TECHNIQUES) {
      const learned = p.techniques.includes(t.id), equipped = p.equipped === t.id;
      const b = button("", () => socket.emit(learned ? "equip" : "learn", t.id), "technique-tile");
      b.title = `${t.name} · ${t.description} · Nível ${t.level} · ${t.cost} zenni · ${UZ.getWorld(t.world).mentor}`;
      b.setAttribute("aria-label", `${equipped ? "Equipada" : learned ? "Equipar" : "Aprender"} ${t.name}`);
      b.disabled = equipped || (t.id === "teleport" && learned);
      window.UZUI?.technique(b, t.id);
      b.append(el("strong", t.name), el("small", equipped ? "Equipada" : learned ? "Equipar" : "Aprender"));
      grid.append(b);
    }
    techniques.append(grid); body.append(techniques);
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
    const dialog = utilityPanel(type);
    const closePanel = () => dialog.close();
    panelType = type;
    dialog.dataset.kind = type;
    window.UZUI?.panel(type, dialog);
    const p = state?.self,
      body = dialog.querySelector(".panel-body");
    const scrollTop = body.scrollTop;
    body.replaceChildren();
    dialog.querySelector("h2").textContent = {
      atlas: "Atlas estelar",
      campaigns: "Crônicas",
      character: "Guerreiro",
      settings: "Ajustes",
      help: "Controles",
    }[type];
    window.UZWindows.open(dialog, "left");
    requestAnimationFrame(() => { body.scrollTop = scrollTop; });
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
    if (type === "character" && p) renderWarrior(body, p);
    if (type === "settings") {
      const row = (name, control) => {
        const r = el("div", undefined, "settings-row");
        r.append(el("span", name), control);
        body.append(r);
      };
      const movement = el("select");
      movement.setAttribute("aria-label", "Modo de movimento no computador");
      for (const [value, label] of [["hybrid", "Mouse + teclado"], ["screen", "WASD na tela"]]) {
        const option = el("option", label);
        option.value = value;
        movement.append(option);
      }
      movement.value = desktopControls.mode;
      movement.onchange = () => setDesktopMovement(movement.value);
      row("Movimento no PC · Z", movement);
      body.append(el("p", "Mouse + teclado: W segue a mira; A/D desviam para os lados e S recua, mantendo o rumo enquanto a tecla está segurada. WASD na tela: as direções ficam fixas e o mouse orienta os ataques. Z alterna durante o jogo.", "panel-note"));
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
        ["TAB / botão Alvo", "Selecionar adversário", "Alterne alvos próximos ou clique/toque no inimigo. O anel dourado mostra a seleção. No celular, os golpes contra NPCs recebem uma pequena ajuda de mira e aproximação."],
        [
          "WASD / joystick",
          "Movimento livre",
          "Mouse + teclado: W segue a mira, A/D desviam lateralmente e S recua. O desvio e o recuo mantêm seu rumo enquanto você segura a tecla, mesmo virando a mira. Z alterna para WASD fixo na tela; a escolha fica em Ajustes. No celular, o joystick move livremente e a mira acompanha NPCs próximos.",
        ],
        [
          "Clique esquerdo / J / toque",
          "Combo de três",
          "Acertos confirmados devolvem parte do Ki gasto; o finalizador dá um bônus pequeno. Derrotar inimigos recupera um pouco de vida e Ki. Errar ou bater na guarda quebra a sequência. Segure 450 ms para um golpe pesado (18 Ki).",
        ],
        [
          "Clique direito / K",
          "Técnica de ki",
          "Toque para disparar; segure para concentrar. Dois golpes e uma técnica rápida produzem Ruptura de ki (+6 ki), pressionando a guarda.",
        ],
        [
          "ALT ESQUERDO",
          "Esquiva & ruptura",
          "Em posição neutra, esquive por 20 ki. Durante atordoamento, rompa a sequência por 45 ki (recarga de 12 s). Golpes comprometidos precisam terminar.",
        ],
        [
          "ESPAÇO / botão PULAR",
          "Pulo & voo",
          "No chão, Espaço pula. F alterna entre solo e voo; todos os lutadores voam no mesmo plano para facilitar a leitura do combate aéreo. Shift acelera o voo.",
        ],
        [
          "G · SHIFT",
          "Defesa & contra-ataque",
          "G defende; SHIFT acelera o voo. Uma defesa nos primeiros 133 ms devolve projéteis e abre contra-ataque. Treine seis tipos de rival em Central → Dojo.",
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
          "E / T / C / B",
          "Sua jornada",
          "Converse, treine, desenvolva o personagem e abra a mochila.",
        ],
        ["M / N / L", "Exploração", "M abre o mapa local, N o atlas estelar e L a jornada."],
        ["O / P / H / ENTER", "Comunidade e ajuda", "O abre profissões, P abre o grupo, H mostra estes controles e Enter abre o chat."],
      ]) {
        const d = el("div", undefined, "help-item");
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
  const typing = () => document.activeElement.matches('input:not([type="range"]):not([type="checkbox"]),textarea,select,[contenteditable="true"]');
  document.addEventListener("focusin", e => {
    if (state && e.target.matches('input:not([type="range"]):not([type="checkbox"]),textarea,select,[contenteditable="true"]')) resetInput();
  });
  function action(a) {
    if (!state || window.UZWindows.blocksPlay() || scene || !socket.connected || typing()) return;
    sendCombatInput(true);
    const requestedAt = performance.now();
    realtime.intent(a, requestedAt, UZCombat.moves);
    window.UZVFX?.intent(a, state.self, renderer);
    socket.emit("action", a, result => {
      if (result?.ok === false) realtime.rejectIntent(a, requestedAt);
      if (result?.queued) {
        for (const kind of [result.queued.kind, result.queued.tailKind]) {
          if (kind) document.querySelector(`.action[data-action="${kind === "ki" ? "blast" : "attack"}"]`)?.classList.add("queued");
        }
      }
    });
  }
  function resetInput() {
    if (id) socket.emit("action", "cancelCharge");
    keys.clear();
    desktopControls.reset();
    realtime.input = { x: 0, y: 0, angle: state?.self.angle || 0 };
    realtime.hold = null;
    realtime.pending = null;
    touch.x = touch.y = 0;
    held.guard = held.charge = held.boost = held.ascend = held.descend = false;
    pointer.used = false;
    document
      .querySelectorAll(".action")
      .forEach((b) => { b.classList.remove("pressed", "queued"); b._uzPointers?.clear(); });
    chargePointers.clear();
    boostPointers.clear();
    $("stick").firstElementChild.style.transform = "";
    if (id)
      socket.emit("input", {
        x: 0,
        y: 0,
        angle: state?.self.angle || 0,
        guard: false,
        charge: false,
        ascend: false,
        descend: false,
      });
  }
  function interact() {
    if (scene || window.UZWindows.blocksPlay() || !state) return;
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
    if (e.target.matches('input:not([type="range"]):not([type="checkbox"]),textarea,select,[contenteditable="true"]')) {
      if (e.code === "Escape") e.target.blur();
      return;
    }
    if (e.target.closest("button,a,select,summary") && ["Enter","Space","Tab"].includes(e.code)) return;
    // Keep browser-reserved modifier shortcuts out of the game's control map.
    const dodgeModifier = e.code === "AltLeft" && !e.ctrlKey && !e.metaKey;
    if (e.metaKey || e.ctrlKey || e.altKey && !dodgeModifier) return;
    if (scene) {
      if (["Space", "Enter"].includes(e.code)) {
        e.preventDefault();
        nextScene();
      }
      return;
    }
    if (!state) return;
    if (e.code === "Escape") {
      if (window.UZWindows.blocksPlay()) return;
      window.UZWindows.closeTop();
      return;
    }
    if (window.UZWindows.blocksPlay()) return;
    if (["Space", "KeyG", "KeyY", "Tab"].includes(e.code) || dodgeModifier)
      e.preventDefault();
    keys.add(e.code);
    sendCombatInput();
    if (e.repeat) return;
    if (e.code === "KeyZ" && !matchMedia("(pointer: coarse)").matches) {
      setDesktopMovement(desktopControls.mode === "hybrid" ? "screen" : "hybrid");
      notice(desktopControls.mode === "hybrid" ? "Movimento: mouse + teclado" : "Movimento: WASD na tela");
      const option = document.querySelector('select[aria-label="Modo de movimento no computador"]');
      if (option) option.value = desktopControls.mode;
    }
    if (e.code === "KeyJ") action("attackStart");
    if (e.code === "Tab" || e.code === "KeyY") action("cycleTarget");
    if (e.code === "KeyK") action("blastStart");
    if (e.code === "Space" && state.self.mode !== "flight") action("jump");
    if (dodgeModifier) action("dash");
    if (e.code === "KeyR") action("form");
    if (e.code === "KeyX") action("kaioken");
    if (e.code === "KeyE") interact();
    if (e.code === "KeyT") socket.emit("train");
    if (e.code === "KeyM") {
      if (state?.self.world === "space") togglePanel("atlas");
      else window.UZSurfaceAtlasUI?.open();
    }
    if (e.code === "KeyN") togglePanel("atlas");
    if (e.code === "KeyB" || e.code === "KeyI") window.UZSandboxUI?.open("inventory");
    if (e.code === "KeyL") window.UZBetaUI?.open("journey");
    if (e.code === "KeyO") window.UZWorldEconomyUI?.open("professions");
    if (e.code === "KeyP") window.UZPartyUI?.open();
    if (e.code === "KeyH") togglePanel("help");
    if (e.code === "KeyF") action("flight");
    if (e.code === "KeyV") action("orbit");
    if (e.code === "KeyC") togglePanel("character");
    if (e.code === "Enter") {
      $("chat-input").focus();
      resetInput();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    sendCombatInput();
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
    sendCombatInput();
  });
  $("world").addEventListener("contextmenu", (e) => e.preventDefault());
  $("world").addEventListener("pointerdown", (e) => {
    if(e.pointerType!=="touch"){pointer.x=e.clientX;pointer.y=e.clientY;pointer.used=true;}
    if(state){const wx=renderer.cam.x+(e.clientX-innerWidth/2)/renderer.zoom,wy=renderer.cam.y+(e.clientY-innerHeight/2)/renderer.zoom;const hit=[...state.enemies,...state.players.filter(p=>p.id!==state.self.id&&p.pvp)].find(a=>Math.hypot(a.x-wx,a.y-(a.z||0)-wy)<65);if(hit)action('target:'+hit.id);}
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
    const pointers = new Set();
    b._uzPointers = pointers;
    const clear = (e, cancelled = false) => {
      if (e && !pointers.has(e.pointerId)) return;
      if (e) pointers.delete(e.pointerId);
      if (pointers.size) return;
      b.classList.remove("pressed");
      if (a === "guard") {
        held.guard = false;
        sendCombatInput(true);
      } else if (a === "blast") {
        action(cancelled ? "cancelCharge" : "blast");
      } else if (a === "attack") {
        action(cancelled ? "cancelCharge" : "attackRelease");
      }
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (pointers.has(e.pointerId)) return;
      const first = pointers.size === 0;
      pointers.add(e.pointerId);
      try { b.setPointerCapture(e.pointerId); } catch {}
      b.classList.add("pressed");
      if (!first) return;
      if (a === "guard") {
        held.guard = true;
        sendCombatInput(true);
      } else action(a === "blast" ? "blastStart" : a === "attack" ? "attackStart" : a);
    });
    b.addEventListener("pointerup", e => clear(e));
    b.addEventListener("pointercancel", e => clear(e, true));
    b.addEventListener("lostpointercapture", e => clear(e, true));
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
    sendCombatInput();
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
    sendCombatInput();
  };
  stick.onpointerup = releaseStick;
  stick.onpointercancel = releaseStick;
  stick.onlostpointercapture = releaseStick;
  const chargePointers = new Set();
  $("touch-charge").onpointerdown = (e) => {
    e.preventDefault();
    if (chargePointers.has(e.pointerId)) return;
    chargePointers.add(e.pointerId);
    held.charge = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    sendCombatInput(true);
  };
  const releaseCharge = e => {
    if (e && !chargePointers.has(e.pointerId)) return;
    if (e) chargePointers.delete(e.pointerId);
    held.charge = chargePointers.size > 0;
    sendCombatInput(true);
  };
  $("touch-charge").onpointerup = releaseCharge;
  $("touch-charge").onpointercancel = $("touch-charge").onlostpointercapture = e => releaseCharge(e);
  const boostPointers = new Set();
  $("touch-boost").onpointerdown = (e) => {
    e.preventDefault();
    if (boostPointers.has(e.pointerId)) return;
    const first = boostPointers.size === 0;
    boostPointers.add(e.pointerId);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (!first) return;
    if (state?.self.mode === "ground") action("jump");
    else { held.boost = true; sendCombatInput(true); }
  };
  const releaseBoost = e => {
    if (e && !boostPointers.has(e.pointerId)) return;
    if (e) boostPointers.delete(e.pointerId);
    if (boostPointers.size) return;
    held.boost = false;
    sendCombatInput(true);
  };
  $("touch-boost").onpointerup = releaseBoost;
  $("touch-boost").onpointercancel = $("touch-boost").onlostpointercapture = e => releaseBoost(e);
  for (const name of ["ascend", "descend"]) {
    const button = $("touch-" + name);
    button.onpointerdown = e => {
      e.preventDefault();
      if (!state || state.self.mode !== "flight") return;
      held[name] = true;
      try { button.setPointerCapture(e.pointerId); } catch {}
      button.classList.add("pressed");
      sendCombatInput();
    };
      button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => {
      held[name] = false;
      button.classList.remove("pressed");
        sendCombatInput(true);
    };
  }
  function sendCombatInput(reliable = false) {
    if (!state || !socket.connected) return;
    const disabled =
      !!scene || window.UZWindows.blocksPlay() || typing();
    const mobileControls = matchMedia("(pointer: coarse)").matches;
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    let x = disabled ? 0 : strafe + touch.x,
      y = disabled ? 0 : -forward + touch.y;
    let angle = state.self.angle;
    if (!disabled) {
      if (pointer.used && !mobileControls) {
        const predicted = realtime.predicted?.id === state.self.id && realtime.predicted.world === state.self.world;
        const position = predicted ? realtime.predicted : state.self;
        const dx = renderer.cam.x + (pointer.x - innerWidth / 2) / renderer.zoom - position.x - (predicted ? realtime.offset.x : 0);
        const dy = renderer.cam.y + (pointer.y - innerHeight / 2) / renderer.zoom - position.y + (position.z || 0) - (predicted ? realtime.offset.y - (realtime.offset.z || 0) : 0);
        // Keep a steady facing when the cursor crosses the character's center.
        angle = Math.hypot(dx, dy) * renderer.zoom >= 24
          ? Math.atan2(dy, dx) : realtime.input.angle ?? state.self.angle;
      }
      else if (mobileControls) {
        const self = state.self;
        const reference = Math.hypot(x, y) > 0.1 ? Math.atan2(y, x) : self.angle;
        const candidates = [...state.enemies, ...state.players]
          .filter(e => e.id !== self.id && !e.dead && e.state !== "dead" &&
            (state.enemies.includes(e) || ((self.pvp && e.pvp) || (self.duelId && self.duelId === e.duelId))) &&
            Math.hypot(e.x - self.x, e.y - self.y) <= 620 &&
            Math.abs((e.z || 0) - (self.z || 0)) < 110)
          .map(e => {
            const angle = Math.atan2(e.y - self.y, e.x - self.x);
            const delta = Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
            return { e, angle, score: Math.hypot(e.x - self.x, e.y - self.y) + Math.abs(delta) * 150 };
          })
          .sort((a, b) => a.score - b.score);
        const selected = candidates.find(c => c.e.id === mobileAimTargetId || c.e.id === self.targetId);
        const target = selected && (!candidates[0] || selected.score <= candidates[0].score + 85)
          ? selected : candidates[0];
        mobileAimTargetId = target?.e.id || null;
        if (target) angle = target.angle;
        else if (Math.hypot(x, y) > 0.1) angle = Math.atan2(y, x);
      } else if (Math.hypot(x, y) > 0.1) angle = Math.atan2(y, x);
      else {
        let target = state.enemies.find(e => e.id === state.self.targetId);
        if (!target) {
          let nearest = Infinity;
          for(const e of state.enemies) {
            const d=Math.hypot(e.x-state.self.x,e.y-state.self.y);
            if(d<nearest){nearest=d;target=e;}
          }
        }
        if (
          target &&
          Math.hypot(target.x - state.self.x, target.y - state.self.y) < 500
        )
          angle = Math.atan2(target.y - state.self.y, target.x - state.self.x);
      }
    }
    if (disabled || mobileControls) desktopControls.reset();
    else {
      const movement = desktopControls.vector(strafe, forward, angle, pointer.used,
        keys.has("KeyA") || keys.has("KeyD") || keys.has("KeyS"));
      x = movement.x + touch.x;
      y = movement.y + touch.y;
    }
    const magnitude = Math.max(1, Math.hypot(x, y));
    const input = {
      x: x / magnitude,
      y: y / magnitude,
      angle,
      guard: !disabled && (keys.has("KeyG") || held.guard),
      manualAim:!disabled&&pointer.used&&!mobileControls,
      mobileAssist:!disabled&&mobileControls,
      ascend: false,
      descend: false,
      charge: !disabled && (keys.has("KeyQ") || held.charge),
      boost:
        !disabled &&
        (keys.has("ShiftLeft") || keys.has("ShiftRight") || held.boost),
    };
    realtime.input = input;
    const now = performance.now();
    if (reliable || now - lastInputAt >= 16) {
      lastInputAt = now;
      (reliable ? socket : socket.volatile).emit("input", input);
    }
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
    '<canvas id="scene-art" width="1000" height="600"></canvas><div class="cinema-top"><span>UNIVERSE Z · CRÔNICAS</span><div><button id="pause-scene" hidden>Pausar</button><button id="skip-scene">Pular cena ↗</button></div></div><div class="scene-caption"><small id="scene-title"></small><h2 id="scene-speaker"></h2><p id="scene-text"></p><button id="next-scene">Continuar <span>→</span></button><small id="scene-count"></small></div>';
  document.body.append(cinematic);
  let sceneCallback = null;
  let sceneTimer = null, scenePaused = false;
  function playScene(frames, callback) {
    resetInput();
    scene = frames;
    sceneIndex = 0;
    sceneCallback = callback;
    scenePaused = false;
    cinematic.classList.remove("paused");
    $("pause-scene").textContent = "Pausar";
    cinematic.hidden = false;
    drawScene();
    $("next-scene").focus();
  }
  function nextScene() {
    if (!scene) return;
    clearTimeout(sceneTimer);
    sceneIndex++;
    if (sceneIndex >= scene.length) {
      cinematic.hidden = true;
      renderer.canvas.focus({ preventScroll: true });
      scene = null;
      const cb = sceneCallback;
      sceneCallback = null;
      cb?.();
      return;
    }
    drawScene();
  }
  $("next-scene").onclick = nextScene;
  $("pause-scene").onclick = () => {
    scenePaused = !scenePaused;
    cinematic.classList.toggle("paused",scenePaused);
    $("pause-scene").textContent = scenePaused ? "Reproduzir" : "Pausar";
    clearTimeout(sceneTimer);
    if (!scenePaused && scene?.[sceneIndex]?.autoplay) sceneTimer=setTimeout(nextScene,9000);
  };
  $("skip-scene").onclick = () => {
    if (scene) {
      sceneIndex = scene.length - 1;
      nextScene();
    }
  };
  const sceneImages = new Map();
  function drawScene() {
    const frame = scene[sceneIndex];
    clearTimeout(sceneTimer);
    $("pause-scene").hidden = !frame.autoplay;
    if (frame.autoplay && !scenePaused) sceneTimer=setTimeout(nextScene,Math.max(7500,frame.text.length*47));
    $("scene-title").textContent = frame.title;
    $("scene-speaker").textContent = frame.speaker;
    $("scene-text").textContent = frame.text;
    $("scene-count").textContent =
      `${sceneIndex + 1} / ${scene.length} · ENTER PARA CONTINUAR`;
    window.UZProduction?.scene(frame, sceneIndex, state?.self.world || "earth");
    const c = $("scene-art").getContext("2d");
    c.clearRect(0,0,1000,600);
    const source=window.UZPortrait?.source(frame.skin);
    if (source) {
      const im = sceneImages.get(source) || new Image();
      if (!sceneImages.has(source)) {
        sceneImages.set(source,im);
        im.onload=()=>{if(scene&&scene[sceneIndex]===frame)drawScene();}; im.src=source;
      }
      if(im.naturalWidth)c.drawImage(im,300,15,580,580);
    } else Art.character(c,{x:700,y:420,skin:frame.skin,state:"idle",angle:Math.PI},0,5.7);
  }
  window.addEventListener('portrait-ready',()=>{if(scene)drawScene();});
  function intro() {
    playScene(
      [
        {
          title: "PRÓLOGO · UMA NOVA JORNADA",
          autoplay: true,
          speaker: "Cada lenda começa com um passo.",
          skin: "goku",
          text: "Entre montanhas, cidades e estrelas, existem guerreiros capazes de mudar o destino de um universo. Mas antes do poder, vem a escolha de começar.",
        },
        {
          title: "MONTE PAOZU · TERRA",
          autoplay: true,
          speaker: "Bulma",
          skin: "bulma",
          text: "Meu radar captou um sinal nestas montanhas. Antes de procurar confusão, venha conversar comigo. Podemos investigar juntos a trilha ao norte.",
        },
        {
          title: "SUA HISTÓRIA",
          autoplay: true,
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
    if (!document.hidden && !scene && (!window.UZProduction?.titleVisible() || state)) {
      const present = realtime.sample(now / 1000) || state;
      renderer.draw(present, { keys, touch }, now / 1000);
      window.UZVFX?.draw(renderer, now / 1000);
      if (warriorPreview?.canvas.isConnected &&
          now - lastWarriorFrame >= 40 && present?.self) {
        warriorPreview.draw(present.self, now / 1000);
        lastWarriorFrame = now;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
