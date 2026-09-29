"use strict";
(() => {
  const C = UZSandbox,
    $ = (id) => document.getElementById(id);
  let socket,
    state,
    tab = "inventory",
    pending = false,
    refresh = false,
    lastJournal = "",
    lastInventorySignature = "",
    lastRender = 0,
    tracked = null,
    selectedItem = null, craftCategory = "basic", craftPage = 0;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const art = (id) => {
    const im = new Image();
    const sprite=C.items[id]?.sprite;
    im.src = sprite ? `/assets/world-kit/${sprite.sheet}/${String(sprite.index).padStart(3,"0")}.png` : "/assets/ui/generated/combat/46.png?v=celestial1";
    im.alt = "";
    return im;
  };
  const button = (text, fn) => {
    const b = el("button", text, "sandbox-button");
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const dialog = el("dialog", undefined, "sandbox-panel");
  dialog.id = "sandbox-panel";
  dialog.setAttribute("aria-labelledby", "sandbox-title");
  const head = el("header"),
    heading = el("div");
  heading.append(el("small", "UNIVERSE Z / VIDA NO UNIVERSO"));
  const h = el("h2", "Seu mundo. Suas escolhas.");
  h.id = "sandbox-title";
  heading.append(h);
  const close = button("×", () => dialog.close());
  close.setAttribute("aria-label", "Fechar vida no universo");
  head.append(heading, close);
  const nav = el("nav", undefined, "sandbox-tabs"),
    body = el("div", undefined, "sandbox-body"),
    status = el("p", "", "sandbox-status");
  status.setAttribute("role", "status");
  const tabs = {
    inventory: "Mochila",
    explore: "Explorar",
    craft: "Fabricar",
    build: "Construir",
    practice: "Evoluir",
    contracts: "Contratos",
    market: "Mercado",
    legacy: "Legado",
  };
  for (const [key, label] of Object.entries(tabs)) {
    const b = button(label, () => {
      tab = key;
      render();
    });
    b.dataset.tab = key;
    nav.append(b);
  }
  dialog.append(head, nav, status, body);
  document.body.append(dialog);
  const launcher = button("◎ Vida no universo · B", () => open());
  launcher.id = "sandbox-launcher";
  launcher.hidden = true;
  document.body.append(launcher);
  const context = button("", () => contextAction());
  context.id = "sandbox-context";
  context.hidden = true;
  document.body.append(context);
  const progress = el("div", undefined, "sandbox-progress");
  progress.hidden = true;
  const progressText = el("span"),
    fill = el("i"),
    cancel = button("Cancelar", () => send({ action: "cancel" }));
  progress.append(progressText, fill, cancel);
  document.body.append(progress);
  const near = (o) =>
    o.world === state.self.world
      ? Math.hypot(o.x - state.self.x, o.y - state.self.y)
      : Infinity;
  function nearest() {
    return state?.sandbox?.objects
      .filter((o) => o.ready)
      .sort((a, b) => near(a) - near(b))[0];
  }
  function contextAction() {
    const n = nearest();
    if (n && near(n) <= (n.type === "resource" ? 130 : 180))
      send({
        action: n.type === "resource" ? "gather" : "structure",
        target: n.id,
      });
    else open("explore");
  }
  function open(which = tab) {
    if (!state || document.querySelector(".cinematic:not([hidden])")) return;
    document.dispatchEvent(new Event("sandbox-open"));
    tab = which;
    window.UZWindows.open(dialog, "right");
    render();
  }
  function send(data) {
    if (pending) return;
    pending = true;
    status.textContent = "Processando…";
    socket.timeout(6000).emit("sandbox", data, (err, result) => {
      pending = false;
      refresh = true;
      status.textContent = err
        ? "Sem confirmação. Aguarde a atualização antes de repetir."
        : result?.message || "Resposta indisponível.";
      status.dataset.error = String(!!err || !result?.ok);
      if (dialog.open) render();
    });
  }
  function section(title, text) {
    const s = el("section", undefined, "sandbox-section");
    s.append(el("h3", title));
    if (text) s.append(el("p", text));
    body.append(s);
    return s;
  }
  function row(parent, title, text, item, buttons = []) {
    const r = el("article", undefined, "sandbox-row");
    if (item) r.append(art(item));
    const copy = el("div");
    copy.append(el("strong", title), el("p", text));
    r.append(copy);
    const actions = el("div", undefined, "sandbox-row-actions");
    actions.append(...buttons);
    r.append(actions);
    parent.append(r);
    return r;
  }
  function costs(cost) {
    return Object.entries(cost)
      .map(([key, n]) => n + " " + C.items[key].name)
      .join(" · ");
  }
  function slotButton(key, qty, click, label){
    const b=button('',click);b.classList.add('item-slot');b.setAttribute('aria-label',label || ((C.items[key]?.name||'Slot livre')+' · '+qty));
    if(key){b.append(art(key));if(qty>1)b.append(el('span',String(qty),'slot-quantity'));}else b.append(el('span','＋','slot-empty'));
    b.title=label||C.items[key]?.name||'Slot livre';b.dataset.item=key||'';b.setAttribute('aria-pressed',String(!!key&&selectedItem===key));return b;
  }
  function inventoryView(p,s){
    const layout=el('div',undefined,'inventory-layout');
    const bag=el('section',undefined,'inventory-bag');bag.append(el('h3','Mochila'),el('p','Selecione um item para ver uso, equipamento ou instalação.','inventory-hint'));const grid=el('div',undefined,'inventory-grid');const owned=Object.entries(s.inventory).filter(([,n])=>n>0);for(const [key,n]of owned)grid.append(slotButton(key,n,()=>{selectedItem=key;render();}));for(let i=owned.length;i<Math.max(30,Math.ceil(owned.length/6)*6);i++){const empty=slotButton(null,0,()=>{});empty.disabled=true;grid.append(empty);}bag.append(grid);layout.append(bag);body.append(layout);
    const item=C.items[selectedItem];if(item){const detail=el('section',undefined,'item-detail');detail.append(art(selectedItem),el('h3',item.name));const equipped=Object.values(s.equipment).includes(selectedItem);detail.append(el('p',item.slot?C.slots[item.slot]+' · +'+item.bonus+' '+({force:'força',spirit:'espírito',vitality:'vitalidade'})[item.stat]+' · '+(equipped?'Equipado':'Na mochila'):item.category==='furniture'?'Decoração instalável, persistente e recolhível pelo proprietário.':selectedItem==='medicine'?'Recupera 40% de vida. Intervalo compartilhado de 20 segundos.':selectedItem==='battery'?'Recupera 50 ki. Intervalo compartilhado de 20 segundos.':C.structures[selectedItem]?'Cápsula de construção: instale no terreno à sua frente.':'Material de fabricação. Pode ser negociado no mercado.'));
    if(equipped)detail.append(button('Guardar equipamento',()=>send({action:'unwear',slot:item.slot})));else if(item.slot&&s.inventory[selectedItem])detail.append(button('Equipar',()=>send({action:'wear',item:selectedItem})));
    if(['medicine','battery'].includes(selectedItem)&&s.inventory[selectedItem])detail.append(button('Usar',()=>send({action:'use',item:selectedItem})));
    if(C.structures[selectedItem]&&s.inventory[selectedItem])detail.append(button('Instalar no mundo',()=>{send({action:'build',kind:selectedItem});dialog.close();}));body.append(detail);}
  }
  function render() {
    if (!state) return;
    dialog.dataset.presentation = tab;
    h.textContent = tabs[tab];
    requestAnimationFrame(() => window.UZProduction?.decorate(dialog));
    lastRender = performance.now();
    body.replaceChildren();
    const p = state.self,
      s = p.sandbox,
      w = state.sandbox;
    nav
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.tab === tab)),
      );
    const total = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    const summary = el(
      "div",
      `${C.paths[s.path].name} · ${p.zenni} zenni · Mochila ${total}/${C.capacity} · Reputação ${s.reputation}`,
      "sandbox-summary",
    );
    body.append(summary);
    if (tab === "inventory") inventoryView(p,s);
    if (tab === "explore") {
      const intro = section(
        "A aventura também acontece fora das lutas",
        "Colete → fabrique → instale sua oficina → descubra regiões → negocie e reconstrua planetas. N abre a ação próxima; B abre este painel. Atividades têm duração e são canceladas por movimento ou combate.",
      );
      const n = nearest();
      if (n)
        row(
          intro,
          n.name,
          Math.round(near(n)) +
            " m · " +
            (n.type === "resource"
              ? "Recurso compartilhado; regenera após a coleta."
              : "Construção de " + n.ownerName),
          n.kind,
          [
            button("Rastrear", () => {
              tracked = n.id;
              dialog.close();
            }),
            button("Interagir", () =>
              send({
                action: n.type === "resource" ? "gather" : "structure",
                target: n.id,
              }),
            ),
          ],
        );
      const objects = section("Ao seu redor");
      for (const o of w.objects
        .filter((o) => o.ready)
        .sort((a, b) => near(a) - near(b))
        .slice(0, 9))
        row(objects, o.name, Math.round(near(o)) + " m", o.kind, [
          button("Rastrear", () => {
            tracked = o.id;
            dialog.close();
          }),
        ]);
      const bag = section("Sua mochila");
      for (const [key, n] of Object.entries(s.inventory).filter(
        ([, n]) => n > 0,
      ))
        row(
          bag,
          C.items[key].name,
          n + " unidades",
          key,
          ["medicine", "battery"].includes(key)
            ? [button("Usar", () => send({ action: "use", item: key }))]
            : [],
        );
      if (!total)
        bag.append(
          el(
            "p",
            "Comece coletando recursos próximos. Não há equipamento obrigatório para a primeira coleta.",
          ),
        );
    }
    if (tab === "craft") {
      const sec = section(
        "Oficina de cápsulas",
        `Ofício nível ${C.level(s.practice.craft)} · ${s.practice.craft} prática. Receitas básicas podem ser feitas em qualquer lugar; avançadas exigem oficina próxima.`,
      );
      const filters=el('div',undefined,'craft-filters');for(const [id,label]of Object.entries({basic:'Essenciais',equipment:'Equipamentos',furniture:'Mobiliário'})){const b=button(label,()=>{craftCategory=id;craftPage=0;render();});b.setAttribute('aria-pressed',String(craftCategory===id));filters.append(b);}sec.append(filters);
      const recipes=C.recipes.filter(r=>(C.items[r.id].category||'basic')===craftCategory),pages=Math.ceil(recipes.length/28);if(craftPage>=pages)craftPage=0;
      const grid=el('div',undefined,'recipe-grid');for(const r of recipes.slice(craftPage*28,(craftPage+1)*28)){
        const card=el('article',undefined,'recipe-card sandbox-row');const b=button('Fabricar · 4s',()=>send({action:'craft',recipe:r.id}));b.disabled=Object.entries(r.cost).some(([k,n])=>(s.inventory[k]||0)<n)||C.level(s.practice.craft)<r.skill;
        card.append(art(r.id),el('strong',C.items[r.id].name),el('p',costs(r.cost)+(r.station?' · Oficina':'')+' · Ofício '+r.skill),b);grid.append(card);
      }sec.append(grid);if(pages>1){const pager=el('div',undefined,'craft-filters');const prev=button('← Anterior',()=>{craftPage--;render();}),next=button('Próxima →',()=>{craftPage++;render();});prev.disabled=craftPage===0;next.disabled=craftPage===pages-1;pager.append(prev,el('span',(craftPage+1)+' / '+pages),next);sec.append(pager);}
    }

    if (tab === "build") {
      const sec = section(
        "Sua marca no universo",
        "Instalação a 105 m à sua frente, alinhada à grade. Até 8 estruturas por personagem. Todas podem ser usadas por outros jogadores; somente o dono pode recolher.",
      );
      const descriptions = {
        camp: "Recupera 30% de vida e 30 ki. Melhorias do planeta aumentam o descanso.",
        workbench:
          "Permite fabricar viveiros, câmaras gravitacionais e faróis.",
        gravity: "Consome 25 ki e treina o atributo escolhido. Recarga de 30s.",
        garden: "Produz 5 ervas a cada 90s após a colheita.",
        beacon: "Descobre a região e restaura 40 ki; recarga de 60s.",
      };
      for (const [k, v] of Object.entries(C.structures).filter(([k,v])=>!v.decor||s.inventory[k])) {
        const b = button("Instalar · 5s", () =>
          send({ action: "build", kind: k }),
        );
        b.disabled = !s.inventory[k];
        row(sec, v.name, (descriptions[k] || "Peça decorativa para o seu assentamento.") + " Cápsulas: " + (s.inventory[k]||0), k, [
          b,
        ]);
      }
      const placed = section("Suas construções");
      for (const b of w.structures)
        row(
          placed,
          C.structures[b.kind].name,
          `${UZ.getWorld(b.world).name} · ${b.x}, ${b.y}`,
          b.kind,
          [
            button("Rastrear", () => {
              if (b.world !== p.world) {
                status.textContent =
                  "Viaje pelo Atlas até " + UZ.getWorld(b.world).name;
                return;
              }
              tracked = b.id;
              dialog.close();
            }),
            button("Recolher", () => send({ action: "pack", target: b.id })),
          ],
        );
    }
    if (tab === "practice") {
      const sec = section(
        "Um caminho, muitas possibilidades",
        "Você pode mudar de vocação fora de combate. A prática é permanente. Cada nível de concentração conquistado melhora o atributo escolhido; não há ganho retroativo ao trocar o foco.",
      );
      for (const [k, v] of Object.entries(C.paths)) {
        const b = button(s.path === k ? "Seu caminho" : "Escolher", () =>
          send({ action: "path", path: k }),
        );
        b.disabled = s.path === k;
        row(
          sec,
          v.name,
          v.text,
          k === "explorer"
            ? "beacon"
            : k === "artisan"
              ? "workbench"
              : "medicine",
          [b],
        );
      }
      const focus = section(
        "Treino consciente",
        `Concentração ${C.level(s.practice.focus)}/20 · Coleta ${C.level(s.practice.gather)}/20 · Ofício ${C.level(s.practice.craft)}/20`,
      );
      for (const [k, label] of [
        ["force", "Força"],
        ["spirit", "Espírito"],
        ["vitality", "Vitalidade"],
      ]) {
        const b = button(
          s.focus === k ? "Foco ativo" : "Treinar este atributo",
          () => send({ action: "focus", focus: k }),
        );
        b.disabled = s.focus === k;
        row(
          focus,
          label,
          "A concentração concede +1 neste atributo ao subir de nível.",
          "gravity",
          [b],
        );
      }
      focus.append(
        button("Meditar · 6s", () => {
          send({ action: "meditate" });
          dialog.close();
        }),
        button("Cartografar · 5s", () => {
          send({ action: "survey" });
          dialog.close();
        }),
      );
    }
    if (tab === "contracts") {
      const sec = section(
        "Contratos do assentamento",
        "Entregas perto do mestre local. Cada contrato tem recarga individual de 5 minutos.",
      );
      for (const c of C.contracts) {
        const remaining = Math.max(
          0,
          Math.ceil(((s.contracts[c.id] || 0) - w.now) / 1000),
        );
        const b = button(
          remaining ? remaining + "s para renovar" : "Entregar",
          () => send({ action: "contract", contract: c.id }),
        );
        b.disabled = remaining > 0;
        row(
          sec,
          c.name,
          costs(c.cost) + ` → ${c.zenni + Math.ceil(c.xp / 2)} zenni · ${c.xp} XP · 5 reputação`,
          "camp",
          [b],
        );
      }
      const project = section(
        "Reconstrução de " + UZ.getWorld(p.world).name,
        `Infraestrutura ${w.project.level}/4 · contribuições ${w.project.progress}/5. Cada nível acrescenta 5% de cura aos abrigos deste planeta para todos os jogadores.`,
      );
      project.append(
        button("Contribuir · 2 ligas + 3 cristais", () =>
          send({ action: "project" }),
        ),
      );
    }
    if (tab === "market") {
      const sec = section(
        "Mercado planetário",
        "O preço é pelo lote completo. Os itens ficam reservados; a primeira compra válida conclui a oferta. Vendas de jogadores desconectados ficam disponíveis e o pagamento espera por eles.",
      );
      const form = el("form", undefined, "market-form"),
        select = el("select");
      select.setAttribute("aria-label", "Item para vender");
      for (const [k, n] of Object.entries(s.inventory).filter(
        ([, n]) => n > 0,
      )) {
        const op = el("option", C.items[k].name + " (" + n + ")");
        op.value = k;
        select.append(op);
      }
      const qty = el("input");
      qty.type = "number";
      qty.min = 1;
      qty.max = 30;
      qty.value = 1;
      qty.setAttribute("aria-label", "Quantidade do lote");
      const price = el("input");
      price.type = "number";
      price.min = 1;
      price.max = 10000;
      price.value = 10;
      price.setAttribute("aria-label", "Preço total em zenni");
      const submit = el("button", "Publicar oferta", "sandbox-button");
      submit.type = "submit";
      submit.disabled = !select.options.length;
      form.append(select, qty, price, submit);
      form.onsubmit = (e) => {
        e.preventDefault();
        send({
          action: "sell",
          item: select.value,
          qty: Number(qty.value),
          price: Number(price.value),
        });
      };
      sec.append(
        form,
        button("Receber vendas · " + w.credits + " zenni", () =>
          send({ action: "collectSales" }),
        ),
      );
      for (const o of w.market)
        row(
          sec,
          C.items[o.item].name,
          `${o.qty} unidades · ${o.price} zenni · ${o.seller}`,
          o.item,
          [
            button(o.owned ? "Cancelar oferta" : "Comprar lote", () =>
              send({ action: o.owned ? "cancelSale" : "buy", target: o.id }),
            ),
          ],
        );
      if (!w.market.length)
        sec.append(
          el(
            "p",
            "Nenhuma oferta neste planeta. Você pode inaugurar o mercado.",
          ),
        );
    }
    if (tab === "legacy") {
      const sec = section(
        "Pioneiro do Universo",
        "Um objetivo de longo prazo que une exploração, ofício e colaboração. Conquista única: 3 pontos de atributo e 300 zenni. Depois, continue reconstruindo outros planetas e criando infraestrutura para novos jogadores.",
      );
      for (const [text, done] of [
        [
          s.discoveries.length + "/8 regiões descobertas",
          s.discoveries.length >= 8,
        ],
        [s.reputation + "/50 reputação", s.reputation >= 50],
        [
          "Ofício " + C.level(s.practice.craft) + "/2",
          C.level(s.practice.craft) >= 2,
        ],
        ["Um farol instalado", w.structures.some((b) => b.kind === "beacon")],
      ])
        sec.append(el("p", (done ? "✓ " : "○ ") + text, "legacy-check"));
      const b = button(
        s.legacy ? "Legado conquistado" : "Reivindicar legado",
        () => send({ action: "legacy" }),
      );
      b.disabled = !!s.legacy;
      sec.append(b);
      const journal = section("Memórias da sua jornada");
      for (const msg of [...s.journal].reverse()) journal.append(el("p", msg));
    }
  }
  window.UZSandboxUI = {
    open,
    connect(s) {
      socket = s;
    },
    update(next) {
      state = next;
      if (!next.self.sandbox) return;
      launcher.hidden = false;
      const note = next.self.sandbox.journal.at(-1);
      if (note && note !== lastJournal) { status.textContent = note; refresh = true; }
      lastJournal = note;
      const job = next.self.sandboxJob;
      progress.hidden = !job;
      if (job) {
        progressText.textContent =
          "Em atividade · " + Math.round(job.progress * 100) + "%";
        fill.style.width = job.progress * 100 + "%";
      }
      const n = nearest();
      context.hidden =
        !!job ||
        !n ||
        near(n) > (n.type === "resource" ? 130 : 180) ||
        !!next.self.targetId ||
        next.self.world === "space";
      if (!context.hidden)
        context.textContent =
          (n.type === "resource"
            ? "Coletar "
            : C.structures[n.kind].action + " · ") +
          n.name +
          " · N";
      if (dialog.open && tab === "inventory") {
        const inventorySignature = JSON.stringify([
          next.self.sandbox.inventory,
          next.self.sandbox.equipment,
          next.self.zenni,
        ]);
        if (inventorySignature !== lastInventorySignature) refresh = true;
        lastInventorySignature = inventorySignature;
      }
      if (
        dialog.open &&
        (refresh || (tab !== "inventory" && performance.now() - lastRender > 1500)) &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) &&
        !pending
      ) { refresh = false; render(); }
    },
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
    )
      return;
    if (e.code === "KeyB") {
      e.preventDefault();
      dialog.open ? dialog.close() : open();
    }
    if (
      e.code === "KeyN" &&
      !window.UZWindows.blocksPlay() &&
      !document.querySelector(".cinematic:not([hidden])")
    ) {
      e.preventDefault();
      contextAction();
    }
  });
  // Scene objects belong below the actor pass; only interaction labels are
  // drawn afterwards. A built roof must not paint over a fighter above it.
  function drawSandboxObjects(c, snapshot, t, geometry) {
    const z = this.zoom;
    for (const o of snapshot.sandbox.objects) {
      if (
        Math.abs(o.x - this.cam.x) > innerWidth / z / 2 + 100 ||
        Math.abs(o.y - this.cam.y) > innerHeight / z / 2 + 100
      )
        continue;
      c.save();
      c.translate(o.x, o.y);
      if (geometry) {
      c.globalAlpha = o.ready ? 1 : 0.35;
      c.fillStyle = "#00142166";
      c.beginPath();
      c.ellipse(0, 8, 23, 12, 0, 0, Math.PI * 2);
      c.fill();
      if (window.UZWorldKit?.object(c,o,t,this.reduced)) {
        // Illustrated object drawn from the production atlas.
      } else if (o.type === "resource") {
        const colors = { ore: "#d4b692", crystal: "#7eeaf7", herb: "#8ceeac" };
        c.fillStyle = colors[o.kind];
        c.strokeStyle = "#e8ffffa0";
        c.lineWidth = 2;
        c.beginPath();
        if (o.kind === "herb") {
          for (let i = 0; i < 5; i++) {
            c.moveTo(0, 0);
            c.quadraticCurveTo(-22 + i * 9, -38, 5, -8);
          }
        } else {
          c.moveTo(-15, 4);
          c.lineTo(-9, -19);
          c.lineTo(4, -30);
          c.lineTo(17, -9);
          c.lineTo(12, 7);
          c.closePath();
        }
        c.fill();
        c.stroke();
      } else {
        c.strokeStyle = "#8ee6f3";
        c.fillStyle = "#122c45";
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(-34, -37, 68, 48, 12);
        c.fill();
        c.stroke();
        c.fillStyle = "#f9d58b";
        c.font = "bold 20px system-ui";
        c.textAlign = "center";
        c.fillText(
          {
            camp: "⌂",
            workbench: "⚒",
            gravity: "10×",
            garden: "✿",
            beacon: "◎",
          }[o.kind],
          0,
          -8,
        );
        c.strokeStyle = "#82e7ee66";
        c.beginPath();
        c.ellipse(0, 11, 42, 16, 0, 0, Math.PI * 2);
        c.stroke();
      }
      }
      if (!geometry && (near(o) < 210 || o.id === tracked)) {
        c.globalAlpha = 1;
        c.font = "600 12px system-ui";
        c.textAlign = "center";
        c.fillStyle = "#071525e8";
        c.fillRect(-85, -63, 170, 21);
        c.fillStyle = "#e4f8ee";
        c.fillText(o.name, 0, -48);
      }
      if (!geometry && o.id === tracked) {
        c.strokeStyle = "#ffdb8d";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(
          0,
          0,
          38 + (this.reduced ? 0 : Math.sin(t * 3) * 3),
          0,
          Math.PI * 2,
        );
        c.stroke();
      }
      c.restore();
    }
  }
  Art.sandboxTerrain = function(c, renderer, snapshot, t) {
    if (!snapshot?.sandbox || snapshot.self.world === "space" || snapshot.self.altitude > .1) return;
    drawSandboxObjects.call(renderer, c, snapshot, t, true);
    const frame = renderer.foreground;
    if (!frame) return;
    const physical = snapshot.self.physicsColliders || [];
    for (const object of snapshot.sandbox.objects) {
      if (object.type === "resource") continue;
      if(Math.abs(object.x-renderer.cam.x)>innerWidth/renderer.zoom/2+170||Math.abs(object.y-renderer.cam.y)>innerHeight/renderer.zoom/2+170)continue;
      const sprite=C.items[object.kind]?.sprite;
      const metadata=sprite?.sheet==='furniture'?{sheet:sprite.sheet,sprite:sprite.index}:{};
      const row=Math.floor((metadata.sprite??0)/14);
      const size=row===10||['camp','gravity'].includes(object.kind)?145:110;
      const body = physical.find(b => b.id === object.id || b.sourceId === object.id)
        || UZCollisionWorld.colliderFor({...object,...metadata,size},snapshot.self.world);
      if (!body || body.solid === false || body.height < 16) continue;
      frame.objects.push({object:{...object,kind:"sandboxObject"}, body});
    }
    frame.objects.sort((a,b)=>a.body.y+a.body.ry-b.body.y-b.body.ry);
  };
  // Draw interaction markers in world coordinates with the battle camera.
  const draw = Art.Renderer.prototype.draw;
  Art.Renderer.prototype.draw = function (snapshot, input, t) {
    draw.call(this, snapshot, input, t);
    if (!snapshot?.sandbox || snapshot.self.world === "space" || snapshot.self.altitude > .1) return;
    const c = this.c, z = this.zoom, dpr = Math.min(devicePixelRatio || 1, 2);
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(innerWidth / 2, innerHeight / 2);
    c.scale(z, z);
    c.translate(-this.cam.x, -this.cam.y);
    drawSandboxObjects.call(this, c, snapshot, t, false);
    const job = snapshot.self.sandboxJob;
    if (job) {
      c.strokeStyle = "#ffdb8d";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(
        snapshot.self.x,
        snapshot.self.y,
        45,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * job.progress,
      );
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const angle = (this.reduced ? 0 : t * 2) + i * 2.1;
        c.fillStyle = "#c4faff";
        c.beginPath();
        c.arc(
          snapshot.self.x + Math.cos(angle) * 40,
          snapshot.self.y + Math.sin(angle) * 25,
          3,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    c.restore();
  };
})();
