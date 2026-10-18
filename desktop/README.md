# AMSports Skunk Telemetry v6.0 — Windows (pré-visualização)

Versão: **6.0.1**. Projeto desktop .NET 10 / WebView2 com interface local, gravação e serviços de aquisição integrados no próprio processo — sem coletor Windows ou servidor bridge separado.

## Funcionalidades novas (v6)
- Team e Settings desktop baseados no programa AMSports Telemetry v5.2.25.
- Settings: AMSports Mobile (QR, PIN, IP, porta, dispositivos), Diagnóstico, Conta AMS, Unidades, Vídeo/OBS, Privacidade e Atualizações.
- Mobile Android: serviço in-process Kestrel, `http://IP:PORT/stream?pin=PIN` com Server-Sent Events, portas 8181–8190. Desativado de fábrica; ativar em Settings > AMSports Mobile. A porta poderá precisar de regra de firewall.
- iRacing: leitura nativa da memória IRSDK, todos os canais disponíveis, gravação completa em ficheiros locais comprimidos.
- Assetto Corsa: integração inicial da memória physics/graphics/static.
- F1 24/25: integração inicial via UDP 127.0.0.1:20777 e arquivo dos pacotes brutos, sem coletor externo.
- Supabase: publicação Live em frequência reduzida e voltas concluídas a partir da conta autenticada, seguindo RLS.
- Ícone .ico personalizado embutido no executável Windows; fonte do desenho em `scripts/build_v6_icon.py`.

## Compilar (Windows)
1. Instalar .NET SDK 10, Microsoft Edge WebView2 Runtime, Python 3 e Pillow.
2. Da raiz do repositório, executar `python scripts/build_v6_icon.py`.
3. Executar `dotnet publish desktop/AMSSkunkTelemetry.Desktop.csproj -c Release -r win-x64 --self-contained true -o artifacts/windows`.
4. Abrir `artifacts/windows/AMS.Skunk.Telemetry.exe`.
5. Em Settings > AMSports Mobile, ativar o serviço e ler o QR com o Android.

O workflow **Windows Desktop Preview** gera o ZIP com executável e dependências, sem exigir compilação manual.

## Limites conhecidos
Esta é uma preview compilável, ainda sem teste real end-to-end dos simuladores e Android. O OBS oferece apenas verificação do endpoint local; gravação automática não migrada. Unidades convertidas parcialmente. Gestão Team/Coach continua sujeita às políticas RLS existentes. Sem canal de atualização automática assinado nem instalador comercial nesta versão. Ver `docs/V6_0_DESKTOP_MIGRATION_AUDIT.md`.

Nunca embutir chave Supabase service_role ou segredos administrativos num cliente público. Não colocar o serviço Mobile diretamente na Internet.
