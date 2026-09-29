# TapStrong — pronto para lançar?

Situação na Fase 19 (28/09/2026), depois da rodada 7 de QA. O código das Fases 0 a 19 está completo e testado. O que falta para publicar depende de contas, contratos e revisões do seu lado, listados abaixo na ordem em que destravam o lançamento.

## Pronto no código

- Onboarding completo: boas-vindas, idade e modos, entrevista com o coach, check de segurança e resumo.
- Mapa do corpo com 28 modelos, frente e costas, objetivos por músculo e zoom com pinça (ou botões + e −).
- Gerador determinístico e testado, sempre com aquecimento e desaquecimento, com filtros de segurança por idade, condições e restrições.
- Fluxo do treino: player, descanso, dor com troca segura, encerrar, corpo vermelho e dias seguidos.
- Conta por e-mail com código, cartão de compartilhamento, convites, marcos e lembretes.
- Pagamentos: RevenueCat no código, plano grátis com 3 treinos por semana, Premium e Família, lembrete 3 dias antes da cobrança e cobrança honesta.
- Família: até 5 perfis, criança só com consentimento (compra na loja + aviso aos pais) e painel do dono do plano.
- Progresso, check-in (medidas só para adultos), fotos no celular, Repair e restrições.
- "Movimento que dói": relato por movimento, triagem de alerta vermelho, gerador que respeita os movimentos, plano de recuperação em 3 fases, semáforo da dor e reteste semanal.
- Modo 60+ com tela inicial própria, letra maior, "Ler para mim" e sem câmera por padrão.
- Sincronização com o Supabase, incluindo check-ins e Repair. Fotos nunca sobem.
- Acessibilidade e contraste conferidos por testes automáticos; textos em EN, ES e PT-BR.
- Sentry e PostHog prontos. Ficam desligados até as chaves existirem, e nada é enviado de perfil de criança.
- Ícone, splash, `eas.json`, fluxos E2E do Maestro, textos das lojas e rótulos de privacidade (`docs/store/`).

## Depende de você (bloqueia o lançamento)

1. **Contas de desenvolvedor:** Apple Developer (US$ 99/ano) e Google Play Console (US$ 25, uma vez). Sem elas não há build nas lojas, RevenueCat nem login com Apple/Google.
2. **Revisor certificado** (NSCA-CSCS ou ACSM): aprovar os 754 exercícios `draft` (todos são rascunho até a aprovação), os 5 testes Repair, as etiquetas de movimento e o catálogo de movimentos (aba "Movements") na planilha `docs/review/exercise-review.xlsx`. Até a aprovação, a versão de loja mostra "em revisão" no lugar dos treinos.
3. **Biblioteca de exercícios licenciada (3D):** licença e preço. Os vídeos `ex-*.mp4` atuais são só protótipos e não vão para a loja.
4. **Advogado:** revisar a política de privacidade, os termos e os avisos de saúde. No lançamento, menores de 13 estão desligados (Fase 12), então o fluxo COPPA e o aviso aos pais (`parent-notice-v1`) só precisam de revisão antes de religar na versão 2. Nessa revisão, ele também diz se o registro de consentimento deve ser guardado quando um perfil de criança é removido (hoje é apagado junto com o perfil). O inventário de dados para ele está em `docs/store/privacy-labels.md`.
5. **Páginas web:** política de privacidade e termos publicados numa URL (exigência das duas lojas), de preferência em `tapstrong.app`. O app já mostra os links (paywall, Planos, Conta, Cobrança, Configurações → Sobre); os endereços vêm de `EXPO_PUBLIC_TERMS_URL` e `EXPO_PUBLIC_PRIVACY_URL` (veja "Variáveis do app" abaixo).
6. **RevenueCat:** criar os 4 produtos com teste de 7 dias e os entitlements `premium` e `family`. As chaves públicas vão nas variáveis do EAS (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`); os segredos vão no Supabase, pelo terminal; depois configurar o webhook (passo a passo na seção da Fase 6 em `docs/progress.md`).
7. **Chave da API do Claude:** `ANTHROPIC_API_KEY` nos segredos do Supabase, pelo terminal. Ativar também o login anônimo em Authentication → Providers.
8. **EAS:** `npx eas-cli@latest init` para criar o projeto na sua conta Expo. Depois `eas build --profile preview` para testes internos (TestFlight e teste interno do Google Play) e `--profile production` para as lojas.

## Depende de você (importante; os itens 15 e 18 bloqueiam o build de produção)

9. **SMTP com Resend:** passo a passo em `docs/store/smtp-resend.md`. A chave vai direto no painel do Supabase, não no chat.
10. **PostHog e Sentry:** criar as contas (plano grátis) e pôr as chaves **públicas** nas variáveis do EAS (`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`). Para o Sentry mostrar o código nos erros, `SENTRY_AUTH_TOKEN` entra como segredo no EAS e tira-se o `SENTRY_DISABLE_AUTO_UPLOAD` do `eas.json`.
11. **Tradução profissional** de ES e PT-BR, dos textos do app e das lojas.
12. **Ícone:** aprovado para os testes. Um designer refina depois, junto com a marca (`python3 scripts/build-icons.py` gera de novo).
13. **Capturas de tela** para as lojas: a ordem sugerida está em `docs/store/listing.md`. Nunca usar perfil de criança nem foto de antes e depois.
14. **Marca e domínio:** busca e registro de "TapStrong" no USPTO; domínio `tapstrong.app`.
15. **Link de convite (obrigatório, bloqueia o build de produção):** definir `EXPO_PUBLIC_SHARE_BASE_URL` (ex.: `https://tapstrong.app`) nas variáveis do EAS, com uma página https em `/r/<código>` que abre o app ou leva à loja. Sem ela, o convite sai como `tapstrong://r/CÓDIGO`, que só funciona com o app instalado (QA rodada 5).
16. **Supabase de produção:** decidir se o projeto atual vira o de produção ou se cria outro (a SPEC §13 pede projetos de produção).
17. **Segurança:** apagar o token do GitHub que ficou exposto.
18. **E-mail de suporte (obrigatório, bloqueia o build de produção):** definir `EXPO_PUBLIC_SUPPORT_EMAIL` com um endereço do domínio (ex.: `ajuda@tapstrong.app`). O `env:check` recusa Gmail, Hotmail, iCloud e outros e-mails pessoais, e também links de Termos, Privacidade e convite que não sejam `https://`.

## Variáveis do app (EAS, não `.env`)

O `.env` fica só no seu computador e não vai para o build da nuvem. As variáveis públicas do app entram no EAS: `npx eas-cli@latest env:create --environment production --name NOME --value VALOR --visibility plaintext` (ou pelo painel expo.dev → projeto → Environment variables). Os segredos (chave do Claude, service role, webhook) nunca entram aqui: ficam nos segredos do Supabase.

| Variável                                                                        | Obrigatória no build de produção | Para quê                                            |
| ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`                     | sim                              | conta, sincronização e funções                      |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`          | sim                              | assinaturas                                         |
| `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`                              | sim                              | links de Termos e Privacidade (exigência das lojas) |
| `EXPO_PUBLIC_SUPPORT_EMAIL`                                                     | sim                              | contato de suporte                                  |
| `EXPO_PUBLIC_SHARE_BASE_URL`                                                    | sim                              | link de convite                                     |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY`                                                | sim                              | verificação de pessoa (Cloudflare Turnstile)        |
| `EXPO_PUBLIC_TURNSTILE_BASE_URL`                                                | não (`https://tapstrong.app/`)   | endereço do widget no celular                       |
| `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | não                              | erros e uso                                         |
| `EXPO_PUBLIC_KIDS_UNDER_13_ENABLED`                                             | não (desligado)                  | menores de 13, só na versão 2                       |
| `EXPO_PUBLIC_APP_STORE_URL` / `EXPO_PUBLIC_PLAY_STORE_URL`                      | não (depois da publicação)       | links das lojas no aviso da web para adolescentes    |

`npm run env:check` lista o que falta; o build de produção roda essa checagem e para se faltar alguma obrigatória. No build de produção ela também pergunta ao servidor (só com a chave pública) se as funções das migrações novas existem, e para com a mensagem "The Supabase server is missing migrations…" se faltar alguma (`npm run server:check` faz só essa parte).

## Migrações pendentes (você roda `supabase db push`)

Antes do próximo build de teste, no terminal, na pasta do projeto (com o CLI do Supabase ligado ao projeto: `supabase link --project-ref <ref>`, uma vez):

```bash
supabase db push
```

Migrações novas desde a Fase 22, em ordem:

1. `20261017000000_pin_reset_code_lockout.sql` — trava própria do código do e-mail (Fase 23).
2. `20261018000000_security_s1_profile_owner.sql` — perfil só se liga ao próprio login; indicações sem o id de quem entrou (S1-01).
3. `20261018000100_security_s1_server_pin.sql` — PIN dos pais conferido no servidor (S1-03). Usa a extensão `pgcrypto`, que o Supabase já tem.
4. `20261018000200_security_s2_profiles.sql` — vínculo de responsável e modo pela idade (S2-01 a S2-03).
5. `20261018000300_security_s2_coach_budget.sql` — orçamento diário do coach por IP e total (S2-04).
6. `20261018000400_security_s2_account_code.sql` — trava do código de login da Conta (S2-07).
7. `20261018000500_security_p3.sql` — indicações, limite de quem convida, exclusão de conta mantendo o perfil do adolescente (P3).
8. `20261019000000_security_r2_pin_race.sql` — a trava do PIN não pode ser burlada com tentativas simultâneas (Fase 25, P1).
9. `20261019000100_security_r2_pin_change.sql` — trocar o PIN exige o PIN atual ou o código do e-mail (uso único, 10 min).
10. `20261019000200_security_r2_birth_date.sql` — adolescente não vira adulto mudando a data; registro das mudanças; modo 60+ só com 60+.
11. `20261019000300_security_r2_p3.sql` — treino da indicação com horário do servidor; responsável não apaga perfil de adolescente com login próprio; `parent_pin_failed` só no servidor.

Depois do push: `npm run server:check` (com as variáveis do `.env`) deve dizer "OK". Se o app rodar contra um servidor sem essas funções, ele registra `server_missing:<função>` no Sentry.

## Antes do próximo build de teste — sua lista, nesta ordem (Fase 25)

1. **Migrações:** no terminal, na pasta do projeto, `supabase db push` (aplica as 11 da lista acima que ainda faltarem).
2. **Conferir o servidor:** `npm run server:check`. Ele deve dizer "OK" para as migrações. Nesta fase ele também **falha se o captcha estiver desligado**, então o passo 4 precisa vir antes do build de produção (builds de preview não travam por isso).
3. **Turnstile (Cloudflare):** criar o site e colocar a *site key* no EAS como `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (passo a passo em "Segurança" abaixo). Gerar o build de teste com essa chave.
4. **Painel do Supabase → Authentication**, depois que os testadores tiverem o build com o Turnstile:
   - Attack Protection → Captcha: ligar, provedor Turnstile, colar a *secret key* (só lá, nunca no chat);
   - Email: "Confirm email" ligado, validade do código **900 s**, intervalo mínimo entre e-mails **60 s**;
   - Senhas: mínimo **10** caracteres, letras e números; "Secure password change" ligado;
   - Rate limits: verificação de token **30 por 5 min** por IP; login anônimo **30 por hora** por IP.
5. **Conferir tudo de uma vez:** crie um Personal Access Token (supabase.com → Account → Access Tokens) e rode, só no terminal, `SUPABASE_ACCESS_TOKEN=... npm run server:check`. Ele confere os valores do passo 4 e o captcha.
6. **iPhone de verdade:** abrir o coach e o "Esqueci o PIN" com o build novo e confirmar que a verificação do Turnstile aparece e fecha sozinha (o iOS carrega partes dela em sub-quadros, que agora estão liberados).

## Segurança — o que você configura nos painéis (rodada 1)

**Cloudflare Turnstile** (grátis):

1. Em dash.cloudflare.com → Turnstile, crie um site "TapStrong", modo **Managed**, com os domínios `tapstrong.app` (e o domínio da versão web, quando houver).
2. A **site key** (pública) vai no EAS como `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
3. A **secret key** vai só no Supabase: Authentication → Attack Protection (Bot and Abuse Protection) → Captcha: ligar, provedor Turnstile, colar a secret. Nunca no chat nem no GitHub.
4. Ligue o captcha no Supabase **só depois** que o build com o Turnstile estiver nas mãos dos testadores: builds antigos param de conseguir entrar.
5. O Turnstile no celular usa `react-native-webview`: é preciso um build novo (development ou preview), o Expo Go antigo não serve.

**Supabase → Authentication:**

- Email: "Confirm email" ligado; validade do código (OTP expiry) **900 s** (15 min).
- Senhas: mínimo **10** caracteres, com letras e números; "Secure password change" ligado.
- Rate limits: confira os de e-mail (envio de códigos), verificação de token (30 por 5 min por IP) e login anônimo (30 por hora por IP).
- E-mail: intervalo mínimo entre e-mails (**max frequency / "Minimum interval between emails"**) de **60 s**. É esse limite do Supabase que vale de verdade para os códigos; o contador do app é só uma ajuda.
- Para o `server:check` conferir esses valores sozinho: crie um **Personal Access Token** em supabase.com → Account → Access Tokens e, só no terminal, rode `SUPABASE_ACCESS_TOKEN=... npm run server:check`. Esse token nunca vai no `.env`, no chat nem no GitHub. Sem ele, o check só avisa que não conferiu.
- **Captcha:** a partir desta fase, `server:check` e o build de produção **falham** enquanto o captcha estiver desligado no Supabase.

**Supabase → Edge Functions → Secrets** (pelo terminal):

- `REVENUECAT_ACCEPT_SANDBOX`: **não** defina no projeto de produção. Só num projeto de teste, com `true`, para compras do TestFlight contarem como teste.
- `COACH_IP_DAILY_LIMIT` (padrão 60) e `COACH_GLOBAL_DAILY_LIMIT` (padrão 5000): opcionais, para ajustar o orçamento diário do coach.

**Versão web (quando houver hospedagem):** rode `npm run web:export`: ele exporta para `dist`, grava os cabeçalhos e confere o bundle (antes eram dois passos). Ele grava `dist/_headers` (Netlify e Cloudflare Pages) e `dist/vercel.json` (Vercel) com a CSP e os cabeçalhos de segurança. Na web, os perfis da família ficam desligados até o PIN no servidor passar no QA da web.

## Lacunas do produto para decidir

- **Aba Coach (SPEC §9 e §11.4):** fica para a primeira atualização (decisão sua). O botão "Falar com meu coach" da tela 60+ entra junto.
- **Login com Apple e Google:** escondidos até existirem as contas de desenvolvedor.
- **Depois do lançamento:** registro das séries por voz e o contorno de pose na câmera.
- **Plano grátis e marco de 7 dias:** resolvido na Fase 11. A mobilidade curta (~10 min) conta como dia ativo, sem limite, e os 3 treinos completos por semana continuam.
- **Menores de 13:** desligados no lançamento (Fase 12), no app (`EXPO_PUBLIC_KIDS_UNDER_13_ENABLED`) e no banco (`app_settings.kids_under_13_enabled`). Para religar na versão 2, as duas chaves precisam ser ligadas, e antes disso o advogado precisa revisar o fluxo COPPA.
- **PIN dos pais esquecido:** a redefinição usa um código por e-mail, que só chega a usuários reais depois do SMTP do Resend (`docs/store/smtp-resend.md`).
- **QA rodadas 1 e 2:** corrigidas (ver `docs/qa-round-1.md`, `docs/qa-round-2.md` e os relatórios das Fases 10 e 11 em `docs/progress.md`). Falta o reteste da rodada 2: mapa de recuperação, família (PIN, adolescentes, remover membro), mobilidade curta e fases 2 e 3 do reparo.
- **Revisor certificado:** 754 exercícios `draft`. Ele também precisa confirmar as horas de recuperação (44 h, 90 h aos 60+), a carga leve em articulações restritas e as doses de equilíbrio.

## Como verificar

- `npm run check`: lint, typecheck, funções e todos os testes.
- `npm run db:test`: migrações e testes de RLS e de dados de crianças.
- `npm run bundle:check`: confirma que rascunhos, vídeos de protótipo, o simulador de compra e avisos de desenvolvimento não vão para a loja.
- `npm run theme:check` e `npm run tabs:check`: telas nos modos claro e escuro (contraste de todo texto, troca ao vivo, primeiro quadro no escuro) e nomes das abas em EN/PT/ES.
- `npm run env:check`: variáveis obrigatórias do build de produção.
- `npm run security:check`: segredos nos arquivos, no histórico e no bundle web; usos de HTML/eval/WebView fora da lista auditada; integridade do lockfile; `npm audit` sem alto ou crítico (regras em `docs/SECURITY.md`).
- `npm run server:check`: o servidor tem as migrações novas.
- Maestro (num simulador, com o build de preview): `maestro test .maestro/`.

## Revisão final sugerida

Antes de enviar às lojas, faça uma rodada completa de QA no app de verdade, com os 20 perfis de usuário, como a que foi feita nos mockups.
