# AMS Skunk Telemetry

Portal web de telemetria do ecossistema AMS, preparado para dados históricos e Live Pitwall.

## Stack
- ASP.NET Core
- HTML / CSS / JavaScript
- Supabase Auth / Postgres / Realtime (integração preparada)

## Executar no Visual Studio
1. Clonar o repositório.
2. Abrir `AMSSkunkTelemetry.csproj`.
3. Executar com HTTPS.
4. O portal abre em `wwwroot/index.html`.

## Estado
Fase 1: interface funcional com dados simulados.
Próxima fase: integração com o Supabase do AMS Telemetry.

> Nunca colocar a Supabase service_role key no frontend ou no repositório.
