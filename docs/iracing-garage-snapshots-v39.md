# AMS Setup Lab — iRacing garage snapshots (v39)

## Estado real

A base de dados e o portal permitem guardar snapshots de garagem **privados por piloto** e comparar valores capturados.
A captura automática a partir do executável Windows AMS Telemetry **ainda requer integração e teste no respetivo código fonte**; o repositório legado `hezev/iracing-ai-setup` não é o executável atual. O browser não lê a garagem do iRacing.

## Fonte de dados

O produtor Windows deve ler o **CarSetup** do **SessionInfo** que o iRacing SDK fornece, mantendo as secções, valores e unidades originais. Só deve capturar quando iRacing está ligado e as informações da garagem pertencem ao carro e à sessão que serão gravados. Nunca derivar parâmetros a partir de velocidade/RPM ou usar os oito sliders genéricos do portal como dados capturados.

Formato de transferência para importação manual pelo portal (apenas **estrutura**, não exemplo de dados reais):

```json
{
  "schema": "ams.iracing.car_setup.v1",
  "simulator": "iRacing",
  "car": "<carro idêntico ao da sessão guardada>",
  "circuit": "<pista idêntica à da sessão guardada>",
  "sessionId": "<id de sessão, se conhecido>",
  "capturedAt": "<data/hora ISO 8601>",
  "carSetup": {
    "<secção original do SDK>": {
      "<parâmetro original do SDK>": "<valor original>"
    }
  }
}
```

Os campos carro, pista, sessão e instante são opcionais no **ficheiro**; quando fornecidos têm de coincidir com a sessão real selecionada (exceto capturedAt). O portal exige sessão autenticada iRacing para importar, limita o JSON a 220 KB e não confia nos nomes para autenticação. Importação manual é identificada como **origem não verificada pelo servidor**, mesmo quando o ficheiro foi exportado por um SDK.

## API para produtor Windows

Usar o token **normal de utilizador** do login AMS/Supabase no Windows (sem pedir chaves manuais e **nunca** usar a `service_role` em clientes). Endpoint:

`POST {SUPABASE_URL}/rest/v1/ams_setup_snapshots`

Headers: `apikey: <publishable key pública>`, `Authorization: Bearer <access token do piloto>`, `Content-Type: application/json`.

Corpo:
- `pilot_id`: UUID do piloto autenticado
- `simulator`: `iRacing`
- `car`, `circuit`, `session_id`: metadados da mesma sessão
- `car_setup`: objeto JSON do **CarSetup** original do SDK; nunca incluir tokens/autenticação
- `captured_at`: instante de captura
- `source`: `irsdk_session_info`
- `client_capture_id`: UUID estável por captura, usado para idempotência

A tabela impõe RLS com `auth.uid() = pilot_id`. Só o piloto pode ler, criar ou apagar os seus snapshots; não há política de acesso anónimo, público ou de treinador. O `source` descreve o produtor declarado; não representa uma atestação criptográfica.

## Comparações e segurança

O portal apresenta os parâmetros reais numa vista **separada** dos oito sliders protótipo. Pode comparar dois snapshots do mesmo carro e pista e listar apenas os valores que mudaram. Não gera deltas de tempo por volta, previsões físicas ou recomendações de tuning a partir de diferenças isoladas de garagem.

Pontos de validação para integrar o produtor Windows:
1. Confirmar acesso ao campo `CarSetup` do `SessionInfo` para vários carros iRacing e converter YAML para JSON preservando tipos, valores, secções e unidades.
2. Evitar capturas repetidas quando a mesma versão do SessionInfo é recebida várias vezes; usar `client_capture_id` estável.
3. Confirmar o mapeamento de `session_id` e `circuit` com o portal, o qual atualmente deriva as sessões das voltas.
4. Testar gravação com conta do piloto, consulta com essa conta e negação com uma conta diferente.
5. Testar comparação A/B na mesma pista e carro e confirmar que nenhuma telemetria ou dado privado é publicado no catálogo Community.

As funcionalidades que dependem de dados reais do executável Windows não devem ser assinaladas como validadas até estes testes passarem.
