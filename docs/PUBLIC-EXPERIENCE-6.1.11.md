# Web 6.1.11 — entrada, ajuda contextual e páginas públicas

## Comportamento

- `index.html`: entrada racing com login, criação de conta, recuperação e alteração de palavra-passe. Reutiliza a configuração e a sessão `AMSAuth` do portal. Uma sessão existente oferece «Continuar para o portal», sem pedir novamente a palavra-passe.
- `portal.html`: interface de telemetria anteriormente servida em `index.html`. Os módulos de aquisição, mapas, sincronização, análise e replay mantêm o mesmo código. Acrescenta ligações públicas e ajuda contextual.
- `ajuda.html`: guias Windows/Web/Android, pesquisa sem distinção de acentos, perguntas expansíveis e recuperação de acesso. Conteúdo legível sem JavaScript.
- `privacidade.html`: responsável Algarve Motors and Sports, `info@algarvemsports.pt`, prazo indicado pelo responsável de seis meses de inatividade. A página assinala as partes ainda em revisão, incluindo execução da conservação, bases legais e destinatários.
- Android conserva o link de teste interno existente, sem anunciar uma nova publicação. iPhone é apresentado como planeado, sem instalação nem data.

Os novos conteúdos públicos estão em português. O portal conserva PT/EN e os balões acompanham o idioma selecionado.

## Ajuda contextual

Um único componente delegado apresenta explicações dos menus e controlos, incluindo menus criados dinamicamente. Abre após 350 ms, abaixo do cursor ou do controlo focado, ajusta a posição às margens e fecha com Esc. É possível mover o ponteiro para o balão para o ler. Os seletores principais têm um botão «?» utilizável por toque e teclado. `aria-describedby` preserva descrições preexistentes. Não são enviados eventos de replay nem alterados dados de telemetria.

## Autenticação

O novo formulário utiliza os endpoints públicos Supabase já configurados; nenhuma chave administrativa foi acrescentada. Login e registo reutilizam `AMSAuth`. Recuperação pede `/auth/v1/recover` com regresso à raiz da mesma origem. O callback implícito é retirado do endereço antes da validação através de `/auth/v1/user`. Tokens de recuperação ficam apenas em memória, sem abrir o portal, até o utilizador escolher uma nova palavra-passe; depois do `PUT /user`, a sessão de recuperação termina e é pedido um novo login.

Foi verificado por leitura que email está ativo, registo está permitido e é exigida confirmação de email. Não foram criadas contas nem enviados emails nos testes. A entrega real dos emails e a configuração de URLs autorizadas do Supabase continuam a depender do ambiente; o teste de browser interceta as respostas de autenticação.

## Conservação

O prazo de seis meses não foi transformado numa eliminação automática de dados de produção. A consulta de metadados não encontrou `cron.job`; a pesquisa do código não encontrou uma rotina de inatividade. Isto não exclui tarefas externas não acessíveis ao projeto. Antes de tornar a política definitiva, confirmar o que conta como atividade (login, utilização Windows/Android e sincronização), o tratamento de contas de equipa, avisos e cópias de segurança, e implementar/verificar a rotina correspondente. Não houve eliminações ou alterações de esquema.

## Validação

- `dotnet build --configuration Release`: sem erros ou avisos.
- Smoke tests existentes de telemetria, idiomas, mapas 2D/3D e elevação: aprovados, agora dirigidos a `portal.html`.
- `node scripts/public-pages-smoke.mjs`: valida ligações, âncoras, ficheiros e separação entre entrada e portal.
- `node scripts/public-experience.browser.cjs`: dez cenários no Edge com contextos isolados e respostas Auth simuladas: layout a 1440/390/320 px, login correto/incorreto, confirmação de registo, palavras-passe diferentes, recuperação e link inválido, sessão existente, logout, pesquisa, balões PT/EN, toque, hover/foco/Esc e páginas sem JavaScript. Nenhuma exceção JavaScript.

O teste de browser requer Playwright e Edge instalados. `AMS_PUBLIC_TEST_OUTPUT` permite guardar capturas; não são usadas credenciais reais. Não substitui o teste de entrega de email numa conta de teste autorizada nem testes num dispositivo Android físico.

## Publicação e compatibilidade

A raiz passa a ser a entrada pública; atualizar marcadores diretos do portal para `portal.html`. Os quatro ficheiros são estáticos e funcionam no hosting Azure atual. As verificações CI foram ajustadas para confirmar ambos os pontos de entrada. Esta entrega prepara uma alteração para revisão; não modifica a versão Windows nem a APK e não publica automaticamente em produção.

Referências: [recuperação de password Supabase](https://supabase.com/docs/guides/auth/passwords), [contrato REST Auth](https://github.com/supabase/auth/blob/master/openapi.yaml), [WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html), [informação de privacidade EDPB](https://www.edpb.europa.eu/sme/find-practical-info/faq_en).
