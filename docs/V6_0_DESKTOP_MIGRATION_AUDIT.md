# AMSports Skunk Telemetry v6.0 — Auditoria da migração

Origem funcional: AMSports Telemetry v5.2.8 (ZIP de código Go/Win32 na Biblioteca).
Referência visual adicional: duas capturas do programa v5.2.25 (Team e Settings).
Destinos: Desktop C#/.NET 10/WebView2 e Supabase partilhado com skunk.pt.

## Incorporado na branch v6
- Versão 6.0.0 do executável e ícone Windows próprio gerado no workflow.
- Team desktop: cartões Conta AMS, Pilotos/Permissões, Equipa, resumo do arquivo e tabela Cloud real. Não simular pilotos nem autorizações.
- Settings desktop: sete separadores em layout compacto (AMSports Mobile, Diagnóstico, Conta AMS, Unidades, Vídeo/OBS, Privacidade, Atualizações).
- AMSports Mobile: servidor Kestrel **no próprio processo Windows**, SSE /stream e /health, PIN de 6 dígitos gerado por RNG, QR e URI `amsports://pair`, portas 8181 a 8190, contagem de dispositivos, restrição a IPs privados/loopback, rotação de PIN, ligar/desligar. Desativado por defeito para evitar abrir uma porta LAN sem consentimento.
- O protocolo SSE conserva a compatibilidade de base com o repositório hezev/amsports-telemetry-mobile (não é um protocolo WS). Deve ser testado num Android real.
- Captura direta iRacing, sem coletor Go.
- Adaptador inicial Assetto Corsa: shared memory physics/graphics/static, arquivo dos blocos brutos e normalização.
- Adaptador inicial F1 24/25: UDP loopback 20777, arquivo de todos os pacotes brutos e leitura do pacote de telemetria (tipo 6).
- Diagnóstico nativo básico, identificação da conta/arquivo, conversão de velocidade nos indicadores Live e teste de presença de OBS WebSocket em 127.0.0.1:4455.
- Código web do portal de produção não alterado nesta etapa: páginas v6 injetadas só no WebView2 desktop.

## Ainda por migrar/validar
- Teste ponta-a-ponta no Windows com iRacing, Assetto Corsa, F1 24/25 e com Android na mesma rede. Não assumir suporte completo às versões e aos canais sem esses testes.
- Team/Coach: regras de acesso RLS completas, gestão de convites e seleção de equipa. Atualmente apenas lê permissões pré-existentes.
- OBS: autenticação v5, iniciar/parar gravação, marcação de voltas e indexação de vídeos locais. Só teste de ligação inicial foi integrado.
- Unidades: aplicar conversão nos gráficos, mapas e valores de pressão/temperatura; a v6 converte neste momento apenas o indicador Speed suportado.
- Privacidade: opções avançadas de partilha e retenção.
- Atualizações: migração do atualizador assinado Go ou canal Microsoft Store. Não utilizar chaves/manifestos antigos em releases públicas.
- Recuperação automática de voltas Cloud quando offline, reconciliação de melhores voltas e telemetria completa (limite da tabela AMS); hoje grava brutos no PC e publica Live/voltas reduzidas.
- Guia de instalação assinado, auto-update, gestão de firewall Windows. O serviço Mobile só é acessível quando o Windows permite entradas na porta escolhida.
- QA responsivo e de acessibilidade das páginas Settings/Team.

## Segurança
- Nunca incorporar service_role, chave de publicação privada ou credenciais de treinador no executável.
- SSE usa HTTP LAN e PIN em query string por compatibilidade com Android existente. Usar apenas em rede Wi-Fi privada e regenerar PIN se divulgado. Para uso pela Internet, desenhar canal TLS/autorizado em vez de expor portas domésticas.
- As policy RLS do Supabase não foram alargadas. Não conceder leitura global aos pilotos por conveniência.
- Nenhum deploy em skunk.pt nem merge na main até verificação.
