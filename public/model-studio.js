(() => {
  let state = "run",
    paused = false,
    last = 0,
    time = 0;
  const models = document.getElementById("models"),
    cards = [];
  for (const [id, title] of [
    ["idle", "Repouso"],
    ["run", "Caminhada"],
    ["fly", "Voo"],
    ["glide", "Planar"],
    ["boost", "Voo acelerado"],
    ["dash", "Esquiva"],
    ["attack", "Combo"],
    ["jab", "Soco direto"],
    ["hook", "Cruzado"],
    ["kick", "Chute"],
    ["rush", "Investida"],
    ["guard", "Defesa"],
    ["charge", "Carregar ki"],
    ["chargeAim", "Concentrar técnica"],
    ["blast", "Disparo"],
    ["stun", "Impacto"],
  ]) {
    const b = document.createElement("button");
    b.textContent = title;
    b.classList.toggle("active", id === state);
    b.onclick = () => {
      state = id;
      document
        .querySelectorAll("#states button")
        .forEach((x) => x.classList.toggle("active", x === b));
    };
    document.getElementById("states").append(b);
  }
  for (const ch of UZ.CHARACTERS) {
    const article = document.createElement("article"),
      canvas = document.createElement("canvas"),
      copy = document.createElement("div"),
      title = document.createElement("h2"),
      kind = document.createElement("small");
    canvas.setAttribute("aria-label", ch.name + " · modelo animado");
    title.textContent = ch.name;
    kind.textContent = ch.kind;
    copy.append(title, kind);
    article.append(canvas, copy);
    models.append(article);
    cards.push({ ch, article, canvas });
  }
  const search = document.getElementById("search");
  search.oninput = () => {
    const q = search.value.toLocaleLowerCase("pt-BR");
    for (const { ch, article } of cards)
      article.hidden = !ch.name.toLocaleLowerCase("pt-BR").includes(q);
    document.getElementById("count").textContent =
      cards.filter((c) => !c.article.hidden).length +
      " modelos · 16 ações · variações aéreas e terrestres";
  };
  search.oninput();
  document.getElementById("pause").onclick = (e) => {
    paused = !paused;
    e.target.textContent = paused ? "Retomar animação" : "Pausar animação";
  };
  const visible = new Set(),
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      },
      { rootMargin: "80px" },
    );
  cards.forEach((c) => observer.observe(c.article));
  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!paused) time += dt;
    const angle = Number(document.getElementById("angle").value),
      actual = document.getElementById("actual").checked,
      dpr = Math.min(devicePixelRatio || 1, 2);
    for (const { ch, article, canvas } of cards) {
      if (article.hidden || !visible.has(article)) continue;
      const box = canvas.getBoundingClientRect();
      if (
        canvas.width !== Math.round(box.width * dpr) ||
        canvas.height !== Math.round(box.height * dpr)
      ) {
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
      }
      const c = canvas.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, box.width, box.height);
      Art.fighter(
        c,
        {
          x: box.width / 2,
          y: box.height / 2,
          skin: ch.skin,
          mode: ['fly','glide','boost'].includes(state) ? 'flight' : document.getElementById('mode').value,
          form: ch.form,
          angle,
          state: state === "boost" ? "fly" : ['jab','hook','kick'].includes(state) ? 'attack' : state,
          boosting: state === "boost",
          combo: state==='jab'?1:state==='hook'?2:state==='kick'?3:1+(Math.floor(time*2.8)%3),
          chargeRatio: (Math.sin(time * 1.4) + 1) / 2,
          equipped: "kame",
        },
        time,
        actual ? 0.72 : 2.4,
      );
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
