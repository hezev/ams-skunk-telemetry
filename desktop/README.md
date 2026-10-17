# AMS Skunk Telemetry — Windows Desktop (preview)

Aplicação WinForms com Microsoft Edge WebView2 que executa os mesmos recursos HTML/CSS/JS de `wwwroot`, embutidos no output da aplicação. Não é um atalho para o website: a interface é distribuída localmente.

## Compilar em Windows
1. Instalar .NET 10 SDK e Microsoft Edge WebView2 Runtime.
2. A partir da raiz do repositório: `dotnet publish desktop/AMSSkunkTelemetry.Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o artifacts/windows`
3. Executar `artifacts/windows/AMS.Skunk.Telemetry.exe`.

## Comportamento e limites
- Todos os recursos de `wwwroot` são copiados junto ao .exe, inclusive a lógica de autenticação Supabase, mapas e páginas.
- Os dados históricos e Live Pitwall exigem rede e permissões de acesso à mesma base Supabase.
- O login usa armazenamento local WebView2 no perfil Windows, independente do login guardado no navegador web.
- Esta primeira fase **não** inclui captura direta da API iRacing nem atualização automática ou instalador assinado.
- Para testar, consultar o workflow **Windows Desktop Preview** no GitHub Actions e descarregar o artefacto Windows.
- OAuth/links externos requerem verificação de redirecionamentos permitidos na configuração de autenticação Supabase.
- Nunca embutir a chave Supabase service_role no cliente.
