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
