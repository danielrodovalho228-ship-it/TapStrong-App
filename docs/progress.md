# Progresso

## Fase 0 — Setup (26/09/2026)

### Feito

- **App Expo SDK 57** (versão estável mais recente) + React Native 0.86 + TypeScript strict + expo-router. IDs: `app.tapstrong` (iOS e Android), scheme `tapstrong://`.
- **Lint e formatação:** ESLint (config do Expo) + Prettier. Uma regra de lint **bloqueia texto fixo em JSX**, então toda string precisa passar pelo i18n.
- **Ambiente:** `.env.example`. O `.gitignore` bloqueia `.env`, chaves e certificados. Só variáveis `EXPO_PUBLIC_*` (públicas) entram no app. A chave da Claude vai ser um secret do Supabase.
- **Design tokens** (SPEC §4) em `src/theme/tokens.ts`: cores, cores de recuperação, raios, alvo de toque de 44, botão de 54, fontes Barlow e Barlow Condensed, escala de texto com +2 passos no modo 60+ e legenda mínima de 13 px.
- **Componentes base:** Button, Chip, Card, Header, IconButton, mais AppText e Icon (ícones de linha próprios em SVG, sem fonte de ícones genérica). Todos têm papel e rótulo de acessibilidade.
- **i18n:** i18next + expo-localization; `en` como fonte, `es` e `pt-BR` com tradução provisória de desenvolvimento.
- **Supabase:** `supabase/config.toml` e a primeira migration com enums, `profiles`, `family_members`, `health_screen`, `restrictions`, `preferences`, `muscles` (25 chaves vindas dos hotspots da SPEC §5) e `muscle_goals`.
  - **RLS em todas as tabelas.**
  - O banco recusa perfil de criança sem responsável, perfil de criança com medidas corporais e cintura para quem não é adulto.
  - As tabelas de exercícios ficam para a Fase 3 e as de treino para a Fase 4, como na SPEC.
- **Tela provisória** (`/`): galeria dos componentes com troca de idioma. A Fase 1 troca essa tela pela Boas-vindas.

### Testes

- `npm run check`: lint + typecheck + **48 testes** passando. Eles cobrem:
  - contraste de todos os pares de cor da marca (≥ 4.5:1);
  - tamanho mínimo de texto e escala do modo 60+;
  - alvos de toque;
  - as mesmas chaves nos 3 idiomas;
  - toda chave de músculo usada no banco existe nas traduções;
  - componentes.
- `npm run db:test`: aplica as migrations num Postgres local e testa RLS (um estranho não vê nem altera perfil ou restrição de criança; ninguém escreve na tabela de músculos) e as restrições de dados de criança. **Passou.**
- Os bundles de Android e Web compilam (`expo export`).

### Como testar

1. `npm install`
2. `npx expo start` e abra no Expo Go (celular) ou aperte `w` para abrir na web.
3. Na galeria, troque o idioma (English / Español / Português) e confira botões, chips e cartões.

### Perguntas em aberto

1. **Mockups:** as imagens das 26 telas ainda não estão neste repositório. Preciso delas em `docs/mockups/` antes de fechar o visual dos componentes (ex.: nos mockups o botão principal é preto e o laranja fica para a ação principal).
2. **`profiles.id`:** a SPEC diz `id = auth user`, mas perfil de criança (e de pai ou avô gerenciado) pode não ter login. Usei `id` próprio + `user_id` opcional + `guardian_id`. Pode ser assim?
3. **Projeto Supabase remoto:** não criei. Crio um projeto (plano gratuito) na sua conta pelo conector, ou você prefere criar?
4. **Imagens dos corpos** (`assets/bodies/`): estão no seu PC e não chegam até mim. Precisam ser enviadas ao repositório antes da Fase 2.
5. **MMKV** exige um _development build_ (não roda no Expo Go). Entra na Fase 1 junto com o cache local. Tudo bem?
6. **Ícones e splash** ainda são os padrão do Expo; ficam para a Fase 8.

## Fase 1 — Onboarding (26/09/2026)

### Feito

Telas conferidas com os mockups 01 a 05, na ordem do fluxo. Tudo local, sem conta.

- **Boas-vindas (01):** os 4 corpos do banco novo (homem, mulher, criança, 60+), seletor EN / ES / PT-BR que fica salvo, "Começar". "Já tenho uma conta" mostra um aviso de "em breve" (login é na Fase 5).
- **Quem vai treinar (02, passo 1 de 7):** Eu / Meu filho ou filha / Meu pai, mãe ou avô, mais mês e ano de nascimento. Calcula idade, faixa do corpo e modo:
  - **13 a 17:** modo adolescente.
  - **60+:** modo 60+, com texto 2 passos maior no app inteiro.
  - **Menor de 13 sozinho:** bloqueado, com o aviso de pedir a um responsável.
  - **Pai adicionando criança menor de 13:** bloqueado, com o aviso de que o consentimento dos pais vem com o plano Família (Fase 6).
  - **Menor de 9:** não suportado.
- **Entrevista com o coach (03, passos 2 a 5):** objetivo principal → onde, quanto tempo e quantos dias (com equipamentos) → o que quer melhorar (músculos) → modelo de corpo, altura e peso (opcionais, em pés/libras nos EUA).
  - Dá para responder tocando nas opções ou **digitando**. O texto digitado vai para a Edge Function `coach-interview`, que usa a Claude com saída estruturada.
  - A IA só preenche opções que já existem: os músculos vêm da tabela `muscles` e tudo é validado de novo no servidor e no app. Ela nunca escolhe exercícios.
  - Sem Supabase configurado, um leitor offline entende respostas como "Academia, 40 min, 3x".
  - **Criança:** sem campo de texto livre e sem medidas.
- **Checagem de segurança (04, passo 6):** dores, saúde e posição, com "Nenhum" limpando a seleção.
  - Cardíaco, gravidez/pós-parto ou cirurgia recente mostram "Fale com seu médico", e é preciso tocar em "Entendi" para seguir.
  - Gravidez não aparece para corpo masculino nem para criança.
- **Resumo do plano (05, passo 7):** as 6 linhas do mockup com "Editar", e cada uma volta para o passo certo.
  - Observação sobre gordura corporal só para adultos. Adolescente nunca vê.
  - Observações de 60+ e do médico quando se aplicam.
- **Depois do resumo:** tela provisória "o mapa do corpo vem a seguir" (Fase 2), com "Revisar meu plano" e "Recomeçar".
- **Armazenamento:** MMKV num build de desenvolvimento. No Expo Go os dados ficam só na memória, então o app funciona, mas não guarda ao fechar.
- **Eventos (SPEC §10):** `onboarding_started`, `age_mode_set`, `chat_completed` e `safety_red_flag`. O evento de alerta nunca diz qual condição foi. PostHog entra na Fase 8.
- **Novos componentes:** RadioCard, Select, SegmentedControl, TextField, StepProgress, Notice, ChatMessage, SummaryRow, TextLink, Screen.

### Testes

- `npm run check`: lint + typecheck + `deno check`/`deno lint` da Edge Function + **139 testes** (eram 52). Os testes novos cobrem:
  - idade, faixas e modos, incluindo os limites de 13 e 18 anos;
  - todas as saídas do portão de idade;
  - filtros de segurança (alertas, gravidez oculta, restrições);
  - o contrato da IA: descarta músculos e valores inventados, recusa o modo criança, e as opções batem com os enums do banco;
  - o leitor offline em EN/ES/PT;
  - as telas: criança sem texto livre, adolescente sem "Perder peso" e sem linguagem de gordura corporal, alerta médico exigindo confirmação, resumo com os mesmos textos do mockup.
- `npm run db:test`: passa.
- Fluxo completo rodado no navegador (390×844), da boas-vindas ao resumo, sem erros. Os bundles de Android e Web compilam.

### Como testar

1. `git pull`, depois `npm install`, depois `npx expo start`; abra no Expo Go.
2. Percorra Começar → Quem vai treinar → entrevista → segurança → resumo.
3. Experimente:
   - **nascimento 2015:** bloqueio de menor de 13;
   - **2011:** modo adolescente, sem "Perder peso";
   - **1950:** modo 60+, texto maior;
   - **"Problema cardíaco":** aviso médico.
4. Digite "Academia, 40 minutos, 3 vezes" na entrevista. Isso funciona offline. Para o coach com IA de verdade, falta o projeto Supabase (pergunta 1).

### Perguntas em aberto

1. **Coach com IA:** quando você criar o projeto Supabase, me passe a URL e a anon key. Eu aplico as migrations e publico a função. A chave da Claude **você** define pelo terminal, nunca no chat:
   `npx supabase secrets set ANTHROPIC_API_KEY=...`
2. **Modelo da IA:** estou usando o Claude Opus 5 (o padrão) com esforço baixo e com um modelo reserva caso ele recuse. Cada resposta é curta, então o custo é baixo, mas dá para trocar por um modelo mais barato (Sonnet 5 ou Haiku 4.5). A decisão é sua.
3. **Abuso da função de IA:** sem conta, qualquer pessoa com a anon key (pública) poderia chamar a função e gastar créditos. Hoje o texto é limitado a 500 caracteres. Proposta: ativar o login anônimo do Supabase e limitar as chamadas por usuário antes do lançamento. Pode ser?
4. **Menores de 13:** bloqueados até a Fase 6 (consentimento dos pais). Tudo bem ficar assim até lá?
5. **Adolescentes:** tirei a opção "Perder peso" para menores de 18 (regra de não usar linguagem de gordura corporal). Concorda?
6. **Corpo neutro:** não existem imagens de corpo neutro no banco. Por enquanto a prévia fica vazia. Quer gerar essas imagens, ou mostramos outro modelo?
7. **Microfone** do mockup 03: não entrou (a SPEC deixa voz para depois).
8. **Alerta médico:** exijo tocar em "Entendi" para continuar. Pode ser assim?
