const fs=require('fs');
let s=fs.readFileSync('docs/combat-beta.md','utf8');
s=s.replace('## Referências e interpretação',`## Referências e interpretação

- [Bandai Namco, entrevista de produção de Sparking! ZERO](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-producer-interview): aproximação, sequências e respostas que consomem recursos. A tentativa de assistir ao vídeo oficial neste ambiente ficou sem reprodução; a pesquisa utilizou o texto oficial disponível, sem análise de quadros do vídeo.
- [Bandai Namco, combos e recursos de Sparking! ZERO](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-combos-and-features): referência para alternar pressão, defesa e contra-ataque. Os tempos abaixo são uma adaptação para este jogo visto de cima, não valores copiados dos jogos citados.
- [Bandai Namco, atualização de rollback de FighterZ](https://www.bandainamcoent.com/news/dragon-ball-fighterz-rollback-netcode-update): referência para a importância da resposta online. Nosso servidor ainda não usa rollback.`);
s=s.replace('0,20 × carga_observada −','0,20 × carga_observada + 0,22 × recuperação_observada −');
const start=s.indexOf('## Combos e respostas'),end=s.indexOf('## Leitura visual',start);
s=s.slice(0,start)+`## Ritmo, combos e respostas

Os valores ficam centralizados em \`shared/combat.js\`. O servidor confirma alcance, direção, linha de visão, energia, impacto e recuperação. Clicar inicia preparação; não causa dano instantâneo nem aproxima o personagem de um alvo distante. O avanço de cada golpe corporal é de 18–28 unidades.

| Ação | Preparação | Ativo | Recuperação | Ki | Dano base |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primeiro golpe | 200 ms | 100 ms | 320 ms | 6 | 18 |
| Continuação | 230 ms | 100 ms | 340 ms | 7 | 20 |
| Finalização | 320 ms | 100 ms | 500 ms | 10 | 30 |
| Pesado | 440 ms | 120 ms | 640 ms | 20 | 44 |
| Disparo | 280 ms | 80 ms | 380 ms | 16 | 24 |
| Técnica carregada | 460 ms | 100 ms | 680 ms | 36 | 68 |
| Ruptura de ki | 300 ms | 80 ms | 460 ms | 22 | 25 |

No disparo, o intervalo ativo cria o projétil; ele ainda precisa percorrer a trajetória para atingir alguém. A simulação roda a 30 Hz, portanto os tempos são quantizados em passos de cerca de 33 ms.

- Golpe executa ao soltar. Segurar 450 ms seleciona o pesado. Segurar ki por 550 ms seleciona a técnica carregada. A preparação da tabela começa depois de soltar.
- Acerto sem bloqueio confirma a continuação por 900 ms contra o mesmo alvo. Errar ou atingir a guarda encerra a sequência. Dois acertos permitem Ruptura de ki; três permitem perseguir o lançamento com Esquiva por 28 ki.
- Apenas os últimos 120 ms de recuperação aceitam um comando antecipado. Existe uma única posição na fila, sem renovação por repetição. Esquiva e defesa não cancelam um golpe comprometido.
- Golpes consecutivos recebem redução de 12% por impacto, com piso de 35% do dano. O quarto impacto próximo abre uma proteção de 250 ms e reduz o atordoamento para 120 ms. Há brechas entre sequências; os três golpes não são um aprisionamento garantido.
- Defesa perfeita: 133 ms a partir de um novo pressionamento, custa 8 ki e abre 750 ms de contra-ataque. Há intervalo de 600 ms para renovar a janela. Manter a defesa pressionada não a renova. Contra-ataque corporal aproveita multiplicador 1,25.
- Guarda comum custa energia, sofre dano residual e quebra ao esgotar ki. Guarda inimiga tem 70 de postura; primeiro golpe causa 12, continuação 14, finalização 22 e pesado 40 de pressão. Bloqueio real pode abrir contra-ataque inimigo, que continua tendo aviso.
- Esquiva neutra custa 20 ki, protege por 160 ms e recarrega em 1,05 s. Sob atordoamento, Esquiva vira ruptura defensiva: 45 ki, proteção de 250 ms e recarga de 12 s.
- Defesa perfeita pode devolver projéteis PvE ou PvP, com 80% do dano e 115% da velocidade; cada projétil admite até três devoluções. Cobertura bloqueia disparos terrestres.
- Concentração recupera 24 ki/s durante combate ou 38 fora dele. Recuperação passiva é pequena, não funciona durante golpe ou guarda; vida não regenera no duelo.
- A IA reage também à recuperação observada, respeitando seu atraso de percepção. Mantém seis identidades, energia, orçamento de ataques em grupo e compromisso com as ações já anunciadas.

## Duelo por habilidade

Central → Dojo permite convidar um jogador próximo, pousado e fora de combate, sem inimigos próximos. O rival precisa aceitar. Ambos recebem 600 HP, 100 ki e dano igual; nível, atributos, equipamento e transformação não concedem vantagem. Consumíveis, treino e sistemas do mundo ficam bloqueados durante a partida.

São até três rounds de 180 segundos, com três segundos de preparação por round. Dois rounds vencidos encerram antes. Nocaute decide o round; no tempo limite vence quem tiver mais vida. Vida igual ou nocaute simultâneo empata o round. Ao terceiro round, o placar decide a partida e pode terminar empatado. Não há cura passiva nem expectativa de luta infinita.

Golpes corporais comprometidos no mesmo passo podem trocar impactos, inclusive em nocaute simultâneo. Espectadores não causam/recebem dano do duelo nem absorvem seus projéteis. Sair do círculo de 750 unidades, desistir ou desconectar encerra a partida. Posição, vida, energia e atributos anteriores são restaurados; o salvamento usa esse estado anterior, não os 600 HP temporários. O servidor retém registros limitados de impactos, rounds e amostras das últimas 20 partidas em memória; isso não é replay determinístico nem histórico persistente.

## História e orientação

O prólogo conduz a Bulma, à investigação de uma pista e só então ao combate. Paozu não gera patrulhas ambientais para o iniciante; o primeiro encontro apresenta um batedor por vez, com pausa entre adversários. Outros jogadores podem continuar suas atividades no mundo compartilhado.

Diário de 28 capítulos, diálogo, botão de interação, progresso e marcador usam o objetivo persistente ativo. Objetivos antigos de três patrulheiros e chefe não aparecem como campanha principal. O caminho legado permanece apenas por seleção explícita/compatibilidade de perfil. O indicador da história fica suspenso durante duelos.

`+s.slice(end);
s=s.replace('O HUD recolhe missões','A câmera aproxima confrontos próximos respeitando o espaço disponível; as poses de golpe seguem preparação, impacto e recuperação do servidor. A barra de ritmo identifica as fases e a janela de comando. O HUD recolhe missões');
s=s.replace('`npm run test:combat` cobre','A suíte completa passou com 130 testes antes do último acabamento visual. Não foram iniciadas novas rodadas amplas após o pedido de encerramento. `npm run check:rhythm` verifica conversa com Bulma, duelo consentido, impacto atrasado por clique/toque e restauração em quatro telas.\n\n`npm run test:combat` cobre');
fs.writeFileSync('docs/combat-beta.md',s);
let r=fs.readFileSync('docs/beta-release.md','utf8');r=r.replace('- 111 testes passaram:', '- Revisão do ritmo de combate: 130 testes passaram antes do acabamento visual final; ver detalhes em `combat-beta.md`.\n- Validação anterior da beta: 111 testes passaram:');r=r.replace('## Jogar e testar','## Revisão de ritmo e duelos\n\nGolpes agora têm preparação e recuperação reais; defesa usa novo pressionamento, combos exigem acerto confirmado e há ruptura defensiva limitada. Duelo por convite equaliza vida/dano e restaura o personagem. A abertura e os indicadores seguem a campanha persistente. A câmera e as poses tornam as fases mais legíveis. Esta revisão não certifica equilíbrio esportivo: faltam sessões humanas e testes WAN; não há rollback, ranking ou matchmaking competitivo.\n\n## Jogar e testar');r=r.replace('- `npm run check:combat`:', '- `npm run check:rhythm`: história atual, duelo e controles por clique/toque.\n- `npm run check:combat`:');fs.writeFileSync('docs/beta-release.md',r);
fs.appendFileSync('README.md','\n## Revisão de ritmo e duelos\n\nGolpes exigem preparação, acerto e recuperação; defesa perfeita exige um novo pressionamento. Central → Dojo inclui duelo por convite com vida/dano equalizados, até três rounds e restauração do personagem. A campanha principal orienta Bulma → pista → primeiro encontro, com um adversário por vez. Consulte [tempos, controles, fontes e limites](docs/combat-beta.md). Reinicie o servidor e recarregue o navegador para usar esta revisão.\n');
