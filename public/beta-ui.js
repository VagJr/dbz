"use strict";
(() => {
  const B = UZBeta,
    $ = (id) => document.getElementById(id),
    node = (tag, text, cls) => {
      const n = document.createElement(tag);
      if (text != null) n.textContent = text;
      if (cls) n.className = cls;
      return n;
    };
  let socket,
    state,
    router,
    tab = "journey",
    waypoint = null,
    selectedPlayer = "",
    lastSignature = "";
  const dialog = node("dialog", null, "beta-hub");
  dialog.id = "beta-hub";
  dialog.setAttribute("aria-labelledby", "beta-title");
  const header = node("header"),
    title = node("div");
  title.append(
    node("small", "UNIVERSE Z / BETA 1.0"),
    node("h2", "Sua próxima história."),
  );
  title.lastChild.id = "beta-title";
  const btn = (label, fn, cls = "beta-button") => {
    const b = node("button", label, cls);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const close = btn("×", () => dialog.close(), "beta-close");
  close.setAttribute("aria-label", "Fechar central");
  header.append(title, close);
  const nav = node("nav", null, "beta-tabs"),
    body = node("div", null, "beta-body"),
    status = node("p", null, "beta-status");
  status.setAttribute("role", "status");
  const tabs = {
    journey: "Jornada",
    expeditions: "Expedições",
    combat: "Dojo",
    collection: "Coleção",
    community: "Comunidade",
    account: "Conta",
    release: "Sobre a beta",
  };
  for (const [id, label] of Object.entries(tabs)) {
    const b = btn(label, () => {
      tab = id;
      render();
    });
    b.dataset.betaTab = id;
    nav.append(b);
  }
  dialog.append(header, nav, status, body);
  document.body.append(dialog);
  const open = (which) => {
    tab = which || "journey";
    for (const d of document.querySelectorAll("dialog[open]"))
      if (d !== dialog) d.close();
    document.dispatchEvent(new Event("beta-open"));
    render();
    if (!dialog.open) dialog.showModal();
  };
  const launch = btn("✦ Central", () => {}, "beta-launcher");
  launch.id = "beta-launcher";
  launch.onclick = () => open();
  launch.hidden = true;
  document.body.append(launch);
  const accountWelcome = btn(
    "Recuperar acesso · Sobre a beta",
    () => open("account"),
    "beta-welcome-link",
  );
  $("join-form").append(accountWelcome);
  const waypointHUD = node("button", null, "beta-waypoint");
  waypointHUD.type = "button";
  waypointHUD.hidden = true;
  waypointHUD.title = "Abrir expedições";
  waypointHUD.onclick = () => open("expeditions");
  document.body.append(waypointHUD);
  const health = node(
    "span",
    "BETA EM DESENVOLVIMENTO · COMPRAS DESATIVADAS",
    "beta-health",
  );
  $("welcome-footer").prepend(health);
  const image = (src, alt = "") => {
    const im = new Image();
    im.src = src;
    im.alt = alt;
    im.loading = "lazy";
    return im;
  };
  const section = (heading, text) => {
    const s = node("section", null, "beta-section");
    s.append(node("h3", heading));
    if (text) s.append(node("p", text));
    body.append(s);
    return s;
  };
  const message = (text) => (status.textContent = text);
  function request(event, data, after) {
    if (!socket?.connected) {
      message("Conecte-se ao servidor primeiro.");
      return;
    }
    message("Processando…");
    socket.timeout(10000).emit(event, data, (error, result) => {
      if (error) {
        message(
          "Sem resposta do servidor. Aguarde a reconexão antes de tentar novamente.",
        );
        return;
      }
      message(result?.message || "Atualizado.");
      after?.(result);
    });
  }
  function card(grid, name, text, src, action, label) {
    const c = node("article", null, "beta-card");
    c.append(image(src), node("h3", name), node("p", text));
    if (action) c.append(btn(label, action));
    grid.append(c);
    return c;
  }
  function linkPanel(type) {
    dialog.close();
    router?.(type);
  }
  function render() {
    body.replaceChildren();
    status.textContent = "";
    for (const b of nav.children)
      b.setAttribute("aria-pressed", String(b.dataset.betaTab === tab));
    const p = state?.self;
    if (tab === "journey") {
      const hero = node("section", null, "beta-journey-hero");
      hero.append(image("/assets/ui/generated/paozu-background.jpg"));
      const text = node("div");
      text.append(
        node("small", p ? "SEU CAMINHO CONTINUA" : "UM UNIVERSO PARA HABITAR"),
        node(
          "h3",
          p?.storyObjective?.title || "Explore. Construa. Encontre seu ritmo.",
        ),
        node(
          "p",
          p?.storyObjective?.objective ||
            "As crônicas abrem caminhos. Ofícios, construção e expedições dão continuidade à jornada.",
        ),
      );
      hero.append(text);
      body.append(hero);
      if (!p) {
        section(
          "Comece sua jornada",
          "Escolha uma origem na tela inicial. Depois, volte aqui para organizar seus próximos passos.",
        );
        return;
      }
      const grid = node("div", null, "beta-card-grid");
      body.append(grid);
      card(
        grid,
        "Explorar o universo",
        "19 destinos com regiões, flora e desafios próprios.",
        "/assets/ui/generated/menu/44.png",
        () => linkPanel("atlas"),
        "Abrir atlas",
      );
      card(
        grid,
        "Cuidar do seu mundo",
        "Colete recursos, fabrique equipamento e construa um abrigo.",
        "/assets/world-kit/furniture/145.png",
        () => {
          dialog.close();
          UZSandboxUI.open("inventory");
        },
        "Abrir mochila",
      );
      card(
        grid,
        "Continuar as crônicas",
        "Missões persistentes e encontros que mudam de ritmo.",
        "/assets/portraits/goku.png",
        () => linkPanel("campaigns"),
        "Ver crônicas",
      );
      card(
        grid,
        "Dominar seu combate",
        "Treine leitura, defesa precisa e continuação de combos.",
        "/assets/portraits/roshi.png",
        () => linkPanel("help"),
        "Manual de combate",
      );
      const stats = state.beta?.combat || {};
      section(
        "Leitura da sua sessão",
        `${stats.defeated || 0} adversários derrotados · ${stats.parries || 0} defesas precisas · ${stats.damage || 0} dano causado · ${stats.received || 0} recebido.`,
      );
      const next = section("Três passos para começar");
      for (const [label, done] of [
        ["Personalize sua origem", !!p.appearance],
        ["Descubra uma região", state.beta?.progress.explore > 0],
        ["Conclua o primeiro capítulo", state.beta?.progress.story > 0],
      ])
        next.append(node("p", (done ? "✓ " : "○ ") + label));
    }
    if (tab === "expeditions") {
      section(
        "Além da campanha",
        "Encontros opcionais de duas ondas. O nível recomendado, local e condições são claros antes de entrar. Vitória libera progresso cosmético; dinheiro real não participa.",
      );
      const grid = node("div", null, "beta-card-grid");
      body.append(grid);
      for (const def of B.expeditions) {
        const c = card(
          grid,
          def.name,
          "Nível " +
            def.minLevel +
            " · " +
            UZ.getWorld(def.world).name +
            ". " +
            def.description,
          "/assets/portraits/" +
            { earth: "vegeta", namek: "frieza", future: "trunks" }[def.world] +
            ".png",
          () => {
            waypoint = def;
            if (p?.world !== def.world) socket.emit("route", def.world);
            dialog.close();
          },
          "Marcar caminho",
        );
        const start = btn("Iniciar na área", () =>
          request("beta", { action: "expedition", id: def.id }),
        );
        start.disabled =
          !p ||
          p.level < def.minLevel ||
          p.world !== def.world ||
          Math.hypot(p.x - def.x, p.y - def.y) > 280 ||
          !!state.beta?.expedition ||
          Date.now() < (state.beta?.nextExpedition || 0);
        c.append(start);
      }
      if (state?.beta?.expedition)
        section(
          "Expedição em andamento",
          "Onda " +
            state.beta.expedition.wave +
            "/2 · permaneça a até 1.400 m do local. Morte, afastamento ou cinco minutos encerram a tentativa.",
        );
      section(
        "Regras de retorno",
        "Vitória: intervalo de dez minutos. Falha: um minuto. O desafio é opcional e não bloqueia história, exploração ou equipamentos.",
      );
    }
    if (tab === "combat") {
      section('Duelos por habilidade','Melhor de três rounds de 180 segundos. Ambos usam 600 de vida, dano e velocidade equalizados. Equipamento, nível, transformação e consumíveis não dão vantagem. O limite da arena é visível; sair ou desconectar encerra a luta.');
      if(p?.duel){body.append(btn('Desistir do duelo',()=>request('beta',{action:'duelForfeit'})));}
      else if(p?.duelInvite){section('Convite de '+p.duelInvite.name,'Aceite para iniciar a contagem regressiva.');body.append(btn('Aceitar duelo',()=>request('beta',{action:'duelAccept'},r=>{if(r?.ok)dialog.close();})),btn('Recusar convite',()=>request('beta',{action:'duelDecline'})));}
      else if(p){const rivals=node('select');rivals.setAttribute('aria-label','Rival do duelo');rivals.append(new Option('Escolha um jogador próximo',''));for(const q of state.players.filter(q=>q.id!==p.id))rivals.append(new Option(q.name,q.id));body.append(rivals,btn('Convidar para duelo',()=>request('beta',{action:'duelInvite',target:rivals.value})));}
      section('Ritmo dos comandos','Clique e solte para iniciar um golpe; segure por 450 ms para preparar um pesado. O dano só chega no impacto. Acerte para confirmar a próxima parte do combo; errar ou ser defendido devolve a iniciativa. Só o fim da recuperação aceita um comando antecipado. Esquiva durante atordoamento rompe a sequência por 45 ki, com recarga de 12 s.');
      section(
        "Encontre seu ritmo",
        "Pouse junto a um mestre. Escolha a identidade do rival, pratique por três minutos e acompanhe sua sessão. Não há recompensa econômica nem perda de personagem no sparring.",
      );
      const rank = node("select");
      rank.setAttribute("aria-label", "Experiência do rival");
      for (const [id, label] of [
        ["regular", "Aprendiz · reação 420 ms"],
        ["veteran", "Veterano · reação 300 ms"],
        ["elite", "Elite · reação 240 ms"],
      ])
        rank.append(new Option(label, id));
      body.append(rank);
      const grid = node("div", null, "beta-card-grid");
      body.append(grid);
      for (const [id, name, skin, text] of [
        [
          "scout",
          "Batedor",
          "soldier",
          "Pressiona e sai pela lateral. Leia a aproximação.",
        ],
        [
          "brawler",
          "Lutador",
          "piccolo",
          "Prefere contato e pressão. Ataque durante a recuperação.",
        ],
        [
          "duelist",
          "Duelista",
          "vegeta",
          "Defende, esquiva e devolve golpes bloqueados. Varie sua sequência.",
        ],
        [
          "skirmisher",
          "Escaramuça",
          "android",
          "Alterna distância e contato; recua quando cercado.",
        ],
        [
          "artillery",
          "Artilharia",
          "frieza",
          "Mantém distância. Flanqueie ou devolva seu disparo.",
        ],
        [
          "juggernaut",
          "Colosso",
          "jiren",
          "Guarda forte e ondas lentas. Quebre a postura ou saia da área.",
        ],
      ])
        card(
          grid,
          name,
          text,
          "/assets/portraits/" +
            ({ soldier: "goku", android: "cell", jiren: "vegeta" }[skin] ||
              skin) +
            ".png",
          () =>
            request(
              "beta",
              { action: "sparring", role: id, rank: rank.value },
              (r) => {
                if (r?.ok) dialog.close();
              },
            ),
          "Treinar " + name,
        );
      // Portraits share the existing high resolution collection.
      const pictures = [
        "goku",
        "piccolo",
        "vegeta",
        "cell",
        "frieza",
        "vegeta",
      ];
      [...grid.querySelectorAll("img")].forEach(
        (im, i) => (im.src = "/assets/portraits/" + pictures[i] + ".png"),
      );
      body.append(
        btn("Encerrar sparring", () =>
          request("beta", { action: "sparringEnd" }),
        ),
      );
      section(
        "Leia os sinais",
        "Vermelho: ameaça anunciada. Dourado: contra-ataque. Verde: recuperação vulnerável (+20%). A barra azul sob o inimigo mostra energia de ações; espere o fôlego baixar ou pressione a guarda.",
      );
    }
    if (tab === "collection") {
      section(
        "Seu estilo, suas conquistas",
        "Rastros e molduras mudam a apresentação. Não alteram dano, defesa, velocidade, ki, experiência ou capacidade de inventário. Não podem ser negociados. Todos os itens desta beta são conquistáveis.",
      );
      const grid = node("div", null, "beta-card-grid cosmetic-grid");
      body.append(grid);
      for (const c of B.cosmetics) {
        const owned = state?.beta?.claimed.includes(c.id),
          equipped = state?.beta?.equipped[c.slot] === c.id,
          progress = state?.beta?.progress[c.need] || 0;
        const item = card(
          grid,
          c.name,
          c.text,
          "/assets/world-kit/nature/" + String(c.art).padStart(3, "0") + ".png",
          () =>
            request(
              "beta",
              owned
                ? {
                    action: "style",
                    item: equipped ? null : c.id,
                    slot: c.slot,
                  }
                : { action: "claim", item: c.id },
            ),
          equipped
            ? "Remover"
            : owned
              ? "Aplicar"
              : progress >= c.count
                ? "Resgatar"
                : "Em progresso",
        );
        item.style.setProperty("--cosmetic", c.color);
        item.append(
          node(
            "small",
            owned
              ? "PERTENCE A VOCÊ"
              : Math.min(progress, c.count) + " / " + c.count,
          ),
        );
        item.querySelector("button").disabled =
          !p || (!owned && progress < c.count);
      }
      section(
        "Compromisso comercial",
        "Compras estão desativadas. A proposta futura é vender apenas apresentação visual, por preço direto, sem sorteios pagos, bônus de poder, venda de moeda ou revenda por moeda de jogo.",
      );
    }
    if (tab === "community") {
      section(
        "Uma comunidade habitável",
        "Silencie mensagens indesejadas e registre problemas. Relatos ficam na fila do operador; esta beta não promete moderação instantânea.",
      );
      if (!p) {
        section(
          "Entre para participar",
          "A comunidade e os relatos ficam disponíveis depois de entrar no mundo.",
        );
        return;
      }
      const field = node("label", "Jogador próximo"),
        select = node("select");
      select.setAttribute("aria-label", "Jogador do relato");
      select.append(new Option("Problema geral do jogo", ""));
      for (const q of state.players.filter((q) => q.id !== p.id))
        select.append(new Option(q.name, q.id));
      select.value = selectedPlayer;
      field.append(select);
      body.append(field);
      body.append(
        btn("Silenciar jogador", () =>
          request("community", { action: "block", target: select.value }),
        ),
      );
      const label = node("label", "O que aconteceu?"),
        text = node("textarea");
      text.maxLength = 1000;
      text.rows = 5;
      text.placeholder =
        "Descreva o problema, local e o que você estava fazendo. Não inclua senhas ou dados financeiros.";
      text.setAttribute("aria-label", "Descrição do relato");
      label.append(text);
      body.append(
        label,
        btn("Enviar relato", () =>
          request("community", {
            action: "report",
            target: select.value,
            text: text.value,
          }),
        ),
      );
    }
    if (tab === "account") {
      section(
        "Seu personagem, seu acesso",
        "O navegador guarda uma chave privada de sessão. Gere um código de recuperação e guarde fora do navegador. Quem possuir uma dessas chaves poderá acessar o personagem. Nunca compartilhe em relatos ou chat.",
      );
      const invite = node("input");
      invite.type = "password";
      invite.autocomplete = "off";
      invite.placeholder = "Convite da beta, quando exigido";
      invite.setAttribute("aria-label", "Convite da beta");
      try {
        invite.value = sessionStorage.getItem("uz-invite") || "";
      } catch {}
      invite.onchange = () => {
        try {
          sessionStorage.setItem("uz-invite", invite.value);
        } catch {}
      };
      body.append(invite);
      if (p) {
        body.append(
          btn("Gerar código de recuperação", () =>
            request("account", { action: "recovery" }, (r) => {
              if (!r?.code) return;
              const box = node("textarea");
              box.readOnly = true;
              box.value = r.code;
              box.setAttribute("aria-label", "Código privado de recuperação");
              const panel = section(
                "Guarde este código agora",
                "Exibido somente nesta resposta. Gerar outro invalida o anterior. O uso na recuperação também o invalida.",
              );
              panel.append(
                box,
                btn("Copiar código", () =>
                  navigator.clipboard
                    ?.writeText(r.code)
                    .then(() =>
                      message("Código copiado. Guarde em local privado."),
                    )
                    .catch(() => {
                      box.focus();
                      box.select();
                    }),
                ),
              );
            }),
          ),
          btn("Exportar meu progresso", () =>
            request("account", { action: "export" }, (r) => {
              if (!r?.profile) return;
              const url = URL.createObjectURL(
                  new Blob([JSON.stringify(r.profile, null, 2)], {
                    type: "application/json",
                  }),
                ),
                a = node("a");
              a.href = url;
              a.download = "universe-z-meu-progresso.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              message(
                "Exportação preparada. Ela não substitui sua chave de acesso.",
              );
            }),
          ),
        );
      } else {
        const code = node("input");
        code.type = "password";
        code.autocomplete = "off";
        code.placeholder = "Código privado de recuperação";
        code.maxLength = 64;
        code.setAttribute("aria-label", "Código de recuperação");
        body.append(
          code,
          btn("Recuperar personagem", () =>
            request(
              "account",
              { action: "restore", code: code.value.trim() },
              (r) => {
                if (!r?.token) return;
                try {
                  localStorage.setItem("uz-token", r.token);
                } catch {}
                window.location.reload();
              },
            ),
          ),
        );
      }
      section(
        "Dados e exclusão",
        "O servidor guarda progresso, aparências, inventário, transações resumidas e relatos enviados. Não há publicidade nem pagamento nesta beta. Para pedir exclusão, envie um relato pela Comunidade; a operação precisa considerar construções e ofertas compartilhadas.",
      );
    }
    if (tab === "release") {
      section(
        "1.0 beta · candidata a testes",
        "Uma base multiplayer independente em desenvolvimento. O conteúdo é uma adaptação de fã; não é um produto oficial de Dragon Ball. Abertura comercial depende de direitos de uso e validação operacional.",
      );
      section(
        "O que esta versão oferece",
        "Campanha persistente com 28 capítulos, 19 destinos, ofícios, equipamento, construção, mercado local, expedições e coleção visual.",
      );
      section(
        "Limites transparentes",
        "Mundo em um único processo; capacidade configurável para testes, não certificação de MMO massivo. Instabilidades podem exigir manutenção. Campanhas resumidas, cobertura artística parcial, acessibilidade e balanceamento ainda em revisão.",
      );
      section(
        "Sem cobrança nesta beta",
        "Sem cartão, assinatura, moeda premium ou compra aleatória. O catálogo cosmético é uma demonstração funcional de progressão visual. Nenhuma data ou receita de lançamento é prometida.",
      );
      section("Controles de conforto");
      for (const [id, label] of [
        ["calm", "Reduzir efeitos decorativos"],
        ["contrast", "Aumentar contraste"],
        ["large-text", "Ampliar texto dos menus"],
      ]) {
        const b = btn(label, () => {
          document.body.classList.toggle("beta-" + id);
          try {
            localStorage.setItem(
              "uz-" + id,
              String(document.body.classList.contains("beta-" + id)),
            );
          } catch {}
          b.setAttribute(
            "aria-pressed",
            String(document.body.classList.contains("beta-" + id)),
          );
        });
        b.setAttribute(
          "aria-pressed",
          String(document.body.classList.contains("beta-" + id)),
        );
        body.append(b);
      }
    }
  }
  for (const id of ["calm", "contrast", "large-text"])
    try {
      document.body.classList.toggle(
        "beta-" + id,
        localStorage.getItem("uz-" + id) === "true",
      );
    } catch {}
  window.UZBetaUI = {
    connect: (s, r) => {
      socket = s;
      router = r;
    },
    open,
    community: (id) => {
      selectedPlayer = id || "";
      open("community");
    },
    update: (next) => {
      state = next;
      launch.hidden = false;
      const frame = B.cosmetics.find((c) => c.id === next.beta?.equipped.frame);
      document
        .querySelector(".portrait-small")
        ?.style.setProperty("--profile-frame", frame?.color || "#83d5df");
      if (waypoint) {
        const p = next.self,
          d = Math.hypot(p.x - waypoint.x, p.y - waypoint.y),
          same = p.world === waypoint.world;
        waypointHUD.hidden = false;
        waypointHUD.textContent =
          (same
            ? d < 280
              ? "◆ CHEGOU · "
              : "➤ " + Math.round(d) + " m · "
            : "✦ " + UZ.getWorld(waypoint.world).name + " · ") + waypoint.name;
      } else waypointHUD.hidden = true;
      const signature = JSON.stringify([
        next.beta?.claimed,
        next.beta?.equipped,
        next.beta?.expedition?.wave,
        next.self?.duelInvite?.from,next.self?.duel?.id,next.self?.duelResult?.id,
      ]);
      if (
        dialog.open &&
        ["collection", "expeditions", "combat"].includes(tab) &&
        lastSignature !== signature
      )
        render();
      lastSignature = signature;
    },
  };
  const fighter = Art.fighter;
  Art.fighter = (c, e, t, scale = 1) => {
    const cosmetic = B.cosmetics.find((a) => a.id === e.cosmetics?.trail);
    if (
      cosmetic &&
      Math.hypot(e.vx || 0, e.vy || 0) > 80 &&
      !Art.reduceMotion &&
      !document.body.classList.contains("beta-calm")
    ) {
      c.save();
      c.strokeStyle = cosmetic.color + "88";
      c.lineWidth = 3 * scale;
      const a = Math.atan2(e.vy, e.vx);
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(
          e.x - Math.cos(a) * 15 + Math.cos(a + 1.57) * side * 9,
          e.y - Math.sin(a) * 15 + Math.sin(a + 1.57) * side * 9,
        );
        c.lineTo(
          e.x - Math.cos(a) * 50 + Math.cos(a + 1.57) * side * 9,
          e.y - Math.sin(a) * 50 + Math.sin(a + 1.57) * side * 9,
        );
        c.stroke();
      }
      c.restore();
    }
    fighter(c, e, t, scale);
  };
})();
