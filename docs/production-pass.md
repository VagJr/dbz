# Produção visual e resposta — setembro de 2026

## Conteúdo implementado

- Menu inicial START GAME com pintura panorâmica do art-kit e movimento de câmera.
- Prólogo em três tomadas, reprodução automática, pausa, avanço e opção de pular. Os diálogos de missão continuam com avanço manual. É motion design renderizado no navegador, sem baixar arquivos de vídeo pesados.
- HUD com molduras de vida/Ki e artes de habilidades; navegação com peças do acervo existente.
- Central, vida no universo, atlas, crônicas, guerreiro, manual, ajustes e criação de personagem com janelas compactas. Seções recebem ilustrações; explicações extensas ficam em detalhes expansíveis. Os comandos e o conteúdo continuam disponíveis.
- Impactos com faíscas, partículas, fragmentos, clarões, anéis de pressão, arcos de socos, defesa, projéteis, transformação e explosões de choque. Os efeitos obedecem ao limite de 320 partículas e 48 eventos simultâneos. Luzes são texturas calculadas uma vez; não há desfoque de tela a cada impacto.
- A exploração inicial e a conversa com Bulma precedem as patrulhas da narrativa. Inimigos ambientais não escolhem um iniciante como alvo nessa etapa; atacar deliberadamente provoca reação. Oponentes de treino e encontros da história mantêm suas regras.

## Rede e controle

Equipes online têm até quatro participantes. O líder convida jogadores próximos,
remove membros ou transfere a liderança. A janela pequena da equipe abre com P,
mostra vida, Ki, localização e distância dos aliados e inclui um chat privado.
Aliados próximos participam dos objetivos de encontros e recebem um bônus de
experiência em abates comuns. Convites expiram, respeitam bloqueios e têm limite
de frequência. Equipes e mensagens não persistem após desconexão ou reinício.

O servidor mantém a autoridade sobre acertos, dano, recursos, colisões e duelos. O navegador apresenta antecipação de movimento usando a mesma função de velocidade, corrige divergências com suavização limitada e interpola os demais personagens. A antecipação não concede dano nem permite atravessar obstáculos no servidor.

O navegador negocia o protocolo `uz-2`. A primeira atualização contém os dados completos; as seguintes enviam diferenças nos campos estáveis e nos personagens. As listas de IDs continuam completas para que desaparecimentos sejam inequívocos. As mensagens de atualização usam o canal confiável e ordenado; a memória do protocolo é nova a cada conexão. Clientes antigos recebem o formato completo.

Entradas de movimento são descartáveis e não se acumulam quando a rede está congestionada. Ações de combate continuam confiáveis. O servidor evita gerar atualizações para uma conexão que já está bloqueada no envio. Posições transmitidas têm precisão de centésimos de unidade. O indicador de ms mede ida e volta; antecipação visual não reduz esse tempo físico.

Defesa usa G e seleção de alvo usa Y. Campos de texto, menus e atalhos com modificadores não disparam ataques. Enter e Espaço em botões preservam a ativação normal desses botões.

## Custos de renderização

- O painel Guerreiro desenha o mesmo boneco animado do mapa com a pose, direção e
  estado atuais; a criação oferece oito poses e giro da câmera. A prévia grande
  mantém o desenho vetorial nítido.
- Golpes corpo a corpo usam folhas de 12 quadros construídas aos poucos a partir
  do boneco ativo, com no máximo 12 folhas em memória. A direção voltada à
  câmera mantém o desenho vetorial para preservar os detalhes do rosto.
- Quadros de mangá em preto e branco usam a aparência do personagem e surgem em
  momentos de técnica, transformação e impacto forte; textos de dano e defesa
  recebem cartões de tinta. Retratos e efeitos têm caches/limites explícitos.
- Cada planeta recebeu motivos de terreno e pontos de aventura próprios no
  cenário contínuo, desenhados em blocos reutilizáveis.
- NPCs observam a repetição de golpes depois do tempo de reação, defendem,
  trocam de flanco, contra-atacam e encadeiam até cinco golpes com recuperação.

- Terreno antigo não é construído quando o cenário contínuo está disponível.
- Desenho do mundo é suspenso na tela inicial, durante as cenas e quando a aba está oculta.
- Grama é desenhada em grupos, preservando o movimento e as flores.
- Caminhos e combinações visuais dos personagens têm caches limitados.
- Rastros têm frequência e quantidade limitadas; remoção da segunda suavização evita atraso visual duplicado.

## Medição local

`node tools/profile-runtime.cjs` mede 120 passos de simulação, com 36 adversários iniciais e atualização a cada dois passos. A exploração cria patrulhas adicionais: essa execução terminou com 49 e 55 adversários, respectivamente. Os jogadores saem da etapa protegida de introdução para incluir encontros e ataques de NPCs. Os números abaixo são de uma execução local e incluem a primeira mensagem completa. Não incluem TLS, distância geográfica, os limites de CPU do Render nem o desenho em dispositivos móveis.

| Jogadores |       Formato completo |        Protocolo novo | Redução de tráfego |
| --------- | ---------------------: | --------------------: | -----------------: |
| 8         | 447,2 KB/s por jogador | 44,2 KB/s por jogador |              90,1% |
| 24        | 631,7 KB/s por jogador | 66,7 KB/s por jogador |              89,4% |

Nessa execução, o custo mediano de simulação e envio com o protocolo novo foi 3,27 ms (8 jogadores) e 12,15 ms (24 jogadores); percentil 95 de 5,83 ms e 18,96 ms. Resultados variam conforme máquina e situação de combate. Estes números não estabelecem capacidade garantida de jogadores no Render.

## Publicação e limites

Publicar frontend e servidor juntos para que o protocolo negociado e o novo movimento estejam disponíveis. Não exige outra variável do Render além das já configuradas para a versão atual. Origem de produção continua explícita: `UZ_ALLOWED_ORIGINS=https://universe-z.onrender.com`.

Ainda é necessário avaliar o deploy real com jogadores em diferentes redes. Zero latência, ausência absoluta de travamentos e capacidade de um MMO de grande escala não são garantias possíveis por uma otimização local. O Render Free suspende serviços sem tráfego por 15 minutos e pode levar cerca de um minuto para voltar: https://render.com/docs/free.

O armazenamento atual do jogo usa arquivos locais. Esses arquivos não são persistentes no Render Free: reiniciar ou republicar pode apagar progresso. Esta entrega não migra o armazenamento para um banco externo.

As cenas utilizam as artes já existentes; não são vídeos 3D pré-renderizados. Esta é uma implementação ampla de apresentação e resposta, e não uma declaração de que o jogo já alcançou a produção e o conteúdo de um lançamento AAA.
