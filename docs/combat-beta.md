# Combate da beta 1.0 — regras, referências e ajuste

Implementado em 27/09/2026. Objetivo: combate de ação visto de cima, legível no celular, com decisão entre pressão, posicionamento, guarda e energia. A qualidade subjetiva e a dificuldade precisam de sessões com jogadores; testes automatizados não certificam diversão, equilíbrio competitivo ou premiação.

## Referências e interpretação

- [Bandai Namco, entrevista de produção de Sparking! ZERO](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-producer-interview): aproximação, sequências e respostas que consomem recursos. A tentativa de assistir ao vídeo oficial neste ambiente ficou sem reprodução; a pesquisa utilizou o texto oficial disponível, sem análise de quadros do vídeo.
- [Bandai Namco, combos e recursos de Sparking! ZERO](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-combos-and-features): referência para alternar pressão, defesa e contra-ataque. Os tempos abaixo são uma adaptação para este jogo visto de cima, não valores copiados dos jogos citados.
- [Bandai Namco, atualização de rollback de FighterZ](https://www.bandainamcoent.com/news/dragon-ball-fighterz-rollback-netcode-update): referência para a importância da resposta online. Nosso servidor ainda não usa rollback.

- [Mihir Sheth / Santa Monica, Evolving God of War’s Combat, GDC 2019](https://media.gdcvault.com/gdc2019/presentations/Sheth_Mihir_EvolvingCombat.pdf): coordenação por orçamento de agressividade, identificação das ameaças e comandos acessíveis. Adaptação nossa: uma ameaça comprometida nos encontros iniciais, até duas em encontros de nível alto; disparos em trânsito também ocupam esse orçamento. Não copiamos os valores do jogo.
- [Guerrilla, The AI of Horizon Zero Dawn](https://www.guerrilla-games.com/read/the-ai-of-horizon-zero-dawn): combinação de planejamento e decisões por utilidade, navegação e coordenação de agentes. Aqui usamos uma máquina de estados pequena com seleção por utilidade; não implementamos o planejador HTN de Horizon.
- [Game AI Pro, Building Utility Decisions into Your Existing Behavior Tree](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter10_Building_Utility_Decisions_into_Your_Existing_Behavior_Tree.pdf): pontuar alternativas segundo sua adequação ao contexto. Nossa pontuação usa sinais observáveis, energia e limites explícitos, com pesos em código para permitir ajuste.

## Cadência e justiça

O inimigo amostra posturas visíveis a cada 67 ms, inclusive durante atordoamento, com atraso de reação de 300 ms no aprendiz, 220 ms no veterano e 160 ms no elite. Chefes/perfis podem definir seu atraso, respeitando piso de 133 ms. A observação guarda um histórico curto; não lê teclas, ataques futuros nem inventário do jogador. Distância e linha de visão são verificadas no momento da ação. As observações privadas não são transmitidas ao cliente.

A decisão ocorre a cada 133/100/67 ms conforme o nível. Estados comprometidos — preparação, execução, esquiva e recuperação — não podem ser trocados a cada quadro. Esquiva inimiga é deslocamento físico, sem invulnerabilidade artificial. A direção do ataque fica fixa na preparação, permitindo induzir o golpe e sair da linha. Golpes leves têm preparação de 233/167/133 ms conforme o nível; finalizações acrescentam 67 ms. Ondas e investidas mantêm pelo menos 400/300 ms de aviso. A IA confirma até dois golpes no aprendiz e três nos demais; bloqueio ou erro encerra a sequência e acrescenta 160 ms de recuperação. Dano durante recuperação ou retomada de fôlego recebe multiplicador 1,20.

Energia de ação vai de 0 a 100: golpe leve custa 10, especial/finalização 16, disparo 18, passo lateral 26 e início de guarda 8. Bloquear custa mais 10. Recuperação devolve 18/s; movimento comum, 7/s. Guarda não regenera energia. Baixa energia favorece recuo ou retomada de fôlego.

Exemplo da pontuação do golpe, depois de validar alcance, energia, visão e orçamento de grupo:

`S_golpe = agressividade × (0,68 + 0,22 × proximidade + 0,20 × carga_observada + 0,22 × recuperação_observada − 0,18 × guarda_observada + 0,30 × sequência_confirmada)`

`proximidade = clamp(1 − (distância − alcance_corporal) / 150, 0, 1)`

Outras ações têm suas próprias curvas. Uma preferência de 0,04 pela decisão anterior reduz alternância nas fronteiras de alcance. Pesos não tornam a IA onisciente: ações indisponíveis saem da disputa. Pressão recente aumenta a preferência por guarda e esquiva depois do atraso de reação. Consulte `src/combat-brain.js`, `src/enemy-motor.js` e `src/enemy-tactics.js`.

| Identidade | Comportamento | Resposta proposta ao jogador |
| --- | --- | --- |
| Batedor | Aproxima, pressiona, usa passo lateral | Intercepte a aproximação e varie direção |
| Lutador | Prefere contato e ofensiva | Provoque um golpe e puna a recuperação |
| Duelista | Guarda, esquiva e contra-ataca bloqueios reais | Alterne golpes, ruptura de ki e flanco |
| Escaramuça | Alterna distância e contato; recua | Corte seu espaço de manobra |
| Artilharia | Procura distância e pune concentração exposta | Use cobertura, flanqueie ou devolva o ki |
| Colosso | Guarda forte, ondas e golpes lentos | Rompa postura ou abandone a área anunciada |

Perfis das fases de chefes são mapeados para essas tendências sem remover suas transições. Não há aprendizado de máquina, navegação global nem memória permanente de hábitos do jogador.

## Ritmo, combos e respostas

Os valores ficam centralizados em `shared/combat.js`. O servidor confirma alcance, direção, linha de visão, energia, impacto e recuperação. Clicar inicia preparação; não causa dano instantâneo nem aproxima o personagem de um alvo distante. O avanço de cada golpe corporal é de 18–28 unidades.

| Ação | Preparação | Ativo | Recuperação | Ki | Dano base |
| --- | ---: | ---: | ---: | ---: | ---: |
| Golpe | 100 ms | 67 ms | 133 ms | 3 | 18 |
| Continuação | 100 ms | 67 ms | 167 ms | 4 | 20 |
| Lançamento | 167 ms | 67 ms | 267 ms | 7 | 30 |
| Quebra de guarda | 267 ms | 100 ms | 367 ms | 18 | 44 |
| Disparo | 133 ms | 67 ms | 167 ms | 10 | 24 |
| Técnica carregada | 333 ms | 100 ms | 467 ms | 32 | 68 |
| Ruptura de ki | 133 ms | 67 ms | 233 ms | 16 | 25 |

No disparo, o intervalo ativo cria o projétil; ele ainda precisa percorrer a trajetória para atingir alguém. A simulação roda a 30 Hz, portanto os tempos são quantizados em passos de cerca de 33 ms.

- Golpe executa ao soltar. Segurar 450 ms seleciona o pesado. Segurar ki por 550 ms seleciona a técnica carregada. A preparação da tabela começa depois de soltar.
- Acerto sem bloqueio confirma a continuação por 700 ms contra o mesmo alvo. Errar ou atingir a guarda encerra a sequência. Dois acertos permitem Ruptura de ki; três permitem perseguir o lançamento com Esquiva por 28 ki.
- Os últimos 180 ms aceitam um comando antecipado; depois de um acerto confirmado, o primeiro e o segundo golpe também permitem encadear golpe ou ki após o intervalo ativo e mais um quadro (33 ms). Existe uma única posição na fila, sem renovação por repetição. Esquiva e defesa não cancelam um golpe comprometido.
- Golpes consecutivos recebem redução de 12% por impacto, com piso de 35% do dano. O quarto impacto próximo abre uma proteção de 250 ms e reduz o atordoamento para 120 ms. Há brechas entre sequências; os três golpes não são um aprisionamento garantido.
- Defesa perfeita: 133 ms a partir de um novo pressionamento, custa 8 ki e abre 750 ms de contra-ataque. Há intervalo de 600 ms para renovar a janela. Manter a defesa pressionada não a renova. Contra-ataque corporal aproveita multiplicador 1,25.
- Guarda comum custa energia, sofre dano residual e quebra ao esgotar ki. Guarda inimiga tem 70 de postura; primeiro golpe causa 12, continuação 14, finalização 22 e pesado 80 de pressão. Bloqueio real pode abrir contra-ataque inimigo, que continua tendo aviso.
- Esquiva neutra custa 20 ki, protege por 160 ms e recarrega em 1,05 s. Sob atordoamento, Esquiva vira ruptura defensiva: 45 ki, proteção de 250 ms e recarga de 12 s.
- Defesa perfeita pode devolver projéteis PvE ou PvP, com 80% do dano e 115% da velocidade; cada projétil admite até três devoluções. Cobertura bloqueia disparos terrestres.
- Concentração recupera 24 ki/s durante combate ou 38 fora dele. Recuperação passiva é pequena, não funciona durante golpe ou guarda; vida não regenera no duelo.
- A IA reage também à recuperação observada, respeitando seu atraso de percepção. Mantém seis identidades, energia, orçamento de ataques em grupo e compromisso com as ações já anunciadas.

## Duelo por habilidade

Central → Dojo permite convidar um jogador próximo, pousado e fora de combate, sem inimigos próximos. O rival precisa aceitar. Ambos recebem 600 HP, 100 ki e dano igual; nível, atributos, equipamento e transformação não concedem vantagem. Consumíveis, treino e sistemas do mundo ficam bloqueados durante a partida.

São até três rounds de 180 segundos, com três segundos de preparação por round. Dois rounds vencidos encerram antes. Nocaute decide o round; no tempo limite vence quem tiver mais vida. Vida igual ou nocaute simultâneo empata o round. Ao terceiro round, o placar decide a partida e pode terminar empatado. Não há cura passiva nem expectativa de luta infinita.

Golpes corporais de jogadores e NPCs são ordenados pelo instante previsto de impacto; o anterior pode interromper a preparação rival. Impactos simultâneos podem trocar golpes, inclusive em nocaute simultâneo. Espectadores não causam/recebem dano do duelo nem absorvem seus projéteis. Sair do círculo de 750 unidades, desistir ou desconectar encerra a partida. Posição, vida, energia e atributos anteriores são restaurados; o salvamento usa esse estado anterior, não os 600 HP temporários. O servidor retém registros limitados de impactos, rounds e amostras das últimas 20 partidas em memória; isso não é replay determinístico nem histórico persistente.

## História e orientação

O prólogo conduz a Bulma, à investigação de uma pista e só então ao combate. Paozu não gera patrulhas ambientais para o iniciante; o primeiro encontro apresenta um batedor por vez, com pausa entre adversários. Outros jogadores podem continuar suas atividades no mundo compartilhado.

Diário de 28 capítulos, diálogo, botão de interação, progresso e marcador usam o objetivo persistente ativo. Objetivos antigos de três patrulheiros e chefe não aparecem como campanha principal. O caminho legado permanece apenas por seleção explícita/compatibilidade de perfil. O indicador da história fica suspenso durante duelos.

## Leitura visual e prática

Áreas vermelhas anunciam direção e alcance; dourado identifica contra-ataque; recuperação aparece em verde; barra azul mostra energia inimiga. Ataques fora da câmera recebem seta e contagem regressiva. A câmera aproxima confrontos próximos respeitando o espaço disponível; as poses de golpe seguem preparação, impacto e recuperação do servidor. A barra de ritmo identifica as fases e a janela de comando. O HUD recolhe missões, interação e navegação secundária durante combate; a Central mantém acesso aos menus.

Central → Dojo oferece seis rivais e três níveis. É necessário pousar junto ao mestre, fora de combate real. Cada sessão dura até três minutos e encerra ao vencer, afastar-se ou chegar a 1 HP. Não concede XP, itens, moeda ou progresso de missão. O sparring não restaura vida gratuitamente e suas colisões ofensivas ficam restritas ao participante. Outros inimigos reais continuam perigosos.

## Validação e próxima calibração

A revisão de cadência rápida inclui testes específicos de prioridade jogador/NPC, interrupção, troca simultânea, confirmação e erro da IA, níveis de reação e pares de pressionamento/soltura. `npm run check:rhythm` verifica conversa com Bulma, duelo consentido, impacto atrasado por clique/toque e restauração em quatro telas.

`npm run test:combat` cobre percepção atrasada, energia, identidade, contra-ataque, projéteis, devolução, combo e isolamento do dojo. `npm run check:combat` entra pelo navegador, inicia/encerra o dojo e captura preparação e disparos em desktop, celular vertical, paisagem e tela compacta. `npm test` cobre também história, economia, persistência e rede.

Ajustar com pelo menos dez sessões por identidade e por dispositivo: taxa de golpes evitados após aviso, dano recebido sem ameaça visível, duração do confronto, frequência de cada ação, mortes e entendimento dos sinais. Comparar iniciantes e experientes. Verificar latência de 100–200 ms e perda de pacotes antes de liberar PvP competitivo: a simulação atual é autoritativa, sem compensação de latência de combate. Ainda faltam testes humanos de longa duração, calibração por chefe e validação de acessibilidade com jogadores.


## Beams, trocação e impactos

Segure Golpe por 450 ms e solte para quebrar a guarda comum. O pesado causa 80 de pressão à postura inimiga; contra jogadores, esgota o ki da guarda. Beams carregados também rompem a guarda comum ao atingir. A defesa perfeita mantém sua janela e pode responder, inclusive devolvendo o beam. Esquivar ou sair da direção do ataque evita a ruptura.

Segure Disparo de ki por 550 ms e solte. Durante os primeiros 650 ms de voo, a mira controla a curva: máximo de 1,2 radianos/s e 0,65 radiano para cada lado da direção inicial. Depois disso segue a direção atingida. No celular, a direção usa a mira existente ou o direcional. O rastro desenha a curva real; o dano continua na ponta do projétil. Beams refletidos deixam de aceitar correção para evitar mudança abrupta de dono/direção.

Dois beams carregados opostos colidindo iniciam uma disputa de 2,4 s. A colisão considera o percurso entre quadros, evitando atravessamento. Pressione Disparo de ki no centro da barra a cada 300 ms: cada pulso custa 3 ki e precisão vale mais que quantidade. Uma única entrada por intervalo é aceita; pressionar e soltar não duplica pontos. O vencedor libera um projétil que ainda percorre o espaço e pode ser evitado. Empate gera explosão e separa ambos.

Trocas simultâneas de golpes leves podem engatar trocação na terceira colisão elegível, com intervalo mínimo de 10 s por participante. A disputa dura 1,8 s: alterne Golpe e Defesa conforme a barra, uma entrada por intervalo de 300 ms e 1 ki por entrada. A animação exibe socos rápidos; a decisão depende do ritmo. NPCs participam com cadência e precisão por nível, sem ler a pontuação ou comandos do adversário.

Disputas suspendem movimento e outras ações dos participantes. Desconexão, fim de round/duelo, morte, troca de mundo ou dano de terceiro elegível encerram o engate. Espectadores e jogadores sem consentimento de PvP não entram. Empates têm recuo bilateral; o vencedor da trocação recebe uma abertura curta, não um aprisionamento infinito.

Esquivas frontais dos dois adversários produzem explosão, onda de choque e recuo físico em direções opostas. Não concedem dano gratuito. Despertar e Kaioken emitem uma onda de 230 unidades que afasta adversários próximos; visão, obstáculos, isolamento do duelo e intervalo de 8 s são respeitados. O efeito não empurra espectadores neutros. Tremor de câmera e clarão central respeitam movimento reduzido.

Validação desta revisão: testes de combate, motor e novas disputas; inspeção de duelo e choque de beams em desktop, celular vertical, paisagem e tela compacta. Este conjunto ainda precisa de calibração humana de dificuldade e latência.
