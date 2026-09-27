# Checklist de produção — Universe Z sandbox MMO

Estado em 27/09/2026. `[x]` significa funcional na base atual com escopo descrito, e não certificação de qualidade AAA ou capacidade massiva. `[ ]` significa pendente. Uma categoria ampla só está completa quando seus requisitos de aceitação forem atendidos. A expansão desta entrega está em `shared/sandbox.js`, `src/sandbox.js`, `public/sandbox-ui.js` e `public/sandbox-ui.css`.

## Ciclo sandbox entregue

- [x] Inventário ilustrado com itens básicos, 196 equipamentos e 196 peças de mobiliário, capacidade de 120 unidades e validação no servidor.
- [x] Três recursos distribuídos por coordenadas, visíveis e coletáveis na superfície.
- [x] Regeneração compartilhada de depósitos; uma coleta não paga a dois jogadores.
- [x] Coleta com duração, distância máxima e cancelamento por movimento/dano.
- [x] Oito receitas básicas e catálogos de equipamento/mobiliário com consumo de materiais apenas ao concluir.
- [x] Prática de fabricação e requisitos de oficina para produção avançada.
- [x] Cápsulas medicinais e energéticas; intervalo de uso preservado ao reconectar.
- [x] Abrigo para recuperação de vida e ki.
- [x] Oficina portátil para desbloquear receitas próximas.
- [x] Viveiro com colheita e regeneração própria.
- [x] Câmara gravitacional com gasto de ki e prática de atributo.
- [x] Farol que cartografa a região e recupera ki.
- [x] Construções persistentes, públicas para uso e recolhíveis apenas pelo proprietário.
- [x] Limites de oito construções por personagem e mil por mundo salvo.
- [x] Distância entre construções e proteção da proximidade dos mestres.
- [x] Caminhos de explorador, inventor e guardião com benefícios funcionais.
- [x] Meditação e escolha de foco entre força, espírito e vitalidade.
- [x] Cartografia com recompensa única por região, limitada a 500 registros por personagem.
- [x] Três contratos de entrega no mestre; recarga persistente de cinco minutos.
- [x] Projeto coletivo por planeta, quatro níveis e benefício real nos abrigos.
- [x] Mercado por planeta com preço total explícito e itens retirados ao anunciar.
- [x] Compra única, verificação de espaço/moeda e devolução ao cancelar oferta.
- [x] Receita do vendedor guardada mesmo offline e resgatável uma vez.
- [x] Diário dos últimos 25 acontecimentos do ciclo sandbox.
- [x] Marco de legado com requisitos verificáveis e prêmio não repetível.
- [x] Personagens e economia mundial salvos num checkpoint conjunto.

## Experiência e controles

- [x] HUD ilustrado, arte proporcional e telas adaptadas a desktop/celular da revisão visual.
- [x] Oito áreas sandbox acessíveis por botões e teclado.
- [x] Ação contextual próxima mostra o que será coletado ou usado.
- [x] B abre o painel; N interage; celular possui botões equivalentes.
- [x] Menu sandbox bloqueia movimentação e ataques do teclado.
- [x] Progresso de atividade, botão de cancelamento e retorno de interrupção.
- [x] Objetos de coleta e construções desenhados no terreno.
- [ ] Indicadores direcionais persistentes para objetos fora da tela.
- [ ] Remapeamento de todos os comandos e perfis por dispositivo.
- [ ] Controle físico, navegação integral por teclado e foco revisado.
- [ ] Ajustes de escala de texto, contraste e cores sem depender só de tonalidade.
- [ ] Leitor de tela para os fluxos principais e alternativa ao combate visual.
- [ ] Animações próprias de coleta, produção e uso de cada estrutura.
- [ ] Arte exclusiva e áudio contextual para cada objeto sandbox.
- [ ] Revisão artística de todas as telas, formas, escalas e recortes em aparelhos reais.

## Combate e evolução

- [x] Base existente de combo, golpe carregado, esquiva, guarda, parry e técnicas.
- [x] Inimigos com papéis de combate e sinalização de ataques na base atual.
- [x] Poder, níveis, atributos, transformações e progresso salvos na base atual.
- [ ] Inventário de equipamentos equipáveis, efeitos, desgaste e comparação.
- [ ] Domínio individual de técnicas e árvores de especialização equilibradas.
- [ ] Implementar e testar cada técnica prometida pelo catálogo artístico: 49 ilustrações não são 49 mecânicas.
- [ ] Duelo consentido e sparring com regras próprias, saída e recompensa sem exploração.
- [ ] Ensino por jogadores, escola e vínculo mestre–aluno.
- [ ] Curva racial completa, formas canônicas produzidas e custos legíveis.
- [ ] Papéis de cura, suporte, controle e proteção equilibrados em grupo.
- [ ] Fusão entre dois jogadores com consentimento, desconexão e restauração segura.
- [ ] Reencarnação, herança e morte com consequências explicitamente escolhidas.
- [ ] Torneios com inscrição, chaveamento, espectador e resolução de desistência.
- [ ] Balanceamento instrumentado: tempo para vencer, recursos, taxas de vitória e disparidades.

## Mundo, narrativa e liberdade

- [x] Destinos, viagem orbital, terreno procedural, mestres e saga existentes preservados.
- [x] Novas profissões e infraestrutura funcionam fora do combate.
- [ ] Catálogo canônico com escopo editorial definido para Dragon Ball, Z e demais fases desejadas.
- [ ] Planetas com biomas, assentamentos e arquitetura próprios, além da geração repetida.
- [ ] Interiores exploráveis e construção livre com colisão de terreno.
- [ ] NPCs persistentes com relações, agendas, memória e escolhas consequentes.
- [ ] Missões ramificadas com negociação, fuga, ajuda e combate como soluções diferentes.
- [ ] Facções, reputação separada, crimes, reconciliação e limites contra assédio.
- [ ] Ecologia econômica: fontes, consumo, transporte e recuperação de regiões.
- [ ] Destruição e reconstrução integradas a assentamentos e NPCs.
- [ ] Busca mundial das esferas, desejos com escopo definido e competição justa.
- [ ] Eventos sistêmicos com início, sinais, participação, resolução e efeitos persistentes.
- [ ] Endgame cooperativo com mecânicas autorais e novas composições de equipe.

## Comunidade e economia de produção

- [ ] Amigos, grupos, convites, saída, reconexão e liderança transferível.
- [ ] Organizações com cargos, permissões, tesouro e histórico de alterações.
- [ ] Comércio presencial com confirmação bilateral e cancelamento ao alterar a oferta.
- [ ] Chat local/de grupo, bloqueio, denúncia e moderação com registro.
- [ ] Custódia de itens de organizações e política de recuperação.
- [ ] Auditoria de cada operação econômica e análise de criação/destruição de moeda.
- [ ] Custo de manutenção ou outros mecanismos econômicos testados com dados reais.
- [ ] Proteções contra bots, múltiplas contas abusivas e automação de progressão.
- [ ] Ferramentas para criar eventos, NPCs e conteúdo sem editar o motor.

## Infraestrutura de MMO e operação

- [x] Simulação autoritativa e sincronização entre clientes na base local.
- [x] Comandos sandbox validados por distância, estado, quantidade e capacidade.
- [x] Identidade persistente para propriedade independente da conexão.
- [x] Migração de perfis antigos para o checkpoint conjunto ao salvar.
- [ ] Banco transacional, migrações versionadas completas e recuperação após falha de disco.
- [ ] Autenticação recuperável, gestão de sessões, proteção de contas e TLS de produção.
- [ ] Divisão de mundo entre processos com transferência consistente de personagens.
- [ ] Interesse espacial e carga de rede medidos sob simultaneidade elevada.
- [ ] Testes de carga com meta explícita de concorrência, memória e latência.
- [ ] Testes de longa duração, latência alta, perda de pacotes e quedas de processo.
- [ ] Backups externos e exercício comprovado de restauração.
- [ ] Observabilidade, alertas, administração, auditoria e rollback de incidentes.
- [ ] Processo de publicação, rollback de versão e política de compatibilidade de saves.
- [ ] Revisão de segurança, privacidade e operação antes de lançamento público.

## Critério para chamar de completo

O jogo só deve ser apresentado como MMO sandbox completo depois de fechar os itens aplicáveis acima, definir a cobertura de conteúdo e demonstrar a carga esperada. Hoje ele é uma base multiplayer com uma expansão sandbox funcional. O checkpoint local reduz inconsistências de salvamento, mas não substitui um banco transacional nem garante durabilidade em toda falha de hardware.

## Executar e verificar

`npm test` executa as regras e integração de rede. `node tools/check-sandbox.cjs` abre um servidor isolado e valida coleta → fabricação, navega pelas oito telas e captura desktop 1440×900, celular 390×844, paisagem 844×390 e compacto 360×640. Exige Playwright e Edge; `UZ_PLAYWRIGHT_PATH` permite indicar a instalação. Dados desse teste ficam em `.preview-data/sandbox`, separados dos perfis reais.

Ao migrar ou fazer backup, preserve **checkpoint.json**: ele passa a ser a fonte principal conjunta de personagens e mundo. Os arquivos profiles.json e world.json continuam sendo escritos para compatibilidade. Para importar manualmente saves legados, faça uma migração controlada; editar apenas os arquivos antigos não sobrescreve um checkpoint existente.

## Revisão beta de 27/09/2026

Esta lista histórica continua registrando requisitos amplos ainda não concluídos. O estado verificado desta entrega está em [beta-release.md](beta-release.md): composição específica dos 19 mundos, combate por utilidade, recuperação de conta, relatos/moderação offline e carga local de 12 clientes já foram acrescentados. Os requisitos agrupados acima (TLS real, escala alta, chat de grupo, banco transacional e operação pública) permanecem pendentes.
