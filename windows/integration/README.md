# Integração nativa iRacing CarSetup — v40

## Estado

Este diretório fornece **código Go compilável e testado**, preparado para ler `CarSetup` de `SessionInfo` na memória partilhada do iRacing e enviar o snapshot para `public.ams_setup_snapshots` no Supabase, com a sessão autenticada do piloto e RLS. Foi construída uma **prova de integração** a partir do código-fonte da versão **AMSports Telemetry v5.2.8** recuperado da Biblioteca: `GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build .` passou. A versão Windows de referência do utilizador é **v5.12.17**, cujo código-fonte não está neste repositório nem disponível na Biblioteca. **Não foram alterados a versão v5.12.17 instalada, o pacote Microsoft Store nem o sistema de atualização.** Não há prova de teste em sessão real iRacing Windows.

## Código e testes

- `windows/garagecapture/capture.go`: lê cabeçalho irsdk, extrai apenas a árvore YAML `CarSetup`, preserva escalares e unidades e cria UUID determinístico por carro/pista/sessão/conteúdo; rejeita dados incompletos/ambíguos.
- `windows/garagecapture/upload.go`: POST HTTPS com `Bearer` normal da conta piloto e chave **publicável**, sem service_role; `on_conflict=pilot_id,client_capture_id` evita duplicados.
- `windows/garagecapture/capture_test.go`: testes de tamanho/offset da memória, estrutura do YAML, valores/unidades, deduplicação, isolamento entre sessões, autenticação e upload TLS.
- `windows/integration/ir_garage_windows.go.example`: ponte de integração contra estruturas verificadas do código nativo Go **v5.2.8**; é intencionalmente um exemplo e não é compilado no portal.

Para correr:

```bash
cd windows
go test ./garagecapture -count=1
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build ./garagecapture
```

## Passos para a versão Windows atual

1. Localizar o **código-fonte exato da versão v5.12.17 ou posterior**. Não compilar nem distribuir a v5.2.8 como atualização — o programa atual contém funcionalidades posteriores.
2. Confirmar os campos `Feed`, `CloudSync`, `Recorder` e `SessionID`. Integrar o pacote `garagecapture` na árvore do módulo Go atual.
3. No leitor nativo do mapeamento `Local\\IRSDKMemMapFileName`, após a descodificação de uma amostra real, chamar `observeIRacingGarage(buf, meta)`. Para `WeekendInfo`, disponibilizar `SessionID` e `SubSessionID`; priorizar a mesma chave de sessão utilizada nas voltas arquivadas.
4. Utilizar **apenas** o token Supabase do piloto já autenticado no programa. A captura não deve bloquear o ciclo de telemetria; uma falha de envio permite nova tentativa após ~30 s e IDs estáveis.
5. Validar diferenças de formatação do `CarSetup` iRacing (o parser suporta mapas YAML aninhados; listas e sintaxes complexas são rejeitadas, não inventadas). Testar várias viaturas com e sem setup fixo e confirmar secções, unidades e limites.
6. Confirmar que carro/pista/sessão correspondem exatamente aos metadados que o portal consulta, e que uma conta não lê snapshots de outra (RLS).
7. Integrar no instalador **e assinar/publicar segundo o fluxo Microsoft Store existente**, sem downgrade.

## Limitações deliberadas

- A versão v39 do portal só apresenta snapshots se o piloto possuir sessão iRacing real autenticada.
- O esquema do Supabase já contém `ams_setup_snapshots` com RLS por piloto. A fonte `irsdk_session_info` descreve a origem declarada; não é uma certificação criptográfica.
- CarSetup **não é** igual aos oito sliders genéricos do Setup Lab, e alterações não permitem prever ganhos de tempo de forma fundamentada.
- A ponte Go do exemplo corresponde às estruturas de v5.2.8, não foi executada com iRacing em Windows, e requer verificação contra o código atual antes de qualquer instalação.

**Entrega atual:** componente de captura pronto para integração, testes e prova de compilação com fonte antiga. **Pendente:** integrar, assinar e validar no executável Windows atual.
