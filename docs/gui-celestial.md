# Universe Z — GUI Celestial

Nova apresentação aplicada à entrada, HUD de combate, navegação, Atlas, Crônicas, Guerreiro, Ajustes, ajuda, tutorial, diálogo e feedback. `public/index.html` carrega a base `style.css` e a composição `universe-ui.css`; as quatro camadas visuais anteriores não são mais carregadas pelo jogo.

## Direção

Cenário contínuo, títulos condensados, âmbar para ações e objetivos, ciano para navegação. O HUD reserva o centro ao mundo; as habilidades usam ilustrações completas com atalhos e nomes fora da área da arte. Painéis em desktop têm cenário lateral e conteúdo rolável; no celular tornam-se painéis inferiores. Movimento reduzido desativa animações da GUI, tanto pela preferência do sistema quanto pelo ajuste do jogo.

Referências de direção (sem importar assets desses jogos):
- [Dragon Ball: Sparking! ZERO — apresentação oficial](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-gameplay-showcase): energia do combate e hierarquia de leitura.
- [Zenless Zone Zero — site oficial](https://zenless.hoyoverse.com/en-us/main): identidade gráfica expressiva, contraste e resposta visual.

## Arte existente

As três pranchas originais foram preservadas. `tools/slice-ui-kit.ps1` particiona as linhas nas faixas de menor opacidade próximas aos intervalos observados, mantém pixels na escala original e centraliza cada célula em uma superfície transparente. Não corta círculos nem estica os ícones. As 49 peças de combate e as 49 de HUD têm 208 × 208; as 49 peças de menu têm 224 × 224 para preservar a última linha mais alta. `slice-map.json` registra os retângulos de origem.

As 49 ilustrações de combate incluem técnicas, estados, ações e itens; sua presença no acervo não adiciona 49 técnicas ao sistema de combate. A interface continua vinculada ao catálogo real de técnicas implementadas.

## Inspeção e verificação

A inspeção visual foi recuperada com Microsoft Edge/Playwright, usando o runtime local e capturas no disco. O navegador integrado e os leitores de arquivo do ambiente isolado falharam na inicialização; o caminho alternativo permite capturar, enxergar e testar o jogo real.

`tools/check-celestial.cjs` inicia um servidor temporário com dados isolados em `.preview-data/celestial`, abre o jogo em desktop, celular, paisagem e tela compacta e percorre seus painéis. Capturas e relatório ficam nessa pasta. O script usa o Playwright do runtime do Codex; o caminho pode ser configurado por `UZ_PLAYWRIGHT_PATH`.

Também foram corrigidas falhas preexistentes que a navegação visual expôs: máscara de recarga ausente em botões, variável indefinida na galeria de personagens e índice indefinido na geração dos planetas do Atlas.

### Resultado da revisão

- 70 testes existentes aprovados.
- Navegação e capturas verificadas em 1440×900, 390×844, 844×390 e 360×640.
- Sem erros de JavaScript nas quatro sessões; sem estouro horizontal nos painéis.
- Seleção das quatro origens, 19 destinos do Atlas, galeria de 136 personagens, movimento reduzido, alvo e ataque exercitados no navegador.
- Todas as sete ações de combate visíveis junto aos quatro botões de navegação, sem interseção entre seus retângulos.
- Movimento real pelo joystick confirmado no servidor em 360×640 e 844×390.

Prévia local: http://localhost:25565. Nenhuma publicação externa foi realizada.
