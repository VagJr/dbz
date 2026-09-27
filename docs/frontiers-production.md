# Fronteiras — composição e combate

Entrega de 27/09/2026, preservando os sistemas sandbox e os perfis existentes.

## Aplicado

- 19 perfis planetários explícitos: tipos de local, flora, rochas, regiões e presença/traçado de rios. Planetas áridos, arena e domínios celestes não repetem o rio terrestre.
- 12 composições: reserva, pomar, desfiladeiro, barreira militar, mina, ruínas, mercado, dojo, nave abatida, fortaleza, santuário e expedição. Seleção determinística por coordenadas. Ruínas usam colunas/portais quebrados; fortalezas usam paredes, barreiras e instalações; mercados usam barracas e vias abertas.
- Tropas de zero a sete unidades, formações, papéis, níveis e elite. Nenhum encontro procedural dentro da zona inicial protegida. Tropas deslocadas quando coincidiam com props.
- Cadência de ataques leves de 0,28 s; finalizador 0,5 s; pesado 0,62 s. Buffer de 0,32 s. Defesa precisa e contra-ataque existentes preservados. Perseguição após finalizador custa 22 ki e tem intervalo de 2,8 s.
- IA com reação atrasada, guarda direcional, quebra e regeneração de guarda, flancos, afastamento de atiradores feridos, retorno de patrulha e proteção contra atordoamento infinito. Ataques comprometidos têm recuperação de 0,5 a 0,85 s e recebem 20% de dano adicional nessa abertura.
- Campanha persistente ampliada de 22 para 28 capítulos: androides, Cell, Babidi, Buu e epílogo. Migração para quem já terminou Namek. Três chefes adicionais com fases. Recompensas preservadas contra repetição.
- Conversas de missão apresentadas em cenas ilustradas, com avanço/pulo. Retratos gerados de 12 personagens, 627 × 627 por retrato, instalados no projeto. Recortes de Goku e Cell revisados. As imagens são geradas para o fan game, não arquivos oficiais licenciados.
- Retratos ligados à seleção, HUD, painel de personagem, alvos disponíveis e cenas. A criação mantém a prévia da aparência personalizada separada do retrato representativo da origem.
- Inventário ilustrado e equipamento preservados; seleção de slots vazios corrigida. Ajuste de sobreposição do criador no celular. Detalhes animados por categoria/índice de prop, com movimento reduzido respeitado.

## Verificação

- `npm test`: 89 testes passaram.
- `node tools/check-sandbox.cjs`: personalização, coleta, fabricação, equipamento e oito seções em 1440×900, 390×844, 844×390 e 360×640, sem erros de navegador.
- `node tools/check-frontiers.cjs`: cinco composições e cena de diálogo em desktop e celular, sem erros de navegador. Capturas em `.preview-data/frontiers`.
- Teste da continuação percorre os seis capítulos novos, encontros, recompensas e restauração do epílogo. Não substitui balanceamento por sessões de jogadores.

## Limites que permanecem

Esta entrega não certifica um MMO AAA completo. Os 19 perfis estão configurados e cobertos pelo teste de renderização; a revisão visual detalhada desta rodada amostrou cinco composições em Terra/Namek. A biblioteca de 784 sprites continua disponível, mas nem cada desenho recebeu uma função e animação artesanal exclusiva. Doze retratos não cobrem todo o elenco: os demais mantêm a ilustração vetorial existente. As campanhas são adaptações jogáveis resumidas, não reprodução integral de todas as sagas; a reescrita editorial de todos os diálogos, infraestrutura massiva e balanceamento prolongado permanecem no checklist.

Nenhuma skill instalada chamada world generator foi encontrada. A composição foi feita no gerador determinístico existente, sem instalar plugins ou gerar novos assets após a solicitação de encerramento rápido.

## Referências de combate

O guia oficial de Sparking! ZERO descreve encadeamentos, ataques carregados, perseguição e respostas defensivas. Foram adaptados como princípios de leitura e gasto de recursos à câmera atual, sem copiar o sistema inteiro: https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-combos-and-features

A distinção entre ações básicas, ki e mobilidade também foi conferida no guia introdutório: https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-the-beginners-guide
