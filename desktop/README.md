# AMS Skunk Telemetry — Windows Desktop (preview)

Aplicação Windows .NET 10/WinForms/WebView2. O MESMO programa inclui a interface web e os serviços nativos de aquisição de telemetria. Não utiliza o antigo coletor Windows, processos bridge ou um servidor local separado.

## Primeira integração direta: iRacing
- Abre a memória partilhada nativa `Local\\IRSDKMemMapFileName`, lê o catálogo de variáveis e todos os canais exportados pela sessão iRacing, incluindo arrays `CarIdx*` (outros carros).
- Grava localmente os canais brutos, em amostras com timestamps, comprimidos em `.jsonl.gz` em `%LOCALAPPDATA%\\AMS\\SkunkTelemetry\\Sessions`. Guarda o bloco de informação da sessão (YAML) junto à gravação. A utilização de disco cresce com a duração das sessões.
- Normaliza os campos usados no Dashboard/Telemetry/Compare e Pit Wall. Campos que o simulador não publica ficam ausentes; não são inventados.
- Publica um snapshot Live por segundo, com a grelha de participantes, em `public.ams_live_sessions` via REST Supabase usando o JWT do piloto autenticado e as policies RLS existentes.
- Quando uma volta termina, envia uma série de telemetria reduzida e compatível com `public.ams_laps`, respeitando o limite de ~2 MiB por volta; os dados brutos completos permanecem localmente.
- O website foi preparado para expandir `ams_live_sessions.drivers` em pontos de mapa e classificação, sem criar contas para os adversários.

## Compilar no Windows
1. Instalar .NET 10 SDK e Microsoft Edge WebView2 Runtime.
2. `dotnet publish desktop/AMSSkunkTelemetry.Desktop.csproj -c Release -r win-x64 --self-contained true -o artifacts/windows`
3. Executar `artifacts/windows/AMS.Skunk.Telemetry.exe`, entrar na conta de piloto, iniciar o iRacing.
4. O GitHub Actions **Windows Desktop Preview** também produz um artefacto win-x64 descarregável em cada atualização desta branch.

## Arquitetura para outros simuladores
`ISimulatorAdapter` é a interface de integração. Cada simulador requer um adaptador para o protocolo próprio (shared memory, UDP, plugins oficiais); não existe um protocolo único que publique todos os canais em todos os simuladores. O suporte nativo iRacing é o primeiro; outros simuladores ainda não estão implementados.

## Limites desta preview (trabalho por validar)
- Foi compilada por GitHub Actions, mas ainda não houve ensaio end-to-end numa instalação iRacing real. A integração deve ser testada com uma sessão do jogo.
- Sem instalador assinado e atualizações automáticas nesta fase.
- Se ficar offline, as gravações brutas permanecem no computador; o reenvio automático das voltas pendentes ainda não está implementado.
- Não é enviado o stream bruto 60 Hz para a BD: o site recebe o Live agregado e as voltas reduzidas para a API atual. Upload futuro do stream bruto completo exigirá um bucket privado com partições, retenção e permissões adequadas.
- Outros carros só têm as variáveis que o SDK realmente expõe (posição, volta, tempos, etc.); não existe acesso aos seus canais de pedal, temperatura de pneus, etc. caso o simulador não os forneça.
- A tabela Live está protegida por RLS: cada piloto lê e publica o seu próprio registo. A visualização abrangente por treinadores necessita autorização explícita adequada na BD e ajuste da consulta do portal; não abrir a tabela a todos.
- Links externos e OAuth podem exigir configuração do URI de callback específico para desktop. O login simples Supabase já existe na interface web.
- Nunca expor `service_role` ou chaves secretas na aplicação.

## Estado
Código na branch `feature/windows-desktop-app` / PR #99. Não há publicação automática do site em produção nem merge até validação.
