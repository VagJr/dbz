# UNIVERSE Z — DESTROY THE GALAXY

Fan game action RPG multiplayer em Canvas 2D, com simulação autoritativa em Node.js e Socket.IO. A versão atual está em `public/`, `shared/` e `src/`. A base anterior está preservada em `legacy/`.

## Jogar

```sh
npm install
npm start
```

Abra http://localhost:25565. O catálogo animado fica em http://localhost:25565/models.html e também é acessível pelo menu Guerreiro. `PORT` e `DATA_DIR` permitem executar uma prévia isolada. O mundo e os perfis são salvos juntos em `data/checkpoint.json`; preserve o diretório e backups verificados. `profiles.json` e `world.json` são espelhos de compatibilidade.

## Controles

| Ação                            | PC                        | Celular             |
| ------------------------------- | ------------------------- | ------------------- |
| Movimento                       | WASD / setas              | Joystick            |
| Aceleração                      | Shift                     | BOOST               |
| Golpes / combo                  | J / clique                | Golpe               |
| Técnica carregada               | Segurar K / botão direito | Segurar Técnica     |
| Esquiva / cancelamento          | Espaço                    | Esquiva             |
| Defesa / parry                  | L                         | Defesa              |
| Recuperar ki                    | Q                         | KI                  |
| Voo / pouso / entrar no planeta | F                         | Botão do radar      |
| Subir à órbita / cancelar       | V                         | Órbita              |
| Despertar                       | R                         | Despertar           |
| Mestre / treinamento            | E / T                     | Botões de interação |
| Destinos                        | M                         | Atlas               |

Marque um destino no Atlas, suba à órbita e voe seguindo a seta. Dentro da faixa de aproximação, F entra na atmosfera do planeta. O mesmo personagem mantém progressão e recursos durante a viagem. Mundos dimensionais aparecem como portais. A Transmissão instantânea é aprendida em Yardrat no nível 3 por 250 zenni, exige proximidade do mestre e permite retornar a destinos descobertos por 40 de ki, fora de combate.

## Conteúdo implementado e limites

- 19 destinos fixos e fronteiras procedurais determinísticas; superfície explorável além da antiga arena, com cenário gerado por coordenadas. A área com missões, mestres e patrulhas continua concentrada em torno dos assentamentos.
- Voo rápido com aceleração, correção de direção, frenagem e boost; combate com combo, esquiva, guarda direcional, parry, contra-ataque e técnicas.
- 136 entradas no catálogo de personagens e formas. Cada pele tem uma ficha visual explícita; os desenhos compartilham estruturas de animação por anatomia. Isso não representa todos os personagens da franquia nem 136 conjuntos de animação desenhados quadro a quadro.
- Arte vetorial com 12 poses de repouso, caminhada, voo, voo acelerado, esquiva, combo, defesa, concentração, disparo e impacto; passos curtos vistos de cima, pernas recolhidas em voo e braços alternados na caminhada. Inclui retratos ilustrados para diálogos.
- 6 campanhas, 45 capítulos simplificados, progressão, atributos, treino, técnicas, bosses, esferas e prólogo/tutorial. Os capítulos usam o ciclo mestre–patrulha–boss; não são uma adaptação completa de todas as cenas e diálogos da obra.
- Planetas com projeção esférica iluminada e rotação visual em dois eixos, sprites 2D, parallax e transições de atmosfera. A superfície ainda usa coordenadas planas; não é uma simulação 3D esférica nem uma reprodução geográfica/astronômica 1:1 do cânone.
- Áudios existentes na pasta `audio/`; esta revisão não baixou áudios oficiais.
- Multiplayer funcional entre clientes, com persistência local no servidor. Ainda não há validação de escala de MMO, infraestrutura distribuída nem simulação de vida autônoma para todo o elenco.

## Verificação

```sh
npm test
```

Os testes cobrem combate, progressão, persistência, sincronização entre clientes, navegação real entre planetas, restrições de teleporte, cancelamento de carga e cobertura/validade geométrica dos modelos e animações. A qualidade artística deve ser revisada no jogo e no estúdio; testes não certificam fidelidade visual ao anime.

## Onde ajustar

- `shared/character-designs.js`: fichas de personagens, roupas, silhuetas e acessórios.
- `public/character-art.js`: modelos articulados e retratos vetoriais.
- `public/combat-art.js`: câmera, terreno, combate, projéteis e radar de superfície.
- `public/universe-art.js`: globos, espaço, arquitetura e orientação de voo.
- `shared/navigation.js` e `src/navigation.js`: destinos, órbita, entrada e teleporte.
- `src/engine.js`: movimento, combate e progressão autoritativos.
- `public/flight-ui.css`: acabamento e adaptação dos controles de navegação.

Esta entrega integra os sistemas acima. A produção de todo o universo e história em escala canônica permanece incompleta; o catálogo e os destinos atuais delimitam o conteúdo realmente presente.

## Atualização: Fronteiras

A composição dos 19 destinos, o combate e a continuação da campanha foram revisados. Consulte [a entrega e seus limites](docs/frontiers-production.md). Execute `npm test`, `node tools/check-sandbox.cjs` e `node tools/check-frontiers.cjs` para verificar regras e fluxos visuais. Os testes de navegador usam dados isolados. Preserve `checkpoint.json` nos backups: ele é a fonte conjunta de personagens e mundo.

## Beta 1.0 — combate e operação

Central → Dojo permite treinar seis identidades inimigas. A IA usa percepção atrasada, energia de ação, guarda, esquiva, contra-ataque e projéteis físicos; o jogador pode devolver ki e romper guarda alternando golpes e técnica.

Consulte [regras e referências de combate](docs/combat-beta.md), [entrega, testes e portões de lançamento](docs/beta-release.md) e [monetização proposta sem vantagem de poder](docs/monetization.md). Compras estão desativadas. Esta versão é candidata local a testes, sem publicação comercial.

## Revisão de ritmo e duelos

Golpes exigem preparação, acerto e recuperação; defesa perfeita exige um novo pressionamento. Central → Dojo inclui duelo por convite com vida/dano equalizados, até três rounds e restauração do personagem. A campanha principal orienta Bulma → pista → primeiro encontro, com um adversário por vez. Consulte [tempos, controles, fontes e limites](docs/combat-beta.md). Reinicie o servidor e recarregue o navegador para usar esta revisão.
