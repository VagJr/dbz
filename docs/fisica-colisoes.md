# Física e colisões de Universe Z

## Controles

| Ação | Desktop | Mobile |
| --- | --- | --- |
| Pular no chão | Espaço | PULAR, no lugar de BOOST |
| Iniciar voo / pousar | F | Botão de voo |
| Subir em voo | Segurar Espaço | Segurar SUBIR |
| Descer em voo | Segurar U | Segurar DESCER |
| Esquiva | Alt esquerdo | Esquiva |
| Acelerar voo | Shift | BOOST |

WASD e a direção do mouse mantêm os modos de movimento existentes. Descer usa U para evitar combinações reservadas pelo navegador, como Ctrl + W.

## Coordenadas e cenário

- `x/y` representam a posição no plano do mundo. `z` representa a altura física, `vz` a velocidade vertical e `groundZ` a superfície que sustenta o corpo.
- `altitude` continua sendo a transição orbital; não é a altura de um salto.
- O servidor decide as posições e os acertos. A previsão local usa a mesma física e os mesmos contornos do servidor.
- Montanhas têm contornos com 18 vértices correspondentes à arte, altura própria e topo pousável. Troncos, rochas, prédios e mobiliário têm perfis distintos. Arcos e portões mantêm o vão aberto.
- Flores, grama, tapetes e recursos pequenos não bloqueiam a passagem. Construções de jogadores participam da colisão.
- Voar não ignora a geometria: os pés precisam estar acima do topo do obstáculo. Desativar o voo inicia a queda; pousar no topo permite caminhar sobre a superfície. Sair da borda inicia outra queda.
- Objetos do cenário são fixos. Corpos e fragmentos de impacto recebem gravidade; massa afeta aceleração, salto e recuo. A fauna usa a mesma movimentação com colisão.

## Contato de combate

`shared/hitboxes.js` define volumes separados de cabeça, tronco e pernas, com variações de tamanho. Golpes usam trajetórias orientadas, pose e altura; projéteis varrem o trecho entre duas posições e resolvem o primeiro contato antes de obstáculos. A guarda considera direção e altura do impacto, mantendo as janelas de defesa e contra-ataque existentes.

As caixas são volumes de jogabilidade ajustados ao modelo; cabelo, aura e roupas soltas não aumentam a área vulnerável. Não são testes de colisão por pixel da imagem.

## Arquivos principais

- `shared/collision-world.js`: contornos e alturas do cenário, com cache local limitado.
- `shared/physics.js`: suporte, gravidade, salto, voo, inércia, contatos e varredura de obstáculos.
- `shared/hitboxes.js`: contatos entre ataques e corpos.
- `src/physics.js`: integração da simulação, NPCs, construções, persistência e fragmentos.
- `public/realtime.js`: previsão e interpolação das alturas.
- `public/open-world-art.js`: sobreposição de objetos próximos para mostrar profundidade.

A simulação detalhada fica nas células próximas dos jogadores. Fragmentos ficam limitados a 48; a sobreposição visual também tem orçamento de 48 desenhos por quadro.

## Validação desta alteração

Revisão estática e checagem de sintaxe JavaScript. Testes de gameplay e navegador não foram executados nesta etapa. Reinicie o servidor e recarregue a página para carregar a camada nova.
