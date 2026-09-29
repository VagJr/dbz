# Universo vivo — guia de produção

Estado do código em 28/09/2026. O atlas em [`shared/universe-atlas.js`](../shared/universe-atlas.js) contém **19 mundos, 141 locais, 38 rotas locais, 17 transições entre mundos e 32 referências editoriais**. Cada local tem ID estável, mundo, região, tipo, coordenadas de jogo, raio, nível e, quando cabível, fonte, era, NPCs, recursos e propostas de atividade. As coordenadas, distâncias e dimensões são adaptações para jogabilidade; não representam uma geografia oficial em escala 1:1. Mundos históricos, alternativos, divinos e de filme têm rótulos de era no catálogo. Esses rótulos e os requisitos das transições ainda não constituem um sistema geral de bloqueios jogáveis.

## O que está integrado

- **Superfície e mapa:** `shared/open-world.js` indexa os locais por células de 1.600 unidades, gera cenário e encontros por célula e preserva âncoras antigas de missões e NPCs. O botão **Mapa local** abre o mapa do mundo atual, com filtro por proximidade ou região, deslocamento, zoom e seleção de destino. A rota local é validada pelo servidor; o jogador recebe marcador e distância. `src/universe-world.js` registra descobertas próximas, persiste seus IDs e concede recompensa única pela atividade. O Atlas estelar continua responsável pela viagem entre mundos; as linhas e transições de `shared/universe-atlas.js` são dados de planejamento, não viagens automáticas.
- **Personagens:** `shared/living-npcs.js` calcula uma rotina diária de duas horas reais a partir do relógio e de itinerários curtos. `src/living-npcs.js` mostra personagens próximos e permite conversar, treinar, pedir acompanhamento e dispensar, conforme o personagem e o vínculo. `src/npc-events.js` leva até quatro personagens para responder a um evento de combate observado. As posições de rotina são derivadas sob demanda; não há simulação persistente de deslocamento de toda a população.
- **Mundo e economia:** `shared/world-economy.js` e `src/world-economy.js` integram profissões, coleta, fabricação, construção, provisões, comércio entre jogadores, recompensas verificadas no servidor e rankings. A interface **Ofícios & Ranking** expõe essas ações. Os recursos e `hooks` listados em cada local do atlas descrevem afinidades e futuras atividades; nem todo `hook` tem missão, serviço ou evento implementado.
- **Morte e retorno:** `src/afterlife.js` conserva a origem da morte, envia o personagem ao Outro Mundo após a recuperação do combate, mostra auréola e objetivo de procurar Enma e permite retornar ao local da queda após interação. Esse retorno é uma regra do jogo, não uma alegação sobre o destino de todos os personagens no cânone.
- **Vida ambiente e eventos:** fauna pacífica da Terra, de Namekusei e de Vampa passeia, se alimenta ou foge do combate. Eventos de invasão surgem na região ativa de um jogador apto, com adversário e título conforme o planeta, em vez de aparecer sempre na posição inicial. A fauna atual não é um sistema de caça ou de reprodução.
- **Celular:** o HUD de combate mantém controles nas bordas, retrato e barras emoldurados e radar circular que abre o mapa local. Janelas pequenas usam as artes do kit. Toques longos não selecionam o jogo; campos de texto continuam editáveis. O manifesto, os ícones e o convite de instalação permitem instalar o web app em navegadores compatíveis. A instalação do navegador exige HTTPS ou `localhost` e um toque no botão; no iPhone a interface ensina a usar “Adicionar à Tela de Início”.

## Orçamento de integração atual

| Área | Limite ou cadência presente no código |
| --- | --- |
| Terreno | Células de 1.600 unidades; consulta aos locais da própria célula; até oito marcos usados na composição visual de uma célula. |
| Descoberta | Verificação por jogador a cada 1 s, em 3 × 3 células próximas; distância de descoberta limitada a 180–500 unidades; até 500 registros recentes no diário sandbox. |
| NPCs | Presença calculada para um raio de 1.450 unidades na atualização do jogador; resposta a eventos a cada 1/3 s, com até quatro participantes NPC. |
| Servidor | Simulação a 30 passos/s, atualização de rede a cada dois passos (15/s); checkpoint periódico a cada 15 s e no encerramento normal. |
| Mercado | Até 2.500 ofertas totais e 12 por vendedor; listagens vencem em 14 dias. |
| Fauna | Até 80 atores no servidor; movimento a 5 passos/s; no máximo 28 animais próximos por atualização ao jogador. |

Esses limites são guardrails da implementação, não medição ou promessa de capacidade. Antes de ampliar a densidade de cidades, NPCs e atividades, medir tempo de passo, tamanho de atualização, uso de memória e navegação em dispositivos modestos; preservar o índice por célula e a validação de distância no servidor.

## Usar e operar

Execute `npm start` e abra `http://localhost:25565`. **WASD** ou joystick movem; **E** interage; **M** abre o Atlas estelar; **Mapa local** mostra os destinos de superfície e permite marcar a rota. **V** sobe à órbita; **F** alterna voo/caminhada na superfície e entra em um planeta quando está próximo no espaço. A tela **Controles** no jogo lista combate, treino e demais atalhos. No mapa local, arraste para explorar, use `+` e `−` para o zoom, escolha a região e selecione um local da lista ou um pino.

Após alterar código do servidor, pare a instância atual com `Ctrl+C`, aguarde o fechamento e inicie `npm start` novamente; atualize o navegador para carregar scripts novos. O encerramento normal salva o estado e libera `server.lock`. Não inicie duas instâncias no mesmo `DATA_DIR`. Se o processo cair, confirme que ele terminou antes de tratar um lock remanescente, conforme [`beta-release.md`](beta-release.md).

## Fontes e limites de fidelidade

O campo `sourceIds` de cada local aponta para o catálogo `SOURCES` de [`shared/universe-atlas.js`](../shared/universe-atlas.js). Entre as referências primárias usadas estão [vizinhança de Goku](https://en.dragon-ball-official.com/news/01_680.html), [Cidade do Oeste](https://en.dragon-ball-official.com/news/01_551.html), [Santuário Karin e Palácio de Kami](https://en.dragon-ball-official.com/news/01_597.html), [Namekusei](https://en.dragon-ball-official.com/news/01_530.html), [Yardrat](https://en.dragon-ball-official.com/news/01_2841.html), [Cereal](https://en.dragon-ball-official.com/news/01_4361.html) e [Reino Demoníaco](https://en.dragon-ball-official.com/news/01_2865.html). `loreStatus: "adaptation"` identifica lugares ou recortes criados para o jogo; até locais documentados receberam coordenadas inventadas.

**Escopo pendente:** as 141 entradas são um atlas e uma base explorável gerada por células, não 141 ambientes finalizados individualmente. Cidades completas em escala 1:1, todos os bairros e interiores navegáveis, população e personagens exaustivos, trânsito e ecologia persistentes, clima integral, cronologias acessíveis por regras completas e todos os eventos sugeridos em `hooks` ainda não estão concluídos. A migração definitiva das âncoras antigas exige mover junto missões, NPCs e objetivos; as seis fases em `PRODUCTION_PHASES` registram essa sequência de trabalho.
