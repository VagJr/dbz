# Entrega beta 1.0 — operação e lançamento

Estado em 27/09/2026: candidata local a testes, versão `1.0.0-beta.1`. Não publicada e sem pagamentos. A entrega reúne combate revisado, dojo, três expedições de duas ondas, coleção de seis cosméticos conquistáveis, Central ilustrada, controles de conta e base de segurança. Preserva campanha persistente de 28 capítulos, 19 destinos, inventário ilustrado, fabricação, equipamentos, construção e mercado existentes. Não equivale a um MMO completo certificado para venda.

## Validação desta entrega

- Revisão do ritmo de combate: 130 testes passaram antes do acabamento visual final; ver detalhes em `combat-beta.md`.
- Validação anterior da beta: 111 testes passaram: combate, progressão, economia, sincronização, isolamento de dados, recuperação de conta, origem de conexão, falha de salvamento e operação offline.
- Central com sete seções: desktop 1440×900, celular 390×844, paisagem 844×390, compacto 360×640; navegação, coleção, equipamento cosmético, recuperação e relato passaram sem erros de página ou recursos ausentes.
- Dojo testado em navegador: preparação, disparo físico e encerramento em desktop, celular vertical, paisagem e tela compacta. HUD móvel revisado após inspeção das capturas.
- Carga sintética local: 12 clientes, três mundos, 94 inimigos, 20 s, sem erros. Tempo amostrado de simulação p95 10,25 ms, máximo 13,85 ms; HTTP p95 12,84 ms. Média de snapshot 13.397 bytes e aproximadamente 200 KB/s por cliente. São medidas desta máquina e cenário; a banda ainda precisa de otimização e teste WAN. O limite configurável de jogadores não é capacidade certificada.

Relatórios reproduzíveis em `.preview-data/beta/`: `report.json`, `combat-report.json`, `load-report.json` e `final-tests.log`. Capturas de Conta contêm somente a tela anterior à geração de código; não publicar dados de testes sem revisão. As verificações criam mundos isolados, sem usar saves reais.

## Revisão de ritmo e duelos

Golpes agora têm preparação e recuperação reais; defesa usa novo pressionamento, combos exigem acerto confirmado e há ruptura defensiva limitada. Duelo por convite equaliza vida/dano e restaura o personagem. A abertura e os indicadores seguem a campanha persistente. A câmera e as poses tornam as fases mais legíveis. Esta revisão não certifica equilíbrio esportivo: faltam sessões humanas e testes WAN; não há rollback, ranking ou matchmaking competitivo.

## Jogar e testar

`npm start` e abrir `http://localhost:25565`. Pouse perto de um mestre e abra Central → Dojo. O guia de regras e referências está em [combat-beta.md](combat-beta.md).

- `npm test`: suíte completa.
- `npm run check:beta`: fluxos de interface em quatro telas.
- `npm run check:rhythm`: história atual, duelo e controles por clique/toque.
- `npm run check:combat`: dojo e sinais visuais em quatro telas.
- `npm run test:load`: carga local de 12 clientes por 20 segundos.
- Navegador de teste: Playwright e Edge; `UZ_PLAYWRIGHT_PATH` permite indicar outra instalação do módulo.

## Controles de segurança implementados

Servidor decide dano, progressão, posse, consumo e transferências. Sessões usam chaves aleatórias de 256 bits, armazenadas como hash no servidor. Recuperação gera um código privado de uso único, guarda apenas seu hash e troca a chave da sessão ao recuperar, desconectando o acesso antigo. Exportação de progresso exclui material de autenticação. O navegador ainda guarda uma chave bearer em armazenamento local: XSS ou acesso ao dispositivo pode comprometê-la. Não há MFA, login por e-mail ou expiração periódica de sessão.

Produção exige lista de origens HTTPS exatas; conexões WebSocket passam pela mesma validação de origem. Há limite de 4 KB por mensagem, cotas por conexão/IP, tempo máximo para autenticar, limite de jogadores, cabeçalhos de segurança e CSP. Isso não é proteção completa contra DDoS, bots ou automação. Referências: [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) e [Socket.IO: CORS e allowRequest](https://socket.io/docs/v4/handling-cors/).

Checkpoint v2 contém mundo e contas juntos, checksum de integridade, escrita temporária sincronizada e renomeação. Salvamentos concorrentes são serializados. Falha de gravação pausa a simulação e faz `/health` responder 503 até a persistência voltar. `server.lock` impede dois escritores; checksum inválido impede carregamento. Há cópia anterior local, mas não restauração automática. Isso detecta corrupção acidental, não adulteração por quem já controla o servidor; não substitui banco transacional, backup externo ou teste de falha de hardware.

Comunidade oferece silêncio de chat e relatos limitados. Auditoria registra metadados resumidos de ações sandbox/beta; não é um ledger financeiro completo. O operador revisa relatos e suspensões offline. Não há moderação humana 24 horas, filtro infalível de abuso ou administração distribuída.

## Operar uma beta restrita

Configure no ambiente, sem versionar segredos: `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT`, `DATA_DIR` absoluto, `UZ_ALLOWED_ORIGINS=https://seu-dominio`, `UZ_BETA_INVITE` e `UZ_MAX_PLAYERS`. Use TLS em proxy reverso. Sem esse proxy a porta local não oferece HTTPS.

Atrás de proxy, configure `UZ_TRUSTED_PROXY_IPS` com endereços exatos controlados pelo operador. O proxy precisa sobrescrever `X-Real-IP` com o endereço da conexão recebida, nunca repassar um cabeçalho arbitrário. Sem proxy confiável configurado, cabeçalhos encaminhados são ignorados. Restrinja acesso direto à porta de origem. Para testar celular na rede local, adicione a origem exata usada no navegador a `UZ_ALLOWED_ORIGINS` em desenvolvimento.

Com o servidor desligado e `DATA_DIR` apontando ao mundo correto:

```
npm run ops -- status
npm run ops -- reports
npm run ops -- backup
npm run ops -- resolve <UUID-do-relato> reviewed "Motivo da resolução"
npm run ops -- suspend <UUID-do-cidadão> 24 "Motivo da suspensão"
npm run ops -- resume <UUID-do-cidadão> "Revisão concluída"
```

As operações recusam diretório sem checkpoint e recusam lock ativo. Não use tokens privados como identificadores de moderação. Proteja diretório, backups e relatórios com permissões do sistema operacional. Se houver lock após uma queda, confira PID e processo antes de remover somente aquele arquivo; não remova lock de instância ativa.

Para recuperação, pare o servidor, preserve uma cópia do diretório atual e escolha um checkpoint de backup cuja integridade tenha sido verificada numa pasta de teste. Restaure contas e mundo juntos. Nunca substitua apenas os espelhos `profiles.json`/`world.json`. Teste a restauração isolada antes de apontar produção; rollback pode reverter transações e exige comunicação aos participantes.

## Portões ainda necessários antes de abertura pública/comercial

- [x] Combate, dojo, navegação e sistema cosmético integrados e testados.
- [x] Recuperação de acesso, limite de origem/mensagens, lock e checkpoint verificado.
- [x] Relatos e ferramentas offline de revisão, suspensão e backup.
- [ ] Sessões humanas de balanceamento, onboarding e acessibilidade; cobertura de retratos ainda parcial.
- [ ] Auditoria das licenças de personagens, marcas, imagens, músicas e demais arquivos; autorização dos titulares ou substituição por propriedade original.
- [ ] Operador responsável, contato de suporte, termos, política de privacidade, retenção/exclusão e atendimento definidos. O relato de exclusão é uma solicitação manual, não exclusão automática.
- [ ] Hospedagem, TLS, monitoramento, limites de proxy e alertas exercitados no destino real.
- [ ] Testes prolongados, rede adversa, backup externo e restauração comprovada.
- [ ] Revisão independente de segurança, exploração econômica e capacidade de rede.
- [ ] Se houver venda futura: provedor de pagamento, recibos, tributos, suporte, reembolso, webhooks autenticados e idempotentes, conciliação e estorno testados.

A adaptação comercial de propriedade de terceiros requer análise e autorização adequadas; a existência de outro fan game não concede esses direitos. Consulte os titulares e assessoria jurídica antes de venda/publicação comercial. Referência legal brasileira: [Lei 9.610, art. 29](https://planalto.gov.br/ccivil_03/leis/l9610.htm). Pagamentos permanecem desativados; nenhuma certificação de segurança, autorização de marca ou implantação pública foi criada nesta entrega.

