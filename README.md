# UNIVERSE Z — DESTROY THE GALAXY

Fan game action RPG multiplayer em Canvas 2D, com simulação autoritativa em Node.js e Socket.IO. A versão atual está em `public/`, `shared/` e `src/`. A base anterior está preservada em `legacy/`.

## Jogar

```sh
npm install
npm start
```

Abra http://localhost:3000. O catálogo animado fica em http://localhost:3000/models.html e também é acessível pelo menu Guerreiro. `PORT` e `DATA_DIR` permitem executar uma prévia isolada. Os perfis são salvos em `data/profiles.json`; preserve esse arquivo e seus backups.

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
