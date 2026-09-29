(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./content"), require("./expansion"), require("./lore"), require("./character-designs"), require("./navigation"));
  else root.UZLivingNpcs = factory(root.UZ, root.UZExpansion, root.UZLore, root.UZDesigns, root.UZNav);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Content, Expansion, Lore, Designs, Nav) {
  "use strict";

  // A full day takes two real hours. Every location is derived on demand from
  // the clock and a small itinerary; there are no persistent NPC movement ticks.
  const DAY_SECONDS = 7200;
  const sites = Object.fromEntries([
    ...Expansion.landmarks.map(({ id, world, x, y, name }) => [id, { id, world, x, y, name }]),
    ...Lore.sites.map(({ id, world, x, y, name }) => [id, { id, world, x, y, name }]),
    ...[
      ["paozu-home", "earth", 5400, -4400, "Casa de Goku"],
      ["west-market", "earth", 11000, 3850, "Mercado da Cidade do Oeste"],
      ["west-homes", "earth", 11600, 4200, "Bairro residencial da Cidade do Oeste"],
      ["west-training", "earth", 10800, 2950, "Centro de treinamento da Cidade do Oeste"],
      ["east-city", "earth", 8000, 5000, "Cidade do Leste"],
      ["south-city", "earth", 7300, 9300, "Cidade do Sul"],
      ["tournament", "earth", 6000, 10300, "Torneio de Artes Marciais"],
      ["kame-beach", "earth", 3450, 4550, "Praia da Kame House"],
      ["red-ribbon", "earth", 7100, -9400, "Base Red Ribbon"],
      ["namek-lake", "namek", 5400, 4400, "Lago de Namekusei"],
      ["namek-front", "namek", -9500, 3200, "Frente de batalha de Namekusei"],
      ["vegeta-home", "vegeta", 7800, 3150, "Residência saiyajin"],
      ["future-refuge", "future", 6850, 3550, "Refúgio da resistência"],
      ["otherworld-gate", "otherworld", 2450, 1740, "Tribunal do Rei Enma"],
      ["snake-way", "otherworld", 4900, 1740, "Caminho da Serpente"],
      ["vampa-shelter", "vampa", 5100, 6400, "Abrigo de Vampa"],
      ["sadala-city", "sadala", 6200, 3300, "Capital de Sadala"],
      ["sadala-arena", "sadala", 6800, 3900, "Campo de treino de Sadala"],
      ["champa-palace", "champa", 5300, 3900, "Palácio de Champa"],
      ["cereal-town", "cereal", 9000, -3600, "Assentamento de Cereal"],
      ["frieza-command", "frieza", 7300, 3300, "Quartel de Freeza 79"],
      ["frieza-port", "frieza", 8150, 3900, "Porto de Freeza 79"],
      ["future-ruins", "future", 7600, 3900, "Ruínas da Cidade do Oeste"],
      ["demon-market", "demon", 7100, -2950, "Mercado Demoníaco"],
      ["sacred-garden", "sacred", 5900, 3800, "Jardins sagrados"],
      ["zeno-court", "zeno", 6300, 3600, "Corte de Zeno"],
      ["konatsu-town", "konatsu", 5000, 4000, "Cidade de Konats"],
      ["kanassa-coast", "kanassa", 5200, 3600, "Costa de Kanassa"],
      ["tsufuru-ruins", "tsufuru", 5200, 3600, "Ruínas tsufurujin"],
      ["arena-floor", "arena", 6500, 3000, "Arena do Torneio"],
    ].map(([id, world, x, y, name]) => [id, { id, world, x, y, name }]),
  ]);

  const known = Object.fromEntries(Content.CHARACTERS.map(character => [character.id, character]));
  const personalities = {
    goku: ["Protetor curioso", "Treinar com alegria abre novos caminhos."],
    krillin: ["Aliado leal", "Prefiro chegar com amigos. Sozinho, Namekusei fica maior."],
    vegeta: ["Rival orgulhoso", "Me mostre disciplina antes de pedir um combate."],
    piccolo: ["Mentor vigilante", "Observe o terreno. O poder vem depois do controle."],
    bulma: ["Inventora prática", "Uma viagem começa com um plano e uma nave confiável."],
    roshi: ["Mestre paciente", "Leve água, comida e persistência para o treino."],
    gohan: ["Estudioso e defensor", "Treinar também é aprender quando proteger alguém."],
    dende: ["Curandeiro prudente", "As aldeias dependem de quem conhece o caminho."],
    kingkai: ["Instrutor bem-humorado", "A gravidade ensina a respeitar cada passo."],
    broly: ["Guerreiro reservado", "A calma ajuda a força a encontrar direção."],
    whis: ["Instrutor preciso", "Antecipe o movimento antes de usar o ki."],
    beerus: ["Deus exigente", "Se interromper meu descanso, tenha comida interessante."],
    granolah: ["Vigilante atento", "Cada trilha de Cereal guarda uma lembrança."],
    pan: ["Aventureira inquieta", "Vamos ver o que existe depois daquela montanha!"],
    arale: ["Exploradora brincalhona", "A Vila Pinguim sempre tem alguma surpresa."],
    tapion: ["Guardião cauteloso", "Alguns perigos pedem silêncio e preparação."],
    enma: ["Juiz do Outro Mundo", "A fila do Outro Mundo segue regras. Diga por que chegou."],
    goten: ["Aprendiz animado", "Meu irmão diz para estudar; depois a gente pode treinar."],
    chichi: ["Protetora da família", "Volte para casa com segurança antes de pensar em outra aventura."],
    videl: ["Heroína observadora", "A cidade precisa de quem age antes da multidão perceber o perigo."],
    trunks: ["Inventor corajoso", "Uma cápsula pode abrir uma rota, mas só você decide como usá-la."],
    yamcha: ["Veterano competitivo", "Treine a distância e não entre em pânico diante de um rival forte."],
    tien: ["Instrutor disciplinado", "Repita o fundamento até conseguir usá-lo sob pressão."],
    chiaotzu: ["Companheiro atento", "Tenshinhan sempre sabe quando preciso de ajuda."],
    yajirobe: ["Sobrevivente pragmático", "Uma refeição e uma boa saída salvam mais do que bravata."],
    android17: ["Guarda da natureza", "Os animais desta região também merecem proteção."],
    android18: ["Lutadora direta", "Faça valer seu tempo. Não lute só para impressionar."],
    android16: ["Pacifista poderoso", "Ouça os pássaros. Eles percebem a ameaça antes de nós."],
    korin: ["Mestre perspicaz", "Subir a torre ensina paciência antes de qualquer técnica."],
    popo: ["Guardião sereno", "O templo testa quem se apressa sem olhar ao redor."],
    oolong: ["Comerciante astuto", "Tenho notícias da estrada, se trouxer algo para negociar."],
    puar: ["Amigo prestativo", "Yamcha fica melhor quando lembra dos amigos."],
    pilaf: ["Conspirador ambicioso", "Hoje minha estratégia vai funcionar. Provavelmente."],
    oxking: ["Pai generoso", "A casa sempre tem lugar para quem chega com respeito."],
    launch: ["Viajante imprevisível", "Não conte comigo para seguir o mesmo caminho duas vezes."],
    generalBlue: ["Oficial implacável", "A Red Ribbon controla estas rotas. Identifique-se."],
    commanderRed: ["Comandante calculista", "Toda operação depende de informação e obediência."],
    tao: ["Mercenário frio", "Um contrato só termina quando o alvo deixa de ser problema."],
    uub: ["Aprendiz humilde", "Ainda tenho muito para aprender antes de proteger minha aldeia."],
    nail: ["Sentinela namekuseijin", "O Patriarca permanece seguro enquanto eu guardar a entrada."],
    bardock: ["Guerreiro desconfiado", "Um presságio vale atenção quando todos preferem ignorá-lo."],
    raditz: ["Invasor arrogante", "Não confunda minha paciência com fraqueza."],
    nappa: ["Soldado impetuoso", "A melhor estratégia costuma ser acabar logo com a resistência."],
    shugesh: ["Companheiro de esquadrão", "Bardock segue o instinto. Eu vigio o flanco."],
    futuregohan: ["Resistente persistente", "Proteja os refugiados. O futuro ainda pode mudar."],
    android19: ["Caçador mecânico", "A energia em movimento deixa um rastro mensurável."],
    android20: ["Cientista obsessivo", "Cada confronto produz dados para a próxima máquina."],
    cell: ["Predador presunçoso", "Um adversário interessante merece uma arena apropriada."],
    pikkon: ["Guerreiro justo", "Até no Outro Mundo um combate precisa de disciplina."],
    yardrat: ["Mestre espiritual", "Sinta a presença antes de tentar alcançar o destino."],
    paragus: ["Pai cauteloso", "Vampa ensina a desconfiar de qualquer promessa fácil."],
    cabba: ["Soldado cortês", "Sadala precisa de patrulhas que escutem a população."],
    caulifla: ["Desafiante ousada", "Mostre uma técnica nova e talvez eu queira aprender."],
    kale: ["Aliada sensível", "Luto melhor quando confio em quem está ao meu lado."],
    champa: ["Deus competitivo", "O Universo 6 vai provar seu valor na próxima disputa."],
    vados: ["Mentora elegante", "Precisão exige silêncio até o instante de agir."],
    hit: ["Profissional reservado", "Uma missão começa com informação, nunca com ruído."],
    botamo: ["Lutador resistente", "Pode golpear quanto quiser. Eu ainda estarei aqui."],
    magetta: ["Guerreiro blindado", "Minha fornalha aguenta mais do que seus comentários."],
    frost: ["Diplomata ambíguo", "Uma aparência amigável abre portas em todos os planetas."],
    monaito: ["Ancião cuidadoso", "Granolah precisa de uma vida além da vingança."],
    gas: ["Executor leal", "A família Heeter não abandona seus acordos."],
    elec: ["Negociador ambicioso", "As melhores rotas pertencem a quem controla a informação."],
    maki: ["Agente persuasiva", "Pergunte o preço antes de aceitar ajuda demais."],
    oil: ["Segurança Heeter", "Esta carga só passa quando Elec autorizar."],
    glorio: ["Guia enigmático", "No Reino Demoníaco, uma rota segura muda depressa."],
    panzy: ["Inventora inquieta", "Traga peças e eu descubro o que podemos consertar."],
    gomah: ["Regente inseguro", "Todos obedecerão quando enxergarem meu verdadeiro poder."],
    degésu: ["Funcionário calculista", "Nenhuma ordem atravessa o portão sem registro."],
    neva: ["Ancião reservado", "O passado do Reino Demoníaco permanece nas pedras."],
    arinsu: ["Cientista estratégica", "Prefiro uma experiência controlada a uma promessa heroica."],
    dabura: ["Rei ameaçador", "Meu reino não responde a guerreiros de passagem."],
    babidi: ["Manipulador cauteloso", "Toda fraqueza pode se tornar uma porta."],
    frieza: ["Imperador cruel", "Cada planeta útil deve saber a quem serve."],
    ginyu: ["Capitão teatral", "Formação, disciplina e pose: assim começa a vitória."],
    zarbon: ["Diplomata imperial", "A elegância não torna uma ordem menos séria."],
    dodoria: ["Executor brutal", "Ouça a ordem ou saia do caminho."],
    recoome: ["Lutador exibido", "Uma boa entrada merece uma luta ainda melhor!"],
    jeice: ["Parceiro veloz", "Burter cobre o céu enquanto eu pressiono no chão."],
    burter: ["Corredor confiante", "Tente me acompanhar antes de me desafiar."],
    guldo: ["Tático nervoso", "Um instante de vantagem muda qualquer combate."],
    kingcold: ["Soberano altivo", "Os negócios da família abrangem muitos mundos."],
    cooler: ["Comandante severo", "Eficiência importa mais que espetáculo."],
    baby: ["Usurpador obstinado", "Tsufuru ainda se recorda do que lhe foi tomado."],
    rildo: ["General mecânico", "A estrutura resiste; a vontade é que cede."],
    kanassan: ["Oráculo cauteloso", "Vejo uma sombra no céu. Prepare as aldeias."],
    kaioshin: ["Guardião cósmico", "Intervir exige compreender as consequências."],
    kibito: ["Protetor fiel", "A segurança do Kaioshin vem antes de qualquer disputa."],
    zamasu: ["Juiz radical", "O mundo mortal insiste em repetir os mesmos erros."],
    jiren: ["Guerreiro austero", "Confiança se conquista com feitos, não palavras."],
    toppo: ["Defensor da justiça", "A Patrulha do Orgulho responde a quem precisa de ajuda."],
    dyspo: ["Batedor veloz", "Quando notar meu movimento, já estarei em outro lugar."],
    kefla: ["Rival ousada", "Uma arena pequena ainda pode receber uma grande luta."],
  };

  // Each row names a real catalogue identity, its home and daily destinations.
  // Special saga visitors are a sandbox adaptation: several eras coexist in one world.
  const rows = [
    ["goku", "paozu-home", "kame", "namek-tsuno", "paozu-home", "guardian", "allies"],
    ["gohan", "paozu-home", "lookout", "west-market", "paozu-home", "guardian", "allies"],
    ["goten", "paozu-home", "west-training", "tournament", "paozu-home", "guardian", "allies"],
    ["pan", "paozu-home", "west-training", "tournament", "west-homes", "explorer", "allies"],
    ["krillin", "west-homes", "kame", "namek-tsuno", "west-market", "guardian", "allies"],
    ["roshi", "kame", "kame-beach", "tournament", "kame", "mentor", "allies"],
    ["bulma", "capsule-corp", "capsule-corp", "west-market", "west-homes", "artisan", "allies"],
    ["chichi", "paozu-home", "paozu-home", "west-market", "paozu-home", "civilian", "allies"],
    ["videl", "west-homes", "west-training", "tournament", "west-market", "guardian", "allies"],
    ["trunks", "capsule-corp", "west-training", "future-lab", "west-homes", "guardian", "allies"],
    ["yamcha", "west-homes", "west-training", "tournament", "west-market", "guardian", "allies"],
    ["tien", "south-city", "tournament", "west-training", "south-city", "mentor", "allies"],
    ["chiaotzu", "south-city", "tournament", "west-training", "south-city", "guardian", "allies"],
    ["yajirobe", "karin", "karin", "west-market", "karin", "civilian", "allies"],
    ["android17", "east-city", "east-city", "tournament", "east-city", "guardian", "allies"],
    ["android18", "west-homes", "west-training", "tournament", "west-market", "guardian", "allies"],
    ["android16", "east-city", "east-city", "west-market", "east-city", "guardian", "allies"],
    ["korin", "karin", "karin", "lookout", "karin", "mentor", "allies"],
    ["popo", "lookout", "lookout", "karin", "lookout", "mentor", "allies"],
    ["arale", "penguin-village", "penguin-village", "east-city", "penguin-village", "explorer", "allies"],
    ["oolong", "west-homes", "west-market", "penguin-village", "west-market", "civilian", "allies"],
    ["puar", "west-homes", "west-market", "tournament", "west-market", "civilian", "allies"],
    ["pilaf", "east-city", "east-city", "red-ribbon", "east-city", "villain", "pilaf"],
    ["oxking", "paozu-home", "paozu-home", "tournament", "paozu-home", "civilian", "allies"],
    ["launch", "west-homes", "west-market", "tournament", "west-market", "explorer", "allies"],
    ["generalBlue", "red-ribbon", "muscle-tower", "east-city", "red-ribbon", "villain", "red-ribbon"],
    ["commanderRed", "red-ribbon", "red-ribbon", "muscle-tower", "red-ribbon", "villain", "red-ribbon"],
    ["tao", "east-city", "tournament", "red-ribbon", "east-city", "villain", "mercenary"],
    ["uub", "south-city", "tournament", "west-training", "south-city", "guardian", "allies"],
    ["piccolo", "lookout", "lookout", "namek-tsuno", "namek-lake", "mentor", "allies"],
    ["dende", "namek-moori", "namek-moori", "namek-elder", "namek-tsuno", "healer", "namekian"],
    ["nail", "namek-elder", "namek-elder", "namek-moori", "namek-elder", "guardian", "namekian"],
    ["vegeta", "capsule-corp", "west-training", "vegeta-garrison", "west-homes", "guardian", "allies"],
    ["bardock", "vegeta-home", "vegeta-garrison", "kanassa-coast", "vegeta-home", "guardian", "saiyan"],
    ["raditz", "vegeta-home", "vegeta-garrison", "namek-front", "vegeta-garrison", "villain", "saiyan"],
    ["nappa", "vegeta-garrison", "vegeta-garrison", "namek-front", "vegeta-garrison", "villain", "saiyan"],
    ["shugesh", "vegeta-home", "vegeta-garrison", "kanassa-coast", "vegeta-home", "guardian", "saiyan"],
    ["futuregohan", "future-refuge", "future-lab", "future-ruins", "future-refuge", "guardian", "resistance"],
    ["android19", "future-lab", "future-lab", "future-ruins", "future-lab", "villain", "red-ribbon"],
    ["android20", "future-lab", "future-lab", "future-ruins", "future-lab", "villain", "red-ribbon"],
    ["cell", "future-ruins", "future-ruins", "cell-arena", "future-ruins", "villain", "red-ribbon"],
    ["kingkai", "kaio", "kaio", "snake-way", "kaio", "mentor", "divine"],
    ["pikkon", "otherworld-kaio", "snake-way", "arena-floor", "otherworld-kaio", "guardian", "otherworld"],
    ["enma", "otherworld-gate", "otherworld-gate", "otherworld-gate", "otherworld-gate", "official", "otherworld"],
    ["yardrat", "yardrat-sanctuary", "yardrat-sanctuary", "yardrat-sanctuary", "yardrat-sanctuary", "mentor", "yardrat"],
    ["broly", "vampa-shelter", "vampa-cave", "vampa-shelter", "vampa-cave", "guardian", "vampa"],
    ["paragus", "vampa-shelter", "vampa-cave", "vampa-shelter", "vampa-cave", "civilian", "vampa"],
    ["beerus", "divine-training", "divine-training", "champa-palace", "divine-training", "deity", "divine"],
    ["whis", "divine-training", "divine-training", "champa-palace", "divine-training", "mentor", "divine"],
    ["cabba", "sadala-city", "sadala-arena", "champa-palace", "sadala-city", "guardian", "universe-6"],
    ["caulifla", "sadala-city", "sadala-arena", "champa-palace", "sadala-city", "guardian", "universe-6"],
    ["kale", "sadala-city", "sadala-arena", "champa-palace", "sadala-city", "guardian", "universe-6"],
    ["champa", "champa-palace", "champa-palace", "sadala-city", "champa-palace", "deity", "universe-6"],
    ["vados", "champa-palace", "champa-palace", "sadala-city", "champa-palace", "mentor", "universe-6"],
    ["hit", "champa-palace", "champa-palace", "arena-floor", "champa-palace", "villain", "universe-6"],
    ["botamo", "champa-palace", "champa-palace", "arena-floor", "champa-palace", "guardian", "universe-6"],
    ["magetta", "champa-palace", "champa-palace", "arena-floor", "champa-palace", "guardian", "universe-6"],
    ["frost", "champa-palace", "champa-palace", "arena-floor", "champa-palace", "villain", "universe-6"],
    ["granolah", "cereal-ruins", "cereal-ruins", "cereal-town", "cereal-ruins", "guardian", "cereal"],
    ["monaito", "cereal-town", "cereal-town", "cereal-ruins", "cereal-town", "healer", "cereal"],
    ["gas", "cereal-ruins", "cereal-ruins", "cereal-town", "cereal-ruins", "villain", "heeters"],
    ["elec", "cereal-town", "cereal-town", "cereal-ruins", "cereal-town", "villain", "heeters"],
    ["maki", "cereal-town", "cereal-town", "cereal-ruins", "cereal-town", "villain", "heeters"],
    ["oil", "cereal-town", "cereal-town", "cereal-ruins", "cereal-town", "villain", "heeters"],
    ["glorio", "demon-market", "demon-gate", "demon-market", "demon-market", "explorer", "demon"],
    ["panzy", "demon-market", "demon-market", "demon-gate", "demon-market", "artisan", "demon"],
    ["gomah", "demon-gate", "demon-gate", "demon-market", "demon-gate", "villain", "demon"],
    ["degésu", "demon-gate", "demon-gate", "demon-market", "demon-gate", "official", "demon"],
    ["neva", "demon-market", "demon-market", "demon-gate", "demon-market", "mentor", "demon"],
    ["arinsu", "demon-market", "demon-market", "demon-gate", "demon-market", "villain", "demon"],
    ["dabura", "demon-gate", "demon-gate", "sacred-garden", "demon-gate", "villain", "demon"],
    ["babidi", "demon-gate", "demon-gate", "sacred-garden", "demon-gate", "villain", "demon"],
    ["tapion", "konatsu-town", "konatsu-town", "konatsu-town", "konatsu-town", "guardian", "konatsu"],
    ["frieza", "frieza-command", "frieza-command", "namek-ship", "frieza-port", "villain", "frieza"],
    ["ginyu", "frieza-command", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["zarbon", "frieza-command", "frieza-command", "namek-ship", "frieza-port", "villain", "frieza"],
    ["dodoria", "frieza-command", "frieza-command", "namek-ship", "frieza-port", "villain", "frieza"],
    ["recoome", "frieza-command", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["jeice", "frieza-command", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["burter", "frieza-command", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["guldo", "frieza-command", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["kingcold", "frieza-command", "frieza-command", "frieza-port", "frieza-command", "villain", "frieza"],
    ["cooler", "frieza-port", "frieza-command", "namek-front", "frieza-port", "villain", "frieza"],
    ["baby", "tsufuru-ruins", "tsufuru-ruins", "tsufuru-ruins", "tsufuru-ruins", "villain", "tsufuru"],
    ["rildo", "tsufuru-ruins", "tsufuru-ruins", "tsufuru-ruins", "tsufuru-ruins", "villain", "tsufuru"],
    ["kanassan", "kanassa-coast", "kanassa-coast", "kanassa-coast", "kanassa-coast", "guardian", "kanassa"],
    ["kaioshin", "sacred-garden", "sacred-garden", "zeno-court", "sacred-garden", "deity", "divine"],
    ["kibito", "sacred-garden", "sacred-garden", "zeno-court", "sacred-garden", "guardian", "divine"],
    ["zamasu", "sacred-garden", "sacred-garden", "zeno-court", "sacred-garden", "villain", "divine"],
    ["jiren", "arena-floor", "arena-floor", "zeno-court", "arena-floor", "guardian", "pride"],
    ["toppo", "arena-floor", "arena-floor", "zeno-court", "arena-floor", "guardian", "pride"],
    ["dyspo", "arena-floor", "arena-floor", "zeno-court", "arena-floor", "guardian", "pride"],
    ["kefla", "arena-floor", "arena-floor", "sadala-arena", "arena-floor", "guardian", "universe-6"],
  ];

  const ROSTER = rows.map(([id, home, training, expedition, social, role, faction]) => {
    const source = known[id];
    if (!source && id !== "enma") throw new Error("Unknown living NPC: " + id);
    for (const place of [home, training, expedition, social])
      if (!sites[place]) throw new Error("Unknown living NPC site: " + place);
    const [temperament, dialogue] = personalities[id] || [
      role === "villain" ? "Desconfiado" : role === "mentor" ? "Atento" : "Independente",
      role === "villain" ? "Mantenha distância e escolha bem suas alianças." :
        role === "mentor" ? "Primeiro encontre seu ritmo, depois aumente a força." :
          "Cada jornada muda quando você conhece quem vive aqui.",
    ];
    const skin = id === "enma" ? "enma" : source.skin;
    if (!Designs[skin]) throw new Error("Living NPC has no design: " + id + "/" + skin);
    return Object.freeze({ id, name: source?.name || "Rei Enma", skin, home, training, expedition,
      social, role, faction, temperament, dialogue,
      canFollow: ["guardian", "explorer", "healer"].includes(role) && !["frieza", "heeters", "red-ribbon"].includes(faction),
      canSpar: ["guardian", "mentor", "explorer"].includes(role),
    });
  });
  const byId = Object.fromEntries(ROSTER.map(npc => [npc.id, npc]));
  const worldIndex = {};
  for (const npc of ROSTER) {
    const worlds = new Set([npc.home, npc.training, npc.expedition, npc.social].map(id => sites[id].world));
    if (worlds.size > 1) worlds.add("space");
    for (const world of worlds) (worldIndex[world] ||= []).push(npc);
  }

  const routines = {
    ordinary: [
      [0, 6, "sleep", "home"], [6, 8, "eat", "home"],
      [8, 12, "train", "training"], [12, 14, "travel", "expedition"],
      [14, 19, "adventure", "expedition"], [19, 22, "social", "social"],
      [22, 24, "travel", "home"],
    ],
    artisan: [
      [0, 7, "sleep", "home"], [7, 9, "eat", "home"],
      [9, 17, "work", "training"], [17, 19, "travel", "expedition"],
      [19, 22, "social", "social"], [22, 24, "travel", "home"],
    ],
    deity: [
      [0, 10, "sleep", "home"], [10, 12, "eat", "home"],
      [12, 17, "train", "training"], [17, 19, "travel", "expedition"],
      [19, 22, "duty", "expedition"], [22, 24, "social", "social"],
    ],
    official: [[0, 24, "duty", "home"]],
  };
  const hash = value => [...value].reduce((h, letter) => (Math.imul(h, 31) + letter.charCodeAt(0)) | 0, 17) >>> 0;
  const finite = value => Number.isFinite(value) ? value : 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function routineFor(npc) {
    return routines[npc.role] || routines.ordinary;
  }

  function location(id, resolver) {
    const fallback = sites[id];
    const custom = typeof resolver === "function" ? resolver(id, fallback) : null;
    return custom && typeof custom.world === "string" && Number.isFinite(custom.x) && Number.isFinite(custom.y)
      ? { ...fallback, ...custom } : fallback;
  }

  function derive(id, epochSeconds, options = {}) {
    const npc = typeof id === "string" ? byId[id] : id;
    if (!npc) return null;
    const time = finite(Number(epochSeconds));
    const day = Math.floor(time / DAY_SECONDS);
    const offset = npc.role === "official" ? 0 : (hash(npc.id) % 70) / 100;
    const hour = ((time / DAY_SECONDS * 24 + offset) % 24 + 24) % 24;
    const routine = routineFor(npc);
    const index = routine.findIndex(([start, end]) => hour >= start && hour < end);
    const [start, end, activity, key] = routine[Math.max(0, index)];
    const place = location(npc[key], options.siteResolver);
    let world = place.world, x = place.x, y = place.y, angle = 0;
    if (activity === "travel") {
      const previous = location(npc[routine[(index + routine.length - 1) % routine.length][3]], options.siteResolver);
      const progress = clamp((hour - start) / (end - start), 0, 1);
      if (previous.world !== place.world) {
        world = "space";
        const from = Nav?.get(previous.world), to = Nav?.get(place.world);
        x = (from?.x || 0) + ((to?.x || 0) - (from?.x || 0)) * progress + (hash(npc.id) % 90) - 45;
        y = (from?.y || 0) + ((to?.y || 0) - (from?.y || 0)) * progress + (hash(npc.id + "space") % 90) - 45;
        angle = Math.atan2((to?.y || 0) - (from?.y || 0), (to?.x || 0) - (from?.x || 0));
      } else {
        x = previous.x + (place.x - previous.x) * progress;
        y = previous.y + (place.y - previous.y) * progress;
        angle = Math.atan2(place.y - previous.y, place.x - previous.x);
      }
    } else {
      const radius = { sleep: 0, eat: 18, work: 70, train: 65, duty: 35, adventure: 150, social: 55 }[activity] || 0;
      const wave = time / 42 + (hash(npc.id) % 360);
      x += Math.cos(wave) * radius;
      y += Math.sin(wave * 0.67) * radius * 0.8;
      angle = wave % (Math.PI * 2);
    }
    return { id: "npc:" + npc.id, characterId: npc.id, name: npc.name, skin: npc.skin,
      role: npc.role, faction: npc.faction, temperament: npc.temperament,
      canFollow: npc.canFollow, canSpar: npc.canSpar,
      world, x: Math.round(x), y: Math.round(y), angle,
      activity, state: activity === "sleep" ? "idle" : activity === "travel" ? "fly" :
        activity === "train" ? "charge" : ["adventure", "work", "duty"].includes(activity) ? "run" : "idle",
      destination: place.name, day };
  }

  function visible(world, x, y, epochSeconds, options = {}) {
    const radius = clamp(finite(options.radius) || 1450, 100, 8000);
    const out = [];
    for (const npc of worldIndex[world] || []) {
      const actor = derive(npc, epochSeconds, options);
      if (actor.world !== world || Math.hypot(actor.x - x, actor.y - y) > radius) continue;
      out.push(actor);
    }
    return out;
  }

  return { DAY_SECONDS, sites, ROSTER, byId, worldIndex, derive, visible, location };
});
