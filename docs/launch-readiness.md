# TapStrong — pronto para lançar?

Situação no fim da Fase 8 (26/09/2026). O código das Fases 0 a 8 está completo e testado. O que falta para publicar depende de contas, contratos e revisões do seu lado, listados abaixo na ordem em que destravam o lançamento.

## Pronto no código

- Onboarding completo: boas-vindas, idade e modos, entrevista com o coach, check de segurança e resumo.
- Mapa do corpo com 28 modelos, frente e costas, objetivos por músculo e zoom com pinça (ou botões + e −).
- Gerador determinístico e testado, sempre com aquecimento e desaquecimento, com filtros de segurança por idade, condições e restrições.
- Fluxo do treino: player, descanso, dor com troca segura, encerrar, corpo vermelho e dias seguidos.
- Conta por e-mail com código, cartão de compartilhamento, convites, marcos e lembretes.
- Pagamentos: RevenueCat no código, plano grátis com 3 treinos por semana, Premium e Família, lembrete 3 dias antes da cobrança e cobrança honesta.
- Família: até 5 perfis, criança só com consentimento (compra na loja + aviso aos pais) e painel do dono do plano.
- Progresso, check-in (medidas só para adultos), fotos no celular, Repair e restrições.
- Modo 60+ com tela inicial própria, letra maior, "Ler para mim" e sem câmera por padrão.
- Sincronização com o Supabase, incluindo check-ins e Repair. Fotos nunca sobem.
- Acessibilidade e contraste conferidos por testes automáticos; textos em EN, ES e PT-BR.
- Sentry e PostHog prontos. Ficam desligados até as chaves existirem, e nada é enviado de perfil de criança.
- Ícone, splash, `eas.json`, fluxos E2E do Maestro, textos das lojas e rótulos de privacidade (`docs/store/`).

## Depende de você (bloqueia o lançamento)

1. **Contas de desenvolvedor:** Apple Developer (US$ 99/ano) e Google Play Console (US$ 25, uma vez). Sem elas não há build nas lojas, RevenueCat nem login com Apple/Google.
2. **Revisor certificado** (NSCA-CSCS ou ACSM): aprovar os 74 exercícios e os 5 testes Repair na planilha `docs/review/exercise-review.xlsx`. Até a aprovação, a versão de loja mostra "em revisão" no lugar dos treinos.
3. **Biblioteca de exercícios licenciada (3D):** licença e preço. Os vídeos `ex-*.mp4` atuais são só protótipos e não vão para a loja.
4. **Advogado:** revisar o fluxo COPPA, o aviso aos pais (`parent-notice-v1`), a política de privacidade, os termos e os avisos de saúde. O inventário de dados para ele está em `docs/store/privacy-labels.md`.
5. **Páginas web:** política de privacidade e termos publicados numa URL (exigência das duas lojas), de preferência em `tapstrong.app`.
6. **RevenueCat:** criar os 4 produtos com teste de 7 dias e os entitlements `premium` e `family`. As chaves públicas vão no `.env`; os segredos vão no Supabase, pelo terminal; depois configurar o webhook (passo a passo na seção da Fase 6 em `docs/progress.md`).
7. **Chave da API do Claude:** `ANTHROPIC_API_KEY` nos segredos do Supabase, pelo terminal. Ativar também o login anônimo em Authentication → Providers.
8. **EAS:** `npx eas-cli@latest init` para criar o projeto na sua conta Expo. Depois `eas build --profile preview` para testes internos (TestFlight e teste interno do Google Play) e `--profile production` para as lojas.

## Depende de você (importante, mas não bloqueia o primeiro build)

9. **SMTP com Resend:** passo a passo em `docs/store/smtp-resend.md`. A chave vai direto no painel do Supabase, não no chat.
10. **PostHog e Sentry:** criar as contas (plano grátis) e pôr as chaves **públicas** no `.env` e nas variáveis do EAS (`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`). Para o Sentry mostrar o código nos erros, `SENTRY_AUTH_TOKEN` entra como segredo no EAS e tira-se o `SENTRY_DISABLE_AUTO_UPLOAD` do `eas.json`.
11. **Tradução profissional** de ES e PT-BR, dos textos do app e das lojas.
12. **Ícone:** aprovar ou trocar o ícone novo (T branco com o ponto laranja do mapa, sem gradiente). Para gerar de novo: `python3 scripts/build-icons.py`.
13. **Capturas de tela** para as lojas: a ordem sugerida está em `docs/store/listing.md`. Nunca usar perfil de criança nem foto de antes e depois.
14. **Marca e domínio:** busca e registro de "TapStrong" no USPTO; domínio `tapstrong.app`.
15. **Supabase de produção:** decidir se o projeto atual vira o de produção ou se cria outro (a SPEC §13 pede projetos de produção).
16. **Segurança:** apagar o token do GitHub que ficou exposto.

## Lacunas do produto para decidir

- **Aba Coach (SPEC §9 e §11.4):** o chat contínuo com o coach não foi construído; nenhuma fase o incluía. A tela 60+ do mockup tem "Falar com meu coach", que deixei de fora até a aba existir. Faço antes do lançamento ou na primeira atualização?
- **Login com Apple e Google:** escondidos até existirem as contas de desenvolvedor.
- **Depois do lançamento:** registro das séries por voz e o contorno de pose na câmera.

## Como verificar

- `npm run check`: lint, typecheck, funções e 379 testes.
- `npm run db:test`: migrações e testes de RLS e de dados de crianças.
- `npm run bundle:check`: confirma que rascunhos, vídeos de protótipo e o simulador de compra não vão para a loja.
- Maestro (num simulador, com o build de preview): `maestro test .maestro/`.

## Revisão final sugerida

Antes de enviar às lojas, faça uma rodada completa de QA no app de verdade, com os 20 perfis de usuário, como a que foi feita nos mockups.
