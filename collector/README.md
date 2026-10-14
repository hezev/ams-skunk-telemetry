# AMS Collector — iRacing · Fase 1

**Aplicação Windows autónoma**, separada de AMS Telemetry e do portal `www.skunk.pt`. Por agora, a única origem é o **iRacing SDK**.

### Implementado
- Leitura nativa de `Local\\IRSDKMemMapFileName` com polling nominal de **60 Hz**, capturando apenas novos ticks;
- Preservação de **todos os canais que o SDK disponibilize e que possam ser descodificados**, incluindo arrays `CarIdx`, nomes, tipos e unidades, sem preencher artificialmente canais ausentes;
- Metadados de sessão, carro, pista e layout extraídos de `SessionInfo`;
- Gravação local **offline-first**, sem perda intencional de precisão: blocos JSONL comprimidos em gzip e manifesto de canais/ticks, com ficheiros atómicos;
- Testes unitários e cross-build Windows x64. Nenhuma base de dados ou instalação existente é alterada.

### Compilação
```bash
cd collector
go test ./...
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o AMSCollector.exe ./cmd/amscollector
```

No Windows, com iRacing iniciado:
```powershell
.\AMSCollector.exe
.\AMSCollector.exe -output "D:\AMSData"
```

Pasta padrão: `%LOCALAPPDATA%\AMSCollector\sessions\...`

**Limitações honestas:** Esta fase é uma aplicação de consola sem instalador, interface gráfica ou sincronização Supabase. Não foi validada ainda numa sessão iRacing real. Não é o programa antigo v5.12.17. O executável de teste não é assinado nem certificado.

### Próxima fase
- Normalização versionada das variáveis para os canais de `www.skunk.pt` **sem eliminar a origem bruta**;
- Fila SQLite e sincronização idempotente por piloto via Supabase Auth, Storage e Postgres, sem `service_role`;
- Live Pitwall em 2–5 Hz, mantendo a captura local com até 60 Hz;
- Interface Windows, instalador e atualização; testes de dados reais para Telemetry, Compare, Engineer, mapas 3D e Pitwall.

A futura integração de outros simuladores será feita por adaptadores independentes.
