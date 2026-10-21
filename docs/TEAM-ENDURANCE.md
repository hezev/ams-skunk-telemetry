# Equipas e estratégia de endurance

Implementação comum ao Windows e ao portal Web, baseada no trabalho de simplificação do Engineer (`a585349`).

## Utilização

1. Em **Equipa**, criar uma equipa e escolher **Adicionar membro**.
2. Copiar o código e enviá-lo ao piloto pelo canal que preferirem. A aplicação não envia emails.
3. O outro piloto inicia sessão na sua própria conta e escolhe **Aceitar e partilhar telemetria**, em Equipa. O convite expira em sete dias e só pode ser usado uma vez.
4. Ambos passam a consultar as voltas dos membros, filtrar por piloto e abrir **Analisar**. As voltas partilhadas também aparecem na Telemetria, no Engineer e como referências compatíveis no Lap Compare. Sessões com o mesmo identificador em contas diferentes são mantidas separadas.
5. Em **Estratégia**, selecionar a combinação simulador/pista/carro, configurar a corrida e selecionar os pilotos. As setas permitem definir quem começa e a ordem de rotação.
6. Calcular o plano. Cada stint indica piloto, horário, voltas, combustível e jogo de pneus. A paragem anterior indica litros a adicionar, troca de pneus e tempo de boxes.
7. Guardar o plano para a equipa, carregar a última versão ou exportar CSV. Alterar qualquer parâmetro invalida o resultado anterior até novo cálculo.

Cada conta pertence a uma equipa de cada vez, até 16 membros. O responsável gere convites e membros; os restantes membros podem sair. Para o responsável sair, deve dissolver a equipa. A saída/remoção preserva as voltas originais e termina o acesso partilhado no servidor. Exportações anteriores não podem ser recolhidas. Um plano guardado é limpo quando um membro sai ou é removido, para obrigar a rever a escala.

## Cálculo e limites

- Corridas por duração, de 1 minuto a 48 horas. O resultado termina na primeira passagem pela meta após a duração configurada. Não é um otimizador de regulamentos oficiais, fair share, descanso mínimo ou stint máximo contínuo por regulamento.
- Os pilotos alternam pela ordem escolhida, um piloto por stint. A distribuição depende do ritmo, da autonomia e da vida restante dos pneus; não é prometida igualdade de tempo de condução.
- O ritmo sugerido é a mediana das cinco voltas gravadas mais rápidas por piloto, na combinação exata de simulador, circuito/layout registado e carro. Se não existirem voltas, o ritmo é manual. O piloto deve ajustar este valor a um ritmo de corrida sustentável.
- Consumo, depósito útil, combustível de partida, reserva, vida planeada dos pneus e tempos de serviço são introduzidos pelo utilizador. Não se inferem consumo, desgaste ou capacidade a partir de canais ausentes.
- A capacidade de cada stint respeita combustível, reserva, pneus e duração máxima configurada. A vida dos pneus acumula entre stints até à troca; existe também troca em todas as paragens.
- A reserva é mantida em todos os stints. O último reabastecimento considera o tempo dessa própria paragem e acrescenta apenas o necessário para acabar a corrida com reserva. O combustível já existente no depósito é aproveitado.
- Serviço sequencial: soma de refuel, pneus e troca de piloto. Serviço simultâneo: maior desses tempos. A perda na via das boxes é acrescentada em ambos os casos. Não existe troca de piloto quando só um piloto participa.
- Não inclui tráfego, bandeiras, reparações, meteorologia ou consumo variável. Máximo de 5 000 stints por cálculo, com rejeição de parâmetros que não permitam completar uma volta.
- O histórico de equipa mostra até 500 voltas cloud recentes dos colegas, além do histórico próprio já carregado pelo programa e do arquivo local. Não altera a amostragem ou os ficheiros de telemetria.

## Modelo de acesso

`ams_team_private` contém equipas, membros e convites, sem acesso direto por `anon`/`authenticated`, com RLS e políticas de bloqueio. Um convite guarda apenas SHA-256 de um código aleatório de duas UUIDs v4. O código só é mostrado na criação; se for perdido, pode ser cancelado e criado outro.

`public.ams_team(action,payload)` é um RPC `SECURITY INVOKER`, apenas para `authenticated`. As operações privilegiadas ficam em funções do schema privado, com `search_path=''` e validação explícita de `auth.uid()`. Cada alteração é serializada por equipa; a pertença é novamente verificada após adquirir o bloqueio. A autorização consulta membros na base de dados, nunca `user_metadata`.

As políticas SELECT existentes de `ams_laps`, `ams_best_laps`, `ams_pilots`, `ams_live_sessions` e `ams_setup_snapshots` mantêm o acesso próprio e a partilha pública anterior, acrescentando membros da mesma equipa. Não são concedidas alterações/eliminações de dados de outros pilotos. As políticas de escrita não mudam. A partilha de sessões em direto é apenas uma permissão de leitura; o fluxo de captura e os feeds do Live Pitwall/Race Control continuam independentes do arquivo e do planeador.

Planos são guardados na equipa com versão de revisão: uma edição concorrente é recusada, pedindo carregar a versão atual. Apenas os parâmetros são guardados; o resultado é recalculado no cliente. Um plano carregado só aceita pilotos que ainda pertençam à equipa.

O cliente atualiza a pertença a cada 30 s e ao voltar ao separador, além das operações de equipa e das atualizações do arquivo. Ao mudar permissões ou sessão, limpa seleções, caches, gráficos históricos, Engineer e replays; respostas em curso são invalidadas. A telemetria de colegas não fica na cache de detalhes. Perder ligação ao serviço de equipa retira os dados partilhados do interface, preservando o acesso próprio. Os dados da equipa não são persistidos em localStorage.

## Migração e publicação

Migração: `supabase/migrations/20261021093207_team_endurance_sharing.sql`, criada com Supabase CLI 2.121.0. Pré-condição: as cinco tabelas/políticas existentes no projeto `ntjvgeopzxwnstnecuhl` (verificadas antes da implementação).

**Distribuição: publicação Web autorizada em 21 de outubro de 2026; a aplicação Windows é distribuída separadamente.** A migração deve ser aplicada antes de integrar este commit no ramo de produção. A compilação, os cálculos, os testes SQL e os fluxos de browser desta árvore foram validados antes do envio. A verificação inicial remota encontrou 73 voltas, 9 melhores voltas e 1 sessão live; não foram criadas equipas para contas reais durante a implementação. O estado efetivo da publicação pode ser confirmado no histórico GitHub Actions da revisão integrada.

Para lançar: aplicar esta migração como uma única transação pelo fluxo de migrações do Supabase; executar os testes de permissões/snapshot e os advisors; depois publicar o portal e distribuir a nova aplicação Windows. A migração preserva os registos existentes. O cliente mostra indisponibilidade da gestão de equipas enquanto o RPC não existir, sem bloquear as voltas próprias.

Se for necessário recuar, retirar primeiro o interface novo. Preservar as tabelas de equipas/planos e restaurar as expressões SELECT anteriores (próprio, ou próprio/partilhado em `ams_best_laps`; perfil próprio ou com melhor volta pública em `ams_pilots`). Revogar o RPC de equipa se for necessário desativar novas adesões. Não apagar equipas ou planos como parte de um recuo sem decisão explícita sobre esses dados.

## Validação

- PostgreSQL local via PGlite 0.5.8: criação, convite, aceitação, leitura mútua nas cinco tabelas, bloqueio a terceiros, escrita de colegas recusada, tabela privada inacessível, convite expirado/usado/cancelado, remoção/saída, conflitos de planos, acesso anónimo recusado e voltas originais preservadas.
- Motor de stints: 200 cenários variados, conservação de combustível, capacidade/reserva, pneus, rotação, boxes, abastecimento final e casos inválidos.
- Aplicações completas em Edge/Playwright 1.64.1, Windows e Web: equipa/convites, filtros, telemetria, isolamento de sessões por piloto, ordem dos pilotos, plano guardado/carregado/conflito/CSV, PT/EN, ecrã estreito, independência live, resposta antiga depois de remoção e logout.
- Regressão do Engineer completo, testes de autenticação e compilação Release Windows/Web.
- Web: compilação sem avisos. Windows: zero erros, aviso preexistente MSB3277 de WindowsBase/WebView2.
- CI: jobs para as permissões SQL e o fluxo completo nos dois interfaces, além dos testes do motor em cada plataforma. Dependências apenas de teste, com versões e lockfiles fixos.

Comandos a partir da raiz:

```powershell
npm ci --prefix tests/database --ignore-scripts
npm test --prefix tests/database
node tests/integration/endurance-planner.mjs
npm ci --prefix tests/browser --ignore-scripts
# Instalar Chromium com a CLI Playwright antes de executar em Linux/CI.
$env:NODE_PATH=(Resolve-Path tests/browser/node_modules).Path
node tests/integration/team-endurance-workspace.mjs
$env:AMS_APP='web'
node tests/integration/team-endurance-workspace.mjs
```

Não foram corrigidos avisos remotos preexistentes de funções de treinador, proteção de palavras-passe ou schemas de referências, por estarem fora desta alteração. A revisão de segurança remota anterior à migração está identificada para comparação na publicação. A política de leitura acrescentada não autoriza automaticamente ninguém: requer adesão explícita à equipa.
