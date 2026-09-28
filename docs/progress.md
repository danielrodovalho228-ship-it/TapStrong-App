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

## Decisões da Fase 1 aplicadas (27/09/2026)

- **Coach:** Claude Haiku 4.5 como modelo principal e Sonnet 5 como reserva. A reserva entra quando o Haiku dá erro, está sobrecarregado ou recusa.
- **Proteção de custo:**
  - Antes de chamar o coach, o app cria uma sessão anônima no Supabase (o login anônimo já está ligado no `config.toml`).
  - A função recusa chamadas sem sessão e limita a **30 chamadas por usuário por dia** (tabela `coach_usage` + função `consume_coach_call`, com testes).
  - Na Fase 5, a conta de verdade vai "adotar" essa sessão anônima.
- **Menores de 18:** "Perder peso" foi trocado por **"Mais condicionamento / energia"** (novo valor `fitness`). A IA também transforma "quero emagrecer" de um adolescente em `fitness`.
- **Corpo neutro:** opção escondida até as 14 imagens existirem. Quando existirem, basta ligar `NEUTRAL_BODY_AVAILABLE`.
- **Menores de 13:** continuam bloqueados até a Fase 6.

## Fase 2 — Mapa do corpo e objetivos (27/09/2026)

### Feito

- **Pontos do mapa conferidos nos 28 corpos** (SPEC §5):
  - Desenhei os pontos da SPEC sobre cada imagem e conferi um por um.
  - No homem adulto (referência), três pontos da SPEC estavam fora do lugar e foram corrigidos: **quadríceps** (y 340 → 330, estava quase no joelho), **joelhos** (y 383 → 362, estavam abaixo da patela) e **glúteos** nas costas (y 248 → 262, estavam no cós do short).
  - Nos outros 27 corpos, os pontos são adaptados pela silhueta (cabeça, virilha, pés, largura dos ombros).
  - Correções manuais onde isso não bastou: 75+ homem e mulher (short e coxas escondem a virilha), mulher 60–74 (tronco mais longo), glúteos da menina e da adolescente.
  - Resultado em `src/features/bodymap/hotspots.json`. O script em `scripts/hotspots/` refaz tudo e gera as folhas de conferência quando entrarem imagens novas.
- **Mapa do corpo (08, rota `/body`):**
  - Homem/Mulher e faixa de idade do modelo, trocáveis a qualquer momento sem mudar o perfil. Frente/Costas.
  - Pontos que viram laranja com halo ao tocar. Etiquetas escuras "PEITO SUPERIOR · CRESCER" com ×, e tocar numa etiqueta abre o objetivo daquela área.
  - O "Peito" escolhido na entrevista vira os 3 pontos do peito, e o "Abdômen" vira os 2.
- **Objetivos (09, rota `/goals`, abre como folha sobre o mapa):**
  - Miniatura do músculo com o destaque desenhado pelo app, nome anatômico, os 5 objetivos com descrição.
  - Exercícios, séries e dias por semana com botões − e +.
  - "Firmar e tonificar" diz "queima de gordura" só para adultos; adolescentes veem "final curto de cardio".
  - "Gerar meu treino" leva a uma tela provisória até o gerador existir (Fase 3).
- **Toque:** os pontos do peito ficam a ~18 px um do outro. Cada ponto tem sua área de toque, e um toque entre pontos vai para o mais próximo. O halo é só visual, para nunca roubar o toque do vizinho (achei esse problema no teste no navegador e corrigi).
- **Leitor de tela:** cada músculo aparece uma vez só, mesmo com dois pontos (esquerdo e direito), nas três plataformas.
- **Banco:**
  - Nome anatômico por músculo (`muscles.anatomy_i18n_key`).
  - Exercícios por treino e séries por exercício em `preferences`.
- **Fluxo:** o resumo do plano ("Está certo") agora leva ao mapa do corpo.

### Testes

- `npm run check`: lint, typecheck, Deno e **162 testes** (eram 139). Os novos cobrem:
  - os 28 modelos completos, só com músculos do banco, na vista certa, dentro do quadro e com esquerda/direita na ordem;
  - toque no ponto mais próximo;
  - expansão de "peito" e "abdômen";
  - ordem de prioridade e limites das quantidades;
  - texto sem "gordura" para adolescentes;
  - as telas (tocar, remover, frente/costas, trocar modelo sem mudar o perfil, folha de objetivos);
  - nomes anatômicos nos 3 idiomas.
- `npm run db:test`: passa, incluindo o limite de chamadas do coach.
- Fluxo completo no navegador (390×844), das boas-vindas até os objetivos, sem erros.

### Como testar

1. `git pull`, depois `npm install`, depois `npx expo start`.
2. Faça o onboarding. Em "Está certo" você cai no mapa.
3. Toque nos pontos, troque Frente/Costas, Homem/Mulher e a idade do modelo.
4. Toque numa etiqueta para mudar o objetivo, ajuste exercícios, séries e dias, e toque em "Gerar meu treino".

### Perguntas em aberto

1. **Quantidades:** exercícios, séries e dias aparecem na folha de cada músculo (como no mockup), mas valem para o treino inteiro, não por músculo. Pode ser assim?
2. **Alvos de toque:** os pontos do peito não cabem 44 px cada, por causa da anatomia. Resolvi com "toque vai para o ponto mais próximo". Se quiser, na Fase 8 dá para adicionar zoom com pinça.
3. **Nomes anatômicos** (ex.: "Peitoral maior · porção clavicular"): convém o revisor certificado conferir junto com os exercícios.
4. **Modelo de idade:** qualquer pessoa pode escolher qualquer faixa, inclusive a de criança (a SPEC diz "trocar a qualquer momento"). Quer limitar?
5. **Supabase:** aguardando a URL e a anon key do projeto.

## Decisões da Fase 2 aplicadas e Supabase (27/09/2026)

- **Folha de objetivos:** agora diz "Para o treino todo" acima de exercícios, séries e dias.
- **Idade do modelo:**
  - Perfis adultos veem só corpos 18+.
  - Corpos de criança e adolescente aparecem só em perfis de criança ou adolescente, incluindo o responsável que gerencia um desses perfis.
  - O modo de segurança continua vindo da data de nascimento.
- **Supabase (projeto "TapStrong App"):**
  - Todas as migrations aplicadas pelo conector.
  - O verificador de segurança apontou que o usuário anônimo podia executar duas funções internas; corrigi com uma migration.
  - `.env` local criado com a URL e a chave pública. Ele não vai para o git.
- **Ficou para depois:** pinça com zoom no mapa (Fase 8) e revisão dos nomes anatômicos pelo revisor certificado.

## Fase 3 — Biblioteca de exercícios e gerador (28/09/2026)

### Feito

- **Banco (biblioteca + revisão):**
  - Tabelas `exercises`, `exercise_muscles` e `exercise_reviews`, com padrão de movimento, onde o exercício pode entrar no treino (aquecimento, principal, finalizador, desaquecimento), tipo de dose, carga, lado único e impacto.
  - O próprio banco impõe as regras da SPEC §2.1:
    - todo exercício novo nasce rascunho;
    - cada passo exige revisão aprovada **da versão atual do mapeamento**: automática, depois segunda checagem, depois revisor certificado com nome e credencial;
    - `released` exige mídia licenciada; mídia de protótipo é recusada;
    - o mapeamento só muda em rascunho, e qualquer mudança invalida as revisões antigas.
  - Músculos ganharam grupo (empurrar / puxar / pernas / core).
- **Biblioteca de protótipo:** 71 exercícios, todos em **rascunho** (`supabase/seed/exercises.json` → `supabase/seed.sql`).
  - Passei de ~40 para 71 para cobrir aquecimento e desaquecimento em todas as posições (em pé, com apoio, sentado), em casa, na academia e ao ar livre.
  - Os mapeamentos seguem referências padrão, mas **precisam** da segunda checagem e do revisor certificado.
  - Nomes e instruções curtas nos 3 idiomas.
- **Rascunhos nunca chegam ao usuário:**
  - Só builds de desenvolvimento carregam a biblioteca de protótipo.
  - O `npm run bundle:check` exporta os bundles de produção (Android, iOS, web) e falha se algum contiver os rascunhos.
  - Esse teste pegou um erro meu (o rascunho estava entrando no bundle web de produção), que foi corrigido. Hoje: **0** em produção.
- **Checagem automática** (`autoCheck`): músculos só do banco, ênfases coerentes, criança sem carga e sem máquina, alto impacto sempre com as restrições certas, alongamento sempre em tempo, e mais. Os 71 passam.
- **Gerador determinístico** (`src/features/generator`), seguindo a SPEC §8:
  - **Filtros:** só `released` (rascunhos só em desenvolvimento), local e equipamento, faixa de idade, posição, restrições, dores e condições. Com problema cardíaco, gravidez ou cirurgia recente, só impacto zero. 60+ nunca recebe impacto alto.
  - **Aquecimento:** cardio leve (movimentos mais animados para jovens, com apoio primeiro para 60+), mobilidade das articulações do dia e série de aproximação do primeiro exercício com carga. A aproximação vale para adultos; adolescentes fazem só leve; crianças não fazem.
  - **Trabalho principal:** músculos escolhidos por prioridade, com dosagem pela tabela de objetivos.
  - **Passe de equilíbrio:** se a pessoa só escolhe peito, entram costas e pernas, a não ser que já tenham sido treinadas na semana. Nunca três sessões fortes seguidas no mesmo músculo.
  - **Finalizador:** cardio para perder peso ou condicionamento; mobilidade para mobilidade ou equilíbrio.
  - **Desaquecimento:** caminhada, alongamentos dos músculos treinados (com apoio da cadeira primeiro para 60+) e respiração.
  - **Tempo:** aquecimento e desaquecimento pelos minutos da tabela da SPEC. "Só 15 min" encolhe os dois (mínimo 3 e 2 min), nunca remove. Se não couber, sai primeiro o finalizador, depois o exercício de menor prioridade.
- **Troca de exercício (seu requisito novo):**
  - `getAlternatives`: até 5 opções, mesmo músculo principal e mesmo papel, mesmos filtros de segurança, sem repetir o que já está no treino. "Máquina ocupada" tira a mesma máquina. Ordem: ênfase → padrão de movimento → nível → slug.
  - `swapItem`: troca na mesma posição, nunca adiciona, mantém as séries, recalcula as repetições pelo objetivo e, com séries já feitas, vale só para as que faltam. A série de aproximação acompanha a troca.
  - SPEC §7, §8 e §9 atualizadas, com a lista das melhorias pós-MVP na ordem que você passou.
  - A tela da troca, o "Desfazer" de 5 s, o evento e o histórico salvo entram na Fase 4 (a lógica já está pronta).
- **Prévia:** depois de "Gerar meu treino", o build de desenvolvimento mostra o treino gerado. O de produção diz que a biblioteca está em revisão.
- **Correção encontrada no teste da web:** ícones e imagens decorativas geravam um aviso de atributo inválido. Corrigido.

### Testes

- `npm run check`: **226 testes** (eram 166). Os 41 do gerador cobrem:
  - estrutura correta em **192 combinações** (4 modos × 3 posições × 4 locais/equipamentos × 4 durações);
  - todo item gerado passando por todos os filtros;
  - só `released` sem rascunhos;
  - restrições, condições, 60+, criança, sentado, local e equipamento;
  - dosagem, aproximação, finalizador, tempo e equilíbrio;
  - determinismo, mesmo com a biblioteca em outra ordem;
  - troca: mantém o músculo, nunca viola restrição, nunca repete, máquina ocupada, ordem, séries já feitas.
- `npm run db:test`: passa, incluindo o fluxo de revisão (liberação sem revisão, com mídia de protótipo, mapeamento travado, versão nova invalida revisões, app só enxerga `released`).
- `npm run bundle:check`: 0 rascunhos nos bundles de produção.

### Como testar

1. `git pull`, depois `npm install`, depois `npx expo start` (Expo Go é build de desenvolvimento, então mostra a prévia).
2. Faça o onboarding, marque músculos no mapa e toque em "Gerar meu treino".
3. Troque o local, o tempo e a posição no resumo e veja o treino mudar.

### Perguntas em aberto

1. **Revisão dos 71 exercícios:** antes de qualquer lançamento, o revisor certificado precisa aprovar cada um. Quer que eu prepare uma planilha de revisão (exercício, músculos, ênfases, contraindicações) para mandar a ele?
2. **Edge Function do coach:** ainda falta você fazer duas coisas no painel do Supabase:
   - **Authentication → Sign In / Providers → Allow anonymous sign-ins** (ligar);
   - cadastrar a chave da Claude no terminal: `npx supabase secrets set ANTHROPIC_API_KEY=... --project-ref vycdrotqkjwvkzgjovpb`.
     Quando estiver feito, eu publico a função.
3. **Adolescentes e carga:** o gerador prefere peso do corpo e elástico para menores; halteres só entram quando são claramente o melhor exercício para o músculo. Pode ser assim?

## Fase 4 — Fluxo do treino

### Feito

- **Abas:** Início e Corpo. Coach, Progresso e Família entram nas fases delas.
- **Início (mockup 07, versão enxuta):** dias seguidos, card "Hoje" com "Começar · 40 min" (ou "Continuar treino") e mapa de recuperação com legenda.
- **Lista do treino (10):**
  - aquecimento (verde-petróleo) → exercícios → desaquecimento;
  - nota do coach (equilíbrio, descanso, corte por tempo);
  - "Só 15 min hoje" (gera de novo com 15 min, mantendo aquecimento e desaquecimento);
  - "Máquina ocupada" (pergunta qual máquina se houver mais de uma);
  - selo do revisor certificado. Só aparece quando **todos** os exercícios estão `released`; no build de desenvolvimento aparece o aviso de rascunho.
- **Troca (seu requisito MVP):**
  - botão "Trocar" em cada item, na lista e no player;
  - sheet com até 5 alternativas e "Substituir";
  - troca na mesma posição, com "Desfazer" por 5 s;
  - estado vazio "No safe alternative for this muscle with your equipment.";
  - evento `exercise_swapped` (user_choice / machine_taken / pain) e histórico salvo;
  - com séries já feitas, a troca vale só para as que faltam.
- **Player (11):**
  - aquecimento → exercícios → desaquecimento, na ordem;
  - passos com timer para aquecimento e desaquecimento;
  - registro da série com ± repetições (ou segundos) e ± carga (lb/kg pelo perfil), com Trocar / Descanso / Sinto dor;
  - progressão da SPEC: topo da faixa em 2 sessões → sugere +5 lb / +2,5 kg; abaixo da faixa em 2 → manter;
  - aquecimento com carga pode ser encurtado (depois da metade), não pulado;
  - "Pular desaquecimento?" pede confirmação.
- **Descanso (12):** tela escura, anel com contagem, +30 s, pular, "Registrado", "Última sessão" e "A seguir" com dica de progressão. Volta sozinho ao player quando o tempo acaba.
- **Dor (21):** onde (ombro direito/esquerdo, pescoço, cotovelo/punho, lombar, quadril, joelho, tornozelo/pé, outro) e tipo.
  - **Aguda** → parar hoje (salva o que foi feito).
  - **Incômodo** → troca segura para o mesmo músculo, que poupa a área, mais "Salvar em Minhas restrições" (marcado por padrão, como a SPEC pede). Sem troca segura → "Pular este exercício".
  - **Só cansaço** → descansar e continuar.
  - A restrição salva filtra todos os próximos treinos. Para o analytics vai só o tipo da dor, nunca a área.
- **Sair (13):** "Você fez X de Y séries", Continuar / Salvar e encerrar / Descartar.
- **Concluído (14):**
  - o corpo fica vermelho no alvo e laranja no "também trabalhado";
  - tempo, séries e o músculo com mais séries;
  - dias seguidos;
  - "Termine forte": o grupo empurrar/puxar/pernas parado há 5+ dias (ou nunca treinado). "Mais 10 min" gera um treino curto, com aquecimento e desaquecimento; "Pernas na próxima" põe esse grupo primeiro no próximo treino.
- **Cores de recuperação:** saem do histórico (`muscle_activity` derivada), nas faixas da SPEC (96 h para 60+). Só a parte principal pinta; aquecimento, desaquecimento e finalizador não. O cinza-azulado aparece só para músculos que a pessoa acompanha (metas ou já treinados), e só depois do primeiro treino, para o corpo de quem acabou de chegar não ficar todo cinza.
- **Dias seguidos:**
  - um dia de descanso por semana (segunda a domingo) não quebra;
  - a cada 7 dias ativos, ganha 1 proteção (máximo 2), que cobre um dia perdido depois que o descanso da semana já foi usado;
  - qualquer treino com algo registrado conta, até "Salvar e encerrar".
- **Banco:**
  - migration `workout_flow` com plans, sessions, session_items, set_logs, muscle_activity, streaks, pain_reports e exercise_swaps, todas com RLS;
  - aplicada no projeto Supabase; o app continua local até a Fase 5;
  - SPEC §7 ajustada: `sessions.profile_id` e status `active`, `set_logs.exercise_id`.
- **Correção de bug antigo:** "Recomeçar" não limpava respostas opcionais (ano de nascimento, local, minutos). Corrigido e testado.

### Testes

- `npm run check`: **270 testes** (eram 227), lint, typecheck e Deno limpos.
  - Lógica (25): dias seguidos (descanso semanal, proteção, quebra), cores de recuperação, fluxo do player, progressão, desfazer em 5 s.
  - Telas (16): troca na mesma posição + desfazer + evento; máquina ocupada nunca oferece a mesma máquina; estado vazio; "Só 15 min"; player → descanso; pular desaquecimento; dor aguda / incômodo / sem troca; restrição filtrando o próximo treino; sair; concluído; "Mais 10 min".
- `npm run db:test`: passa, incluindo `workout_flow.sql`:
  - um estranho não vê nem grava nada no treino de outra pessoa;
  - uma troca não pode apontar para a sessão de outro perfil;
  - as constraints funcionam (máximo 2 proteções, repetições mín ≤ máx, carga exige unidade, série duplicada).
- `npm run bundle:check`: 0 rascunhos nos bundles de produção.

### Como testar

1. `git pull`, depois `npm install`, depois `npx expo start` (no Expo Go os dados duram só a sessão; num development build ficam salvos).
2. Faça o onboarding, marque o peito e toque em "Gerar meu treino".
3. Na lista:
   - toque em ⇄ num exercício → "Substituir" → "Desfazer";
   - teste "Só 15 min hoje".
4. "Começar pelo aquecimento":
   - faça as séries;
   - toque em "Sinto dor" → Joelho → Incômodo → Aceitar troca.
5. Toque no × → "Salvar e encerrar": o corpo fica vermelho, e a Início mostra o mapa de recuperação.

### Perguntas em aberto

1. **Ombro e peito:** com dor no ombro, a biblioteca de rascunho não tem nenhum exercício de peito que poupe o ombro (todos têm "shoulder" como contraindicação). O app oferece "Pular este exercício". Vale pedir ao revisor uma opção segura (por exemplo, supino no chão com pegada neutra e amplitude curta), como no mockup 21?
2. **Semana começa na segunda** para a regra de "1 descanso por semana". Nos EUA o calendário costuma começar no domingo. Prefere domingo?
3. **Vídeos:** o player mostra um quadro neutro "Demo · loop" até chegar a biblioteca licenciada. Os `ex-*.mp4` de protótipo não entram no app, conforme a SPEC.
4. **Teste real do coach:** a função `coach-interview` (v2) está publicada, mas este ambiente bloqueia `vycdrotqkjwvkzgjovpb.supabase.co`. Duas saídas:
   - liberar esse domínio nas configurações de rede do ambiente; ou
   - testar no seu celular pelo Expo Go, com o `.env` no PC.

### Ajustes pedidos depois da Fase 4

- **Peito sem forçar o ombro:** 3 exercícios novos em rascunho para o revisor (a biblioteca passa de 71 para 74, e a planilha foi regerada):
  - supino no chão com pegada neutra;
  - supino na máquina com pegada neutra;
  - flexão inclinada com amplitude curta.

  Nenhum deles tem o ombro como contraindicação; o revisor confirma ou corrige. Com dor no ombro num exercício de peito do meio, o app já oferece um deles no build de desenvolvimento. Para o peito superior ainda não há opção, então fica "Pular este exercício".

- **Semana:** começa no dia que o calendário do celular indicar; sem essa informação, domingo.
- **Vídeos de protótipo:**
  - só no build de desenvolvimento, com a mesma proteção dos rascunhos (`expo-video` instalado; loop sem som);
  - como usar: copie os `ex-*.mp4` para `assets/prototype/`, diga em `map.json` qual exercício cada vídeo mostra e rode `npm run prototype:videos`;
  - `npm run bundle:check` agora também falha se o mapa de vídeos ou qualquer `.mp4` aparecer num bundle de produção. Testei com um vídeo falso nos dois sentidos: com a proteção, o bundle sai limpo; sem ela, a checagem falha.

## Fase 5 — Conta e crescimento

### Feito

- **Salvar progresso (mockup 16):**
  - conta por **código no e-mail** (6 dígitos, sem senha e sem link);
  - o usuário anônimo que o coach já usa ganha o e-mail: **é a mesma conta**, e nada se perde;
  - se o e-mail já tem conta, o app entra nela e copia os dados do celular para lá;
  - "Agora não" fica lembrado;
  - aparece como "Salvar meu progresso" na tela de concluído;
  - modo criança não vê o formulário, só o aviso de que o responsável cria o perfil pelo plano Família.
- **Sincronização:** depois de salvar, e após cada treino, o celular copia para a conta:
  - perfil, checagem de saúde, preferências, metas por músculo, restrições, dias seguidos, atividade muscular e medalhas;
  - os treinos concluídos, com itens, séries, trocas e relatos de dor.

  Cada treino é copiado uma vez, e repetir não duplica. Perfis de criança nunca sincronizam a partir do celular da criança (isso fica para a Fase 6, com o responsável). Treinos feitos com exercícios de rascunho não sobem, porque o banco só aceita exercícios liberados; por isso, hoje no desenvolvimento os treinos ficam no celular.

- **Cartão de compartilhamento (mockup 15):**
  - mapa muscular de hoje, dias seguidos, treinos, minutos e séries;
  - o botão gera a imagem e abre o compartilhamento do celular;
  - "Enviar meu link de convite" aparece quando a conta está salva;
  - escondido no modo criança;
  - o cartão mostra só o mapa, nunca fotos, medidas ou dados de saúde.
- **Convites:**
  - cada conta salva tem um código de 7 letras, e o link é `tapstrong://r/CÓDIGO` (ou `https://tapstrong.app/r/CÓDIGO` quando o domínio existir; é só preencher `EXPO_PUBLIC_SHARE_BASE_URL`);
  - quem abre o link guarda o código, que é registrado quando a pessoa salva a conta;
  - uma vez por pessoa, nunca com o próprio código;
  - contas anônimas e perfis de criança não geram código.
- **Marcos (mockup 24):**
  - a cada 7 dias seguidos, a tela de concluído mostra "Ver minha conquista";
  - a tela tem a semana, as medalhas (primeiro treino, 7 dias, primeiro recorde, semana de corpo inteiro, 30 dias) e "Compartilhar minha sequência" (fora do modo criança).
- **Notificações (locais, sem servidor):**
  - lembretes nos dias de treino (3 dias → seg, qua e sex) no horário escolhido;
  - "Salva-sequência": um aviso às 20h se a sequência está viva e nada foi registrado no dia;
  - a permissão só é pedida quando a pessoa liga a opção;
  - tudo é reagendado quando o treino, a sequência ou o idioma mudam.
- **Banco:**
  - migration `account_growth` com referral_codes, referrals e badges, com RLS; códigos e convites só são gravados pelas funções do banco;
  - aplicada no Supabase;
  - SPEC §7 atualizada.
- **Pacotes novos (gratuitos, do Expo):** expo-notifications, expo-sharing, react-native-view-shot.

### Testes

- `npm run check`: **306 testes** (eram 276), lint, typecheck e Deno limpos.
  - Sincronização: mapeamento completo; ids do banco; rascunhos pulados; nunca duplica; criança bloqueada; ordem de gravação; parada no primeiro erro; reaproveita o perfil ao entrar numa conta existente.
  - Conta por e-mail: upgrade do anônimo; conta já existente; código errado; limite de envio; sem conexão.
  - Notificações, medalhas e formato do código de convite.
  - Telas: salvar progresso, código errado, "Agora não", permissão negada, modo criança; cartão (com e sem conta, escondido para criança); marco; link de convite; botões da tela de concluído.
- `npm run db:test`: passa, incluindo `account_growth.sql`:
  - o código é o mesmo sempre;
  - o próprio código não vale;
  - só uma vez por pessoa;
  - anônimo não gera código;
  - ninguém grava código direto;
  - medalhas com RLS.
- `npm run bundle:check`: limpo.

### Como testar

1. `git pull`, depois `npm install`, depois `npx expo start`.
2. Termine um treino e toque em "Salvar meu progresso". Digite seu e-mail e o código que chegar (veja o passo 1 das perguntas abaixo antes).
3. Toque em "Compartilhar meu mapa".
4. Na tela de conta, ligue "Lembretes de treino".
5. Link de convite: abra `tapstrong://r/ABCDEFG` no celular com o app instalado.

### Perguntas em aberto

1. **Código no e-mail — ajuste no painel do Supabase** (sem isso, o e-mail chega com link em vez de código). Em Authentication → Emails → Templates, coloque `{{ .Token }}` no corpo de:
   - **Change Email Address** (é o de quem salva o progresso pela primeira vez);
   - **Magic Link** (é o de quem entra numa conta que já existe).

   O e-mail padrão do Supabase tem limite baixo de envio; para lançar, vale configurar um SMTP próprio (Resend e SendGrid têm plano grátis). Isso é um serviço externo, então só com o seu OK.

2. **Apple e Google:** os botões do mockup ficam para quando existirem as contas de desenvolvedor (Apple: "Sign in with Apple"; Google: um client ID OAuth). Quando tiver, me passe (sem segredos no chat) e eu ligo. Detalhe: na App Store, se houver login com Google, a Apple exige o login com Apple também.
3. **Recompensa do convite:** o mockup diz "Friends who join with your link get 1 free week, and so do you". Isso mexe com pagamento, então deixei só o registro do convite, sem prometer a semana grátis na tela. Confirma a recompensa para a Fase 6?
4. **Excluir conta:** a Apple exige que quem cria conta no app possa excluí-la pelo próprio app. Como apagar dados precisa do seu OK: posso fazer na Fase 6 ou 8 (apaga a conta e todos os dados dela, com confirmação)?
5. **Coach:** a rede deste ambiente ainda bloqueia `vycdrotqkjwvkzgjovpb.supabase.co`; testei agora e continua bloqueado. A liberação pode valer só para sessões novas. Se preferir, teste no Expo Go.

## Fase 6 — Pagamentos e família

Decisões suas aplicadas: anual US$ 59,99 (Premium) e US$ 89,99 (Família); Família com até 5 perfis; consentimento COPPA pela compra do plano Família na loja (o teste grátis não conta); RevenueCat só em código por enquanto; recompensa de convite; excluir conta.

### Feito

- **Limite do plano Grátis:** 3 treinos por semana, pela semana do calendário do celular.
  - O 4º treino abre o paywall, que diz quando vem o próximo treino grátis.
  - O finalizador de 10 min não conta.
- **Paywall:** primeiro o valor, depois o preço, com as condições logo abaixo do botão:
  - quanto custa depois do teste;
  - aviso 2 dias antes da cobrança;
  - "Cancele quando quiser em 2 toques".

  Para assinar é preciso ter conta salva, assim a assinatura sempre fica ligada a uma conta e dá para restaurar depois.

- **Planos (mockup 19):** perfis da família, Grátis / Premium / Família, mensal ou anual. Mostra o preço da loja quando existe; se não, os preços de tabela.
- **Cobrança (mockup 22):**
  - plano, fim do teste, primeira cobrança e valor seguinte;
  - a promessa de cobrança;
  - "Cancelar assinatura" abre a página de assinaturas da App Store ou do Google Play;
  - "Restaurar compras" e "Excluir conta".
- **Lembrete do fim do teste:** notificação 2 dias antes da cobrança, agendada mesmo com os outros lembretes desligados. A permissão é pedida quando o teste começa.
- **RevenueCat:**
  - o SDK (`react-native-purchases`) está instalado e é usado quando as chaves públicas estão no `.env`;
  - sem chaves, o build de desenvolvimento usa um **simulador** (teste de 7 dias, "Dev: primeira cobrança", "Dev: voltar ao Grátis"), e o de produção diz "assinaturas ainda não disponíveis";
  - o `bundle:check` agora também prova que o simulador não vai para a loja.
- **Família (aba nova):**
  - até 5 perfis no celular, cada um com seus próprios dados;
  - trocar de perfil guarda o atual e carrega o outro;
  - a Início mostra "Treinando como Mia".
- **Adicionar familiar:**
  - **Filho ou filha menor de 18 / pai, mãe, avô ou avó:** precisa do plano Família (o teste grátis vale);
  - **Criança com menos de 13:** só depois da **primeira cobrança** do plano Família. Antes de criar, o responsável lê o aviso aos pais e marca "Sou o pai, a mãe ou o responsável legal e concordo". O banco só cria o perfil pela função `create_child_profile()`, que exige o plano cobrado e o aviso aceito, e grava o registro de consentimento com a transação da loja.
- **Sincronização da família:** o perfil ativo sincroniza. Os familiares ficam como perfis gerenciados pela sua conta (sem login próprio), e criança sincroniza sem medidas do corpo.
- **Recompensa de convite:**
  - 1 semana grátis de Premium para os dois, liberada só quando o convidado **concluir o primeiro treino**;
  - o convidado recebe uma vez; quem convidou também recebe uma vez no total (veja a pergunta 3);
  - quem concede é o servidor, com a chave secreta do RevenueCat.
- **Excluir conta:** apaga a conta e todos os dados no Supabase (incluindo perfis da família, consentimentos e convites) e limpa o celular. A tela explica que a assinatura **não** é cancelada ao excluir e tem o botão para abrir as assinaturas da loja. Pede para digitar EXCLUIR. Sem conta salva, apaga só os dados do celular.
- **Servidor:**
  - migration `billing_family` com subscriptions, consent_records, limite de 5 perfis e a regra da criança;
  - Edge Functions `revenuecat-webhook`, `referral-reward` e `delete-account`, todas publicadas.

### Testes

- `npm run check`: **338 testes** (eram 306), lint, typecheck e Deno limpos.
  - Regras dos eventos do RevenueCat:
    - teste não conta como cobrança;
    - a primeira renovação paga registra a cobrança;
    - cancelar mantém o acesso até o fim;
    - eventos fora de ordem são ignorados;
    - a semana grátis nunca mexe num plano pago;
    - sandbox fica marcado como teste.
  - Limite de 3 por semana; preços; links da loja; simulador; lembrete de 2 dias; troca de perfis sem misturar dados; máximo de 5; criança só com consentimento; sincronização da criança como perfil gerenciado.
  - Telas: paywall no 4º treino; Premium libera; paywall honesto; teste do Família; cobrança com fim do teste e cancelar; família (sem plano, criança no teste bloqueada, criança depois da cobrança, aviso aos pais, avô no teste); excluir conta (só celular e com conta).
- `npm run db:test`: passa, incluindo `billing_family.sql`:
  - o app não consegue se dar um plano;
  - sem plano Família não há perfis gerenciados;
  - durante o teste grátis não se cria perfil de criança;
  - também não por insert direto nem sem o aviso;
  - com o plano cobrado, o consentimento é gravado;
  - o 6º perfil é recusado;
  - excluir a conta apaga tudo em cascata.
- `npm run bundle:check`: limpo (sem rascunhos, vídeos de protótipo ou simulador).

### Como testar (build de desenvolvimento, com o simulador)

1. Faça 3 treinos; o 4º abre o paywall.
2. Salve a conta e, em Planos, toque em "Começar teste grátis de 7 dias".
3. Na aba Família, "Adicionar" um avô (funciona no teste). Uma criança de 10 anos fica bloqueada até "Dev: primeira cobrança"; depois disso vem o aviso aos pais.
4. Em Cobrança, veja fim do teste, primeira cobrança e "Cancelar assinatura".

### O que falta do seu lado (RevenueCat e lojas)

1. Criar os produtos nas lojas com teste de 7 dias: `tapstrong_premium_monthly`, `tapstrong_premium_annual`, `tapstrong_family_monthly`, `tapstrong_family_annual`.
2. No RevenueCat:
   - criar os entitlements `premium` e `family` (o Família inclui os dois);
   - pôr as chaves **públicas** no `.env` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`);
   - nos segredos do Supabase, pelo terminal: `REVENUECAT_SECRET_KEY` e `REVENUECAT_WEBHOOK_SECRET`;
   - configurar o webhook para `https://vycdrotqkjwvkzgjovpb.supabase.co/functions/v1/revenuecat-webhook`, com o header Authorization `Bearer <o mesmo segredo>`.
3. O RevenueCat precisa de um development build (`eas build --profile development`); no Expo Go ele não roda, e o app usa o simulador.

### Perguntas em aberto

1. **Advogado (COPPA):** o texto do aviso aos pais e o método (compra na loja + aviso aceito) precisam da revisão antes do lançamento. O aviso tem versão (`parent-notice-v1`), então dá para trocar o texto sem perder o histórico.
2. **Lembrete:** a SPEC diz 2 dias antes da cobrança; os mockups 19 e 22 dizem 3. Segui a SPEC. Quer 3?
3. **Convite, quem convidou:** entendi "uma vez por pessoa" como: cada pessoa ganha a semana uma vez só, então quem convida ganha só no primeiro amigo que treinar. Se preferir uma semana por amigo (com um teto, por exemplo 12 por ano), é uma linha.
4. **"Pais podem ver o progresso" (60+) e painel dos pais:** a troca de perfil já permite acompanhar no mesmo celular. Um painel à parte fica para a Fase 7 (Progresso)?
5. **Rede:** `vycdrotqkjwvkzgjovpb.supabase.co` ainda está bloqueado nesta sessão (testei de novo). A liberação deve valer numa sessão nova.

## Fase 7 — Progresso e Repair

Decisões suas aplicadas: painel da família visível só para o dono do plano Família; lembrete do teste 3 dias antes (já no commit anterior); convite com 1 semana por amigo, teto de 4 por ano para quem convida.

### O que foi feito

- **Aba Progresso (mockup 18):**
  - dias seguidos, treinos e séries;
  - gráfico de séries por semana (4 semanas) por músculo; os objetivos aparecem primeiro, depois os mais treinados;
  - medidas para adultos; para menores, só "seu check-in compara sua força";
  - links para Repair, Minhas restrições e fotos (fotos só no modo adulto).
- **Check-in de 4 semanas (mockup 25):**
  - fica pronto 4 semanas depois do primeiro treino e depois a cada 4 semanas (aviso na Home e no Progresso);
  - tabela de força: melhor série da semana 1 contra a semana 4 (carga × reps, reps ou segundos);
  - cintura, peso e altura (opcionais), cintura/altura como índice principal e IMC com o aviso de que pode enganar; **só adultos e 60+**;
  - nota do coach determinística e encorajadora, sem conselho médico.
- **Antes e depois (mockup 26):**
  - só no modo adulto (menores e 60+ são redirecionados);
  - câmera do sistema, três poses; os arquivos ficam **só no celular**, nunca sobem;
  - excluir conta apaga as fotos;
  - compartilhar usa o mapa muscular, nunca a foto.
- **Repair (mockup 17):**
  - 5 testes em **rascunho** (sentar e levantar 30 s, equilíbrio em uma perna, ponte de glúteo, prancha, alcance do ombro);
  - filtrados por posição, áreas de dor, condições e restrições;
  - cada teste tem timer, contador e esquerda/direita;
  - resultado bom / desigual / baixo / limitado;
  - plano de 6 semanas (2 sessões de 15 min por semana, com aquecimento e desaquecimento) e data do reteste;
  - o plano é Premium; o check é grátis;
  - como os exercícios, os testes só existem no build de desenvolvimento até o revisor aprovar (`bundle:check` confere).
- **Minhas restrições (mockup 20):**
  - restrições ativas com origem e data, quantos exercícios ficam de fora e quantas trocas já aconteceram;
  - áreas do check de segurança;
  - marcar como curado, reativar, adicionar manual com área e lado ("os dois lados" = a área toda).
- **Painel da família:** só na visão do dono do plano. Mostra, por membro: treinos e minutos da semana, último treino e dias seguidos. Nunca mostra respostas de saúde, relatos de dor ou fotos.
- **Banco (aplicado no Supabase):**
  - tabelas `checkins`, `repair_results` e `repair_plans`, com RLS;
  - um gatilho recusa cintura, peso, cintura/altura e IMC em perfis de criança ou adolescente;
  - tipo de sessão `repair`;
  - corrigi também um alerta de segurança do Supabase: a função de gatilho `guard_managed_profiles` não fica mais exposta na API.
- **Planilha do revisor:** nova aba "Repair tests" (protocolo, meta "bom" por modo, contraindicações e músculos do plano), com Aprovar/Corrigir.

### Verificações

- `npm run check`: lint, typecheck, funções e **365 testes** passando. Os testes novos cobrem:
  - estatísticas;
  - check-in (4 semanas, força, cintura/altura, IMC, nota);
  - Repair (músculos só do banco, filtros de segurança, notas, plano, sessão com aquecimento e desaquecimento);
  - impacto das restrições e resumo da família;
  - telas: menor sem campos de corpo, fotos só para adulto, plano Repair Premium, restrições e painel só para o dono.
- `npm run db:test`: passa, incluindo `progress_repair.sql` (adolescente não grava medidas, nem por update; estranho não vê nada).
- `npm run bundle:check`: limpo.
- Não consegui recalcular a planilha com o LibreOffice aqui (trava no ambiente). As fórmulas recalculam ao abrir no Excel ou no Google Planilhas.

### Como testar (build de desenvolvimento)

1. Faça alguns treinos. Para ver o check-in pronto, é preciso ter treinos com 4 semanas.
2. Progresso → "Repair check": faça os testes e veja o resultado. "Montar meu plano" abre o paywall no plano grátis; com o Premium (simulador), abre o plano.
3. Progresso → Minhas restrições: adicione "Joelho, os dois lados" e veja quantos exercícios saem.
4. Com um perfil adolescente, o check-in não pede cintura nem peso, e não há fotos.
5. No plano Família, a aba Família do dono mostra a semana de cada membro.

### Perguntas em aberto

1. **Revisor:** os 5 testes Repair (protocolo, metas por idade e músculos) precisam da aprovação do profissional certificado, como os exercícios. Até lá, só aparecem no desenvolvimento.
2. **Antes e depois no 60+:** o mockup 23 não tem câmera, então no modo 60+ as fotos ficam escondidas. Quer liberar para 60+?
3. **Guia de pose:** a SPEC fala em "mesma pose" com um contorno na câmera. Usei a câmera do sistema (sem contorno) para não adicionar outra biblioteca nativa. O contorno exige câmera própria (`expo-camera`); faço na Fase 8?
4. **Sincronizar check-ins e Repair:** as tabelas já existem no banco, mas por enquanto os dados ficam no celular, como os treinos com exercícios de rascunho. Ligo a sincronização na Fase 8, junto com os exercícios liberados?
5. **Home 60+:** o redesenho da Home no modo 60+ (mockup 23) fica para o passe de modo sênior da Fase 8.
6. **Texto da permissão da câmera:** está em inglês (é o texto do sistema). A tradução para ES e PT-BR entra na Fase 8, com os idiomas.

## Fase 8 — Acabamento e preparação para o lançamento

Suas decisões aplicadas:

- os 5 testes Repair entram na revisão do revisor certificado;
- fotos no 60+ desligadas por padrão e ligadas pela aba Progresso;
- contorno de pose só depois do lançamento;
- check-ins e Repair sincronizam (medidas só de adultos, fotos nunca);
- tela inicial 60+;
- aviso da câmera em ES e PT-BR.

### O que foi feito

- **Tela inicial 60+ (mockup 23):**
  - saudação e um "Começar" grande (verde-azulado), com opções sentado quando for o caso;
  - "Meu progresso" e o card do último treino com "Ler para mim" (voz do celular, `expo-speech`);
  - no 60+ não aparece a aba do mapa do corpo nem atalhos para a câmera;
  - as abas ficam com letra maior.
- **Fotos no 60+:** interruptor na aba Progresso, desligado por padrão. Com ele desligado, a tela de fotos redireciona.
- **Aviso da câmera:** texto do iOS em EN, ES e PT-BR (`assets/locales/`). Só a câmera é pedida; galeria e microfone ficam bloqueados.
- **Sincronização:** check-ins, resultados e plano Repair sobem para o Supabase. Medidas corporais só de adultos e 60+; fotos nunca.
- **Mapa do corpo:** zoom com pinça, arraste com dois dedos e botões + e − para quem não consegue fazer o gesto. Os pontos continuam alinhados.
- **Acessibilidade:** novos testes automáticos cobrem:
  - fonte mínima de 13 px;
  - todo botão tocável com papel para o leitor de tela;
  - todo botão de ícone com rótulo;
  - novos pares de contraste.
- **Sentry e PostHog:**
  - só ligam com as chaves públicas no `.env`;
  - sem captura automática, sem gravação de sessão, sem perfil de pessoa e sem localização;
  - nada é enviado de um perfil de criança;
  - o Sentry não envia dados pessoais.
- **Ícone e splash:** T branco com o ponto laranja do mapa, sem gradiente. O splash mostra "TAPSTRONG" com o ponto. O script é `scripts/build-icons.py`.
- **EAS:** `eas.json` com os perfis development, preview (teste interno) e production.
- **Maestro:** 6 fluxos E2E em `.maestro/`:
  - onboarding;
  - primeiro treino;
  - dor com troca;
  - criança bloqueada;
  - tela 60+;
  - paywall.
- **Lojas:** textos em 3 idiomas, rótulos de privacidade da Apple e do Google e guia do SMTP com Resend, tudo em `docs/store/`.
- **Relatório de lançamento:** `docs/launch-readiness.md`, com tudo o que ainda depende de você.

### Verificações

- `npm run check`: lint, typecheck, funções e **379 testes** passando.
- `npm run db:test` e `npm run bundle:check`: limpos.
- `expo-doctor`: 19 de 21 verificações passam. As 2 que falham precisam de rede, que está bloqueada aqui.
- **Maestro:** os fluxos não rodaram aqui, porque precisam de simulador e de um build. Rode com `maestro test .maestro/` no build de preview; podem precisar de ajustes finos no primeiro uso.

### Como testar

1. Crie um perfil nascido em 1955. A tela inicial é a do 60+, sem a aba Corpo. Faça um treino e toque "Ler para mim".
2. Na aba Progresso do 60+, ligue "Fotos de antes e depois" e veja o atalho aparecer.
3. No mapa do corpo (adulto), use a pinça ou o botão +, e toque um músculo com o zoom ligado.

### Perguntas em aberto

1. **Aba Coach:** o chat contínuo (SPEC §9 e §11.4) não entrou em nenhuma fase e não foi construído. Faço antes do lançamento?
2. **Ícone:** aprova o novo ou prefere um designer?
3. Os demais itens estão em `docs/launch-readiness.md`.

## Fase 9 — "Movimento que dói"

Decisões aplicadas: a Aba Coach fica para a primeira atualização e o ícone está aprovado para os testes.

### O que foi feito

- **Catálogo de movimentos (rascunho):** 8 articulações e 41 movimentos, cada um com exemplo do dia a dia em EN, ES e PT-BR (`supabase/seed/joint_movements.json`).
  - Ombro: levantar à frente, levantar de lado, levar a mão às costas, girar para fora, girar para dentro, acima da cabeça, empurrar, puxar, carregar.
  - Também cotovelo, punho, pescoço, lombar, quadril, joelho e tornozelo.
  - Como os exercícios, só existe no build de desenvolvimento até o revisor aprovar. O `bundle:check` confere.
- **Relato de dor** (Restrições, Repair e Progresso → "Quais movimentos doem?"):
  - área e lado;
  - triagem de alerta vermelho;
  - cada movimento marcado como "Dói", "Sem dor" ou "Não testei";
  - nota de 0 a 10 e há quanto tempo dói.
    Criança só passa com a confirmação de que o responsável está junto.
- **Alerta vermelho** (queda ou pancada, dor forte à noite, formigamento, fraqueza, inchaço ou calor, febre): mensagem "procure um médico primeiro". O app não monta plano e deixa a área inteira fora dos treinos.
- **Etiquetas:** os 74 exercícios e os 5 testes Repair ganharam as articulações, os movimentos e a amplitude que usam (completa, parcial ou contração sem mover), além do campo `range_limit` (onde a amplitude curta é permitida).
- **8 exercícios de recuperação em rascunho**, que só aparecem no plano de recuperação, nunca no treino comum:
  - contrações na parede para o ombro, nas 4 direções;
  - rotação externa com elástico;
  - contração da coxa;
  - recolher o queixo;
  - contração do punho.
- **Gerador:** para uma área com relato, a restrição da área inteira é trocada pelas regras por movimento, nesta ordem:
  1. tira os exercícios que usam um movimento que dói ("Não testei" conta como dor, por segurança);
  2. mantém os que só usam movimentos sem dor;
  3. usa amplitude curta quando o exercício permite, com o aviso "Amplitude curta: pare antes de doer".
     Duas regras extras:
  - contração sem mover na direção que dói é permitida com dor até 5;
  - dor 7 ou mais tira a articulação inteira.
    O aquecimento e o desaquecimento continuam sempre.
- **Plano de recuperação** (dentro do Repair, sessões de 15 min):
  - fase 1: contrações leves e amplitude sem dor;
  - fase 2: fortalecimento sem dor;
  - fase 3: amplitude curta dos movimentos doloridos e mais séries.
- **Semáforo:**
  - um botão "Dê nota à dor" no fim de cada treino e um aviso às 8h30 da manhã seguinte;
  - 0–3 verde (sobe um passo), 4–5 amarelo (mantém), acima de 5 vermelho (desce um passo);
  - são 6 passos, dois por fase.
- **Reteste semanal:** os movimentos doloridos recebem nota de novo, com gráfico no Progresso. Se piorar, ou se não melhorar em 3 semanas, o app recomenda fisioterapeuta.
- **Regras fixas:**
  - nunca diagnostica;
  - nada de dor vai para o analytics (há teste que confere);
  - os dados de dor sincronizam com o Supabase (tabela `movement_pains`, com RLS) e são apagados junto com a conta.
- **Banco (aplicado no Supabase):** colunas novas em `exercises` e a tabela `movement_pains`.
- **Planilha do revisor:** colunas "Joint movements" e "Shorter range allowed" nos exercícios e nos testes Repair, e a aba nova "Movements" com o catálogo, os alertas, as fases e o semáforo.

### Verificações

- `npm run check`: lint, typecheck, funções e **416 testes** passando. Entram 37 testes novos, entre eles:
  - cada regra do gerador;
  - o caso do ombro: levantar e baixar sem dor, lateral e rotação doendo;
  - semáforo, fases, reteste e fisioterapeuta;
  - aviso da manhã, sincronização e telas.
- `npm run db:test` (com o teste de `movement_pains`) e `npm run bundle:check`: limpos.

### Como testar (build de desenvolvimento)

1. Restrições → "Quais movimentos doem?" → Ombro, Direito, "Nenhum destes". Marque "Levantar o braço de lado" e "Girar o braço para fora" como Dói e "Levantar o braço à frente" como Sem dor, nota 4, "2 a 6 semanas".
2. No plano, "Começar uma sessão de recuperação de 15 min": na fase 1 aparecem contrações na parede e exercícios sem dor.
3. Num treino comum, exercícios de peito e ombro aparecem com "Amplitude curta" quando permitido. Desenvolvimento com halteres e face pull ficam de fora.
4. No fim do treino, "Dê nota à dor". Na manhã seguinte chega o aviso das 8h30.
5. Teste o alerta vermelho: marque "Começou depois de uma queda" e veja a mensagem sem plano.

### Perguntas em aberto

1. **Manguito rotador:** o banco de músculos não tem "manguito rotador". Usei deltoides, deltoide posterior e parte alta das costas. Quer que eu acrescente o músculo "manguito rotador" ao banco (migração e texto em 3 idiomas), para o revisor mapear direito?
2. **"Pior na manhã seguinte":** considerei vermelho quando a nota da manhã fica 2 ou mais pontos acima da anterior. Com 1 ponto, qualquer oscilação faria o plano recuar. O revisor pode ajustar esse valor.
3. **Revisor:** o catálogo, as etiquetas dos 82 exercícios e os 5 testes Repair, as regras (dor 5 e dor 7) e as 3 fases estão na planilha, na aba "Movements".

### Ajustes depois da Fase 9 (suas respostas)

- **Manguito rotador:** entrou no banco de músculos (`rotatorCuff`, sem ponto no mapa do corpo), com texto nos 3 idiomas. Aplicado no Supabase. Agora é o foco do ombro nas fases 1 e 2 e o músculo principal das contrações de rotação e da rotação externa com elástico.
- **Manhã seguinte:** vermelho quando a nota sobe 2 pontos ou mais em relação à anterior **ou** quando a nota da manhã passa de 5. Há teste para os dois casos.
- **Planilha do revisor:** gerada de novo com o manguito rotador.

## Fase 10 — QA rodada 1 (20 personas)

O relatório de QA está em `docs/qa-round-1.md`. Corrigi na ordem pedida: seção 0 (seus pedidos), P0, P1 e P2. Cada grupo tem seu commit:

| Grupo                                                       | Commit    |
| ----------------------------------------------------------- | --------- |
| Relatório de QA                                             | `f34d9fc` |
| P0 — segurança e crianças                                   | `6524be8` |
| O-1 e O-2 — mapa de recuperação e demo em tudo              | `e153699` |
| P1 — lógica e UX                                            | `4a4a569` |
| O-3 — biblioteca maior                                      | `782ac5e` |
| Decisão extra — menores só veem corpos infantil/adolescente | `1b8516e` |
| P2 — acabamento                                             | `c042cd6` |

### Feito

**Seção 0 (seus pedidos)**

- **O-1:** Home, Fim de treino e Compartilhar usam os mesmos pontinhos do mapa do corpo, pintados com a cor da recuperação. Há alternância frente/costas (o cartão de compartilhar mostra as duas).
- **O-2:** aquecimento e desaquecimento têm miniatura na lista e demo no player, como os exercícios principais.
- **O-3:** a biblioteca passou de 82 para **536 exercícios**, todos `draft`, com movimentos articulares, contraindicações, nomes e dicas em 3 idiomas. A planilha do revisor foi gerada de novo. Um teste de cobertura falha se faltar:
  - 5 opções por músculo em cada nível de equipamento;
  - 5 opções para quem treina sentado ou com apoio;
  - 10 aquecimentos por região;
  - 3 alongamentos por grupo;
  - 10 de equilíbrio;
  - aquecimentos em forma de jogo para crianças;
  - 3 isometrias por movimento articular;
  - manguito rotador.

**P0 — segurança (cada um com teste)**

- **B-01:** perfil de criança não muda de idade. A data de nascimento fica travada e só um responsável altera, passando pelo "portão dos pais". O banco também barra, com o trigger `guard_child_age` (aplicado no Supabase).
- **B-02:** "finalizador cardio" no lugar de "queima-gordura", nos 3 idiomas. Um teste confere que nenhum texto visto por menores fala em gordura.
- **C-01:** depois de uma dor aguda, a tela final é calma, sem "Adicionar 10 min", e a área fica de fora de qualquer treino novo naquele dia.
- **C-02:** um sinal de alerta tira todo exercício que movimenta a articulação, não só os contraindicados. A restrição aparece como "Médico primeiro" e pede confirmação antes de "Marcar como curado".
- **A-01 / C-04:** treinos salvos são conferidos de novo quando muda uma restrição, um relato de dor ou um dado de saúde. O treino planejado é refeito. No treino em andamento, o que falta é trocado ou pulado.
- **C-03:** 60+ sentado em casa sem equipamento recebe treino. Quando não há treino possível, a tela diz o motivo real e oferece "Mudar meu plano".

**P1**

- **60+:**
  - vai para a home 60+;
  - equilíbrio vira sustentação de 20–40 s, e há sempre equilíbrio para 60+ e para quem caiu;
  - dica de "segure numa cadeira" para quem treina com apoio;
  - quem tem pressão alta ou problema cardíaco recebe carga moderada, sem séries pesadas nem de aproximação, e a dica "respire, não force".
- **Família:**
  - telas de dono (planos, cobrança, excluir conta, adicionar membro, consentimento, conta) exigem o portão dos pais;
  - a tela de consentimento confere tudo de novo e não troca de perfil se falhar;
  - "Meu filho" com menos de 13 anos agora tem um caminho claro;
  - o seletor na web não esconde mais opções.
- **Movimento que dói:**
  - a fase 1 tem só sustentações (~15 min);
  - o check da manhã ganhou botão no app e compara com a nota anterior;
  - a troca por dor fraca é sempre segura;
  - o peso do corpo nunca aparece como "carga pesada".
- **Gerador e home:**
  - o card "Hoje" bate com o treino gerado;
  - o limite de "2 dias seguidos" conta o músculo inteiro (peito, não só a parte de cima);
  - os músculos escolhidos entram em rodízio;
  - "séries de cada" é respeitado;
  - o finalizador cardio prometido aparece;
  - a troca de aquecimento e desaquecimento fica na mesma região.
- **Outros:**
  - "Molestia sorda / incomodidad" em espanhol;
  - a aba Família não dá mais erro;
  - os pontos do mapa têm 44 px.

**P2 (acabamento)**

- **Textos:**
  - plurais corrigidos;
  - "Bom dia", "hoje" e "ontem" certos;
  - "opções com apoio" para quem usa apoio;
  - mensagem neutra quando não há troca;
  - erro de rede na conversa não culpa mais a pessoa;
  - "primeiro treino" aparece só uma vez;
  - "Nenhuma", "Adulta" e "avó".
- **Tempos:**
  - lista e player mostram o mesmo tempo;
  - o total do aquecimento é a soma dos itens;
  - aviso de "libera na metade";
  - série de aproximação antes do primeiro exercício com carga;
  - a troca no player limpa a carga antiga;
  - troca e "Sinto dor" também nos passos com tempo.
- **Recuperação e sequência:**
  - faixas da legenda corrigidas;
  - músculo nunca treinado aparece separado;
  - proteções de sequência aparecem na home;
  - o dia de descanso usado numa quebra não pode ser usado de novo na mesma semana.
- **Recursos:**
  - "Só 15 min" mantém as trocas e tem "Voltar ao treino completo";
  - a nota "Adicionei empurrar/pernas" só aparece se o exercício continuou no treino;
  - o desaquecimento alonga os músculos treinados;
  - o check-in compara com os últimos valores reais e não perde o peso;
  - "Compartilhar minhas 4 semanas" mostra as 4 semanas;
  - o cartão lista os músculos mais treinados.
- **Planos:**
  - Premium já vem marcado;
  - assinante pode trocar de plano;
  - depois da compra o app volta ao treino;
  - o paywall mostra a data em que o teste grátis termina.
- **Conta:**
  - tela nova de **Configurações**, com Excluir conta, acessível pela Família e pelo Progresso;
  - o link de convite mostra uma confirmação.
- **Web:**
  - compartilhar cai para texto quando não dá para enviar imagem;
  - fotos mostram um aviso de que só funcionam no app do celular.
- **Acessibilidade:**
  - legendas do mapa não se sobrepõem;
  - arrastar com zoom na web;
  - pontos repetidos fora da navegação por teclado;
  - "Editar" e o "x" dos chips com 44 px, e "Editar" como botão;
  - rótulos das abas cabem;
  - cada opção de movimento tem nome próprio para leitor de tela.
- **Conteúdo:**
  - crianças não veem "Ficar mais bonito / Crescer / Definir" e veem "Menino / Menina";
  - gravidez não aparece para 60+;
  - o resumo do perfil mostra saúde e posição;
  - o aviso de gordura só aparece para "perder peso" ou "definir".

**Decisão extra:** perfis de criança e adolescente (inclusive o responsável que gerencia um) só veem os corpos infantil e adolescente. Um corpo adulto escolhido antes volta para a faixa do próprio perfil. Está na SPEC §5.

### Verificações

- `npm run check`: lint, typecheck, funções e **484 testes** passando.
- Testes novos por grupo:
  - `qa1-safety.test.tsx` (P0);
  - `qa1-owner.test.tsx` (O-1 e O-2);
  - `qa1-p1.test.tsx` (P1);
  - `coverage.test.ts` (O-3);
  - `qa1-p2.test.tsx` (P2 e a decisão sobre corpos para menores).
- `npm run db:test` (com `guard_child_age` e o valor 'doctor') e `npm run bundle:check`: limpos.

### Como testar (build de desenvolvimento)

1. **Criança:** crie um perfil de criança e tente mudar a data de nascimento. Aparece o portão dos pais. No mapa, o seletor de idade mostra só "9–12" e "13–17". Em Objetivos não há "Crescer" nem "Definir".
2. **Dor aguda:** no treino, "Sinto dor" → aguda → parar. A tela final fica calma e o próximo treino do dia não usa a área.
3. **Sinal de alerta:** em "Movimento que dói", marque um sinal de alerta no ombro. A restrição "Médico primeiro" aparece e nenhum exercício de ombro entra nos treinos.
4. **60+ sentado em casa:** o treino é gerado, com equilíbrio.
5. **Só 15 min:** use "Só 15 min" e depois "Voltar ao treino completo". As trocas continuam.
6. **Compartilhar 4 semanas:** no check-in, "Compartilhar minhas 4 semanas" mostra "Minhas 4 semanas".
7. **Planos:** Planos abre com Premium marcado. Pelo paywall, a compra simulada volta para o treino.
8. **Configurações:** Família ou Progresso → Configurações → Excluir conta.

### Perguntas em aberto

1. **Plano grátis e marco de 7 dias:** com 3 treinos por semana, quem está no grátis nunca chega a 7 dias seguidos. Sessões de mobilidade grátis (sem limite) devem contar como dia ativo? Minha sugestão é sim, com uma sessão curta de mobilidade liberada nos outros dias.
2. **Repair, fases 2 e 3:** a fase 1 tem 3 ou mais isometrias por movimento articular. A fase 2 tem pelo menos 2 exercícios de amplitude curta por articulação, não 3 por movimento. A fase 3 usa a biblioteca geral com carga progressiva. Quer que eu complete 3 por movimento nas fases 2 e 3 antes da revisão?
3. **Revisor:** os 536 exercícios são `draft` e dependem da revisão (planilha gerada de novo). Também dependem dele as regras de pressão alta/cardíaco (carga moderada) e as sustentações de equilíbrio.
4. **Pagamentos:** as mudanças em Planos e no paywall são só de tela e navegação (Premium marcado, troca de plano, voltar ao treino, data do teste), feitas porque estavam no relatório. Nada mudou em preços, produtos ou RevenueCat.

## Fase 11 — QA rodada 2 (20 personas)

O relatório da rodada 2 está em `docs/qa-round-2.md`. Segui a ordem pedida (seção 0, P0, P1, P2) e incluí as suas duas decisões aprovadas. Cada grupo tem seu commit:

| Grupo                                                                   | Commit    |
| ----------------------------------------------------------------------- | --------- |
| Relatório da QA rodada 2                                                | `37e3662` |
| Seção 0 — mapa de recuperação = mapa do corpo                           | `5266740` |
| P0 — adolescentes na família, remover membro, dor aguda por articulação | `55cddab` |
| P1 — paywall só para o dono, consentimento só de adulto, PIN dos pais   | `c5789f8` |
| P1 — gerador (recuperação, equilíbrio, carga leve, semana equilibrada)  | `b79e3a2` |
| Decisão 1 — mobilidade curta conta para a sequência                     | `280098d` |
| Biblioteca — cobertura sentado/com apoio, fases 2 e 3 do reparo         | `0c66bfb` |
| P2 — acabamento                                                         | `86b8aba` |

### Feito

**Seção 0: as bolinhas**

- O mapa de recuperação (Home, Fim de treino e Compartilhar) agora é o próprio mapa do corpo, com a mesma imagem, as mesmas posições e a mesma bolinha.
- O tamanho da bolinha é proporcional ao corpo (cerca de 18 px no mapa grande), nunca um tamanho fixo.
- Músculo treinado: bolinha colorida com um halo suave, como a bolinha selecionada no `/body`. Músculo recuperado: bolinha branca pequena.
- O corpo ocupa a largura inteira do cartão, com a legenda embaixo e uma linha nova para as bolinhas brancas ("recuperado / pronto").
- A legenda fala do estado ("recuperando", "quase pronto"), não de um tempo falso.
- Um teste compara o mapa de recuperação com o `/body` na mesma largura: tamanho e posição de cada bolinha iguais.

**P0 (com testes)**

- **R2-01:**
  - dá para adicionar adolescentes (13–17) na família;
  - um perfil de criança com consentimento continua travado abaixo de 13, e um de adolescente fica entre 13 e 17;
  - "Remover membro" pede o PIN dos pais e uma confirmação, libera a vaga e apaga os dados do membro no celular e na nuvem.
- **R2-02:** depois de parar por dor aguda, nada que mova aquela articulação entra no mesmo dia (joelho: sem extensora; lombar: sem elevação de quadril). Com dor fraca no dia, saem os movimentos pela articulação, mas ficam as sustentações sem dor, para a troca segura continuar existindo.

**P1: segurança e família (com testes)**

- **R2-03:** o paywall pede o PIN dos pais num perfil de criança. Quem assina não vê mais "Plano grátis · 3 treinos".
- **R2-04:** só um dono adulto (18+) adiciona membros e dá consentimento dos pais. A regra vale no app e no banco (`is_adult_owner`, aplicado no Supabase).
- **R2-05:** a pergunta de multiplicação virou um **PIN dos pais** de 4 dígitos:
  - o dono cria o PIN ao adicionar uma criança ou adolescente e pode mudá-lo em Configurações;
  - 5 erros bloqueiam por 15 minutos;
  - só o hash fica guardado;
  - um perfil de criança nunca consegue criar o PIN.
- **R2-12:** a aba Família não mexe mais no estado durante a renderização.

**P1: gerador (com testes)**

- **R2-06:** o exercício de equilíbrio não é mais cortado quando o treino encurta (Rosa mantém o equilíbrio em 30, 20 e 15 min).
- **R2-07:** articulação restrita ou dolorida recebe carga leve (12–15, sem série de aproximação). Na fase 1 do plano de recuperação, o movimento dolorido fica de fora (Laura não recebe elevação lateral).
- **R2-08:** o músculo só volta a ser treinado depois de recuperado: 48 h, ou 96 h aos 60+. Quando tudo ainda está se recuperando, o app oferece mobilidade curta ou dia de descanso.
- **R2-09:** um exercício por músculo principal em cada treino (as partes do peito se revezam). As vagas livres vão para o grupo menos treinado na semana; na simulação, uma semana de peito ficou em 4 empurrar : 4 puxar : 4 pernas.
- **R2-10:** um músculo escolhido sem opção segura aparece numa nota, nunca some calado.
- **R2-11:** os aquecimentos-brincadeira são só para crianças e vêm primeiro para elas. Adultos e idosos não recebem mais "marcha do pinguim".

**Decisão 1 (mobilidade curta)**

- Sessão de 10 min (aquecimento, 3 movimentos de mobilidade, desaquecimento), com botão na Home a qualquer hora.
- Conta como dia ativo e nunca entra nos 3 treinos por semana do plano grátis.
- Um teste confirma que 3 treinos mais 4 dias de mobilidade chegam ao marco de 7 dias no grátis.
- É um tipo de sessão próprio (`mobility`) no banco, aplicado no Supabase.

**Decisão 2 e biblioteca**

- A biblioteca passou de 536 para **747 exercícios**, todos `draft`:
  - 82 exercícios principais sentados ou com apoio, a maioria sem equipamento;
  - 44 alongamentos sentados (inclusive para joelho e manguito rotador);
  - 4 aquecimentos de tronco, 3 respirações, 5 itens sentados de desaquecimento e finalizador, e 3 desaquecimentos para crianças;
  - 70 exercícios de reparo: cada um dos 41 movimentos articulares tem pelo menos 3 exercícios nas fases 2 e 3.
- Todos os exercícios principais agora têm contraindicações; 42 estavam vazios.
- Os nomes repetidos foram trocados.
- O teste de cobertura agora confere:
  - pelo menos 5 opções por músculo × equipamento × posição;
  - pelo menos 3 alongamentos por grupo × posição;
  - fases 2 e 3 por movimento;
  - contraindicações e nomes únicos;
  - trocas para quem treina sentado ou com apoio.
- A planilha do revisor foi gerada de novo.

**P2**

- **Minutos e sequência:**
  - o card da Home mostra os minutos do treino gerado;
  - aparecem proteções de sequência;
  - o dia de descanso não é mais reaproveitado depois de uma quebra.
- **Variedade e doses:**
  - os treinos variam semana a semana;
  - o mesmo exercício nunca se repete no treino;
  - a série de aproximação fica junto do primeiro exercício;
  - exercícios isolados, sem carga e de 60+ nunca recebem dose de força pesada.
- **Sessão de recuperação:** tem 4 sustentações, sem notas de "equilíbrio" e "encurtado".
- **Trocas:**
  - trocar um alongamento mantém o mesmo grupo muscular;
  - um desaquecimento não aparece mais como opção de aquecimento.
- **Compartilhar:** o cartão segue a ordem dos alvos do treino.
- **Fim de treino e player:**
  - o quadro de estatística agora tem unidade;
  - o player não repete o nome do músculo.
- **Check da manhã:** aparece na Home.
- **Dados:**
  - a gravidez sai quando a idade vai para 60+;
  - "Voltar às restrições" abre Restrições.
- **Textos:**
  - Menino/Menina no mapa para crianças e adolescentes;
  - sem "mude a idade quando quiser" em perfil de criança;
  - "Fortalecer" sem "(Reparar)";
  - aviso para adolescentes sem falar de gordura;
  - exercícios de reparo só a partir de adolescente;
  - plural de "dia seguido";
  - "Zona lumbar" em todo o espanhol.
- **Acessibilidade:**
  - rótulos das abas não cortam;
  - RadioCard sempre informa se está marcado;
  - imagem do mapa fora do foco;
  - nomes distintos para os dois "Nenhum" e para "Vista de costas".
- **Marco de sequência:** com poucos dias, o marco não diz mais "uma semana inteira".

### Verificações

- `npm run check`: lint, typecheck, funções e **539 testes** passando.
- Arquivos novos de teste:
  - `qa2-recovery.test.tsx`: seção 0;
  - `qa2-safety.test.tsx`: P0;
  - `qa2-family.test.tsx` e `qa2-generator.test.ts`: P1;
  - `qa2-mobility.test.tsx`: decisão 1;
  - `coverage.test.ts`: biblioteca e decisão 2;
  - `qa2-p2.test.tsx`: P2.
- `npm run db:test` (com dono menor de idade barrado) e `npm run bundle:check`: limpos.

### Como testar (build de desenvolvimento)

1. **Bolinhas:** faça um treino e veja a Home. O corpo ocupa o cartão inteiro, as bolinhas têm o mesmo tamanho do `/body`, o treinado fica colorido com halo e o resto fica branco. Troque entre Frente e Costas.
2. **Família:** Família → Adicionar → Meu filho, nascido em 2012. O app pede para criar o PIN dos pais e o adolescente termina o cadastro. Depois use "Remover membro" (PIN mais confirmação).
3. **Dor aguda:** no treino, "Sinto dor" → joelho → aguda → parar. O próximo treino do dia não tem nada de joelho.
4. **Criança no paywall:** num perfil de criança, abra Planos ou o paywall. Aparece o pedido de PIN; errando 5 vezes, bloqueia por 15 minutos.
5. **Recuperação:** faça um treino de pernas e toque em Começar de novo. Pernas não aparecem; se tudo estiver se recuperando, surge "Mobilidade curta · 10 min".
6. **Mobilidade no grátis:** depois de 3 treinos na semana, "Mobilidade curta" continua liberada e conta para a sequência.

### Perguntas em aberto

1. **PIN esquecido:** hoje não há como recuperar o PIN. Proponho recuperar por um código enviado para o e-mail da conta salva do dono. Posso fazer?
2. **Revisor:** 747 exercícios `draft`. Ele também precisa confirmar:
   - as horas de recuperação (48 h, 96 h aos 60+);
   - a carga leve em articulação restrita;
   - a regra da fase 1.
3. **Remover membro:** apagar um perfil de criança apaga também o registro de consentimento (em cascata no banco). O advogado precisa dizer se esse registro deve ser guardado.
4. **Consentimento na nuvem:** o banco confere a idade pelo perfil do dono na nuvem. Se o dono ainda não sincronizou o próprio perfil, criar a criança falha com uma mensagem genérica. Quer que eu sincronize o perfil do dono antes dessa etapa?
5. **Trocas:** todas têm pelo menos 3 opções seguras. 17 itens, quase todos sentados, ficam com 3–4 opções (a meta era 5). Dá para completar numa próxima leva.
6. **Planos e paywall:** mexi só em tela e permissão (PIN e texto para quem assina). Preços, produtos e RevenueCat não mudaram.

## Fase 12 — Menores de 13 fora do lançamento, PIN e família

Suas decisões, confirmadas nesta conversa: menores de 13 desligados no app e no banco, adolescentes de 13 a 17 mantidos, e as outras três decisões como combinado. Cada grupo tem seu commit:

| Grupo                                                 | Commit    |
| ----------------------------------------------------- | --------- |
| Menores de 13 desligados (app + banco)                | `b7bfdeb` |
| PIN dos pais esquecido → código por e-mail            | `13a9610` |
| Perfil do dono salvo antes de criar alguém da família | `66753b8` |

### Feito

**1. Menores de 13 fora do lançamento (desligado, nada apagado)**

- **Chave no app:** `KIDS_UNDER_13_ENABLED` (variável `EXPO_PUBLIC_KIDS_UNDER_13_ENABLED`), desligada por padrão.
- **Idade mínima 13:**
  - a lista de anos continua indo até idades baixas, sem revelar o corte;
  - quem tem menos de 13 e responde por si só vê "TapStrong is for ages 13 and up" depois de tocar em Continuar, nunca como aviso antecipado;
  - o bloqueio fica guardado no aparelho: trocar a data não desbloqueia.
- **O que muda na tela:**
  - "Meu filho" vira "Meu filho ou filha adolescente (13–17)";
  - não dá mais para adicionar criança menor de 13, e o consentimento dos pais fica fechado;
  - os modelos de corpo infantil somem;
  - na boas-vindas, "Kids 9+" virou "Teens 13+".
- **Chave no banco:** tabela `app_settings` com `kids_under_13_enabled = false`, sem acesso de nenhum cliente. A `create_child_profile` recusa enquanto estiver desligada, mesmo com dono adulto, plano Família cobrado e aviso aceito. Já aplicado no Supabase.
- **Adolescentes (13–17):** continuam com tudo, inclusive o plano Família, o PIN dos pais e as regras de adolescente.
- **SPEC e textos da loja** (`docs/store/listing.md`, `privacy-labels.md`): público 13+, sem "Kids 9–12".
- **Testes:** com a chave desligada (comportamento do lançamento) e ligada (o fluxo guardado continua funcionando). O banco testa as duas situações.
- **Religar na versão 2:** `EXPO_PUBLIC_KIDS_UNDER_13_ENABLED=true` e `update public.app_settings set value = 'true' where key = 'kids_under_13_enabled';`, depois da revisão do advogado.

**2. PIN esquecido**

- No portão dos pais há "Esqueceu o PIN?". O app envia um código de acesso para o e-mail do titular da conta (mostrado parcialmente, "d•••@…"), confere o código e deixa criar um PIN novo, o que também desfaz o bloqueio de 15 minutos.
- Uma criança não passa sem acesso ao e-mail do dono.
- Sem conta salva não há como redefinir. Como o plano Família exige conta salva, na prática sempre existe um e-mail.
- **Atenção:** o código sai pelo Supabase Auth. Usuários reais só recebem depois do SMTP do Resend; até lá, só o e-mail da equipe do projeto recebe.

**3. Remover membro**

Nada mudou. Com a chave desligada não existe registro de consentimento de menor de 13. A nota para o advogado está em `docs/launch-readiness.md`.

**4. Dono salvo antes de criar alguém da família**

- Ao adicionar alguém (e no fluxo de consentimento guardado), o app primeiro grava na nuvem o perfil do próprio dono, porque o banco confere a idade por ele.
- Sem internet, sem conta salva ou com o perfil do dono incompleto, a tela diz exatamente isso e não cria nada.

### Verificações

- `npm run check`: lint, typecheck, funções e **555 testes** passando.
- Testes novos:
  - `qa3-kids-off.test.tsx`: chave desligada e ligada;
  - `qa3-pin-reset.test.tsx`;
  - `qa3-owner-sync.test.tsx`.
- `npm run db:test` (chave desligada recusa, e nenhum cliente consegue ligar a chave) e `npm run bundle:check`: limpos.

### Como testar (build de desenvolvimento)

1. **Idade:** comece do zero e escolha "Eu", nascido em 2016, e toque em Continuar. Aparece "TapStrong is for ages 13 and up". Volte e escolha 1990: continua bloqueado.
2. **Adolescente:** Família → Adicionar → "Meu filho ou filha adolescente (13–17)", nascido em 2012. O perfil é criado. Com nascimento em 2016, aparece "ainda não disponível".
3. **Boas-vindas:** o quarto quadro mostra "Teens 13+".
4. **PIN esquecido:** num perfil de adolescente, abra Planos → "Esqueceu o PIN?". O código vai para o e-mail da conta, que precisa estar salva.

### Perguntas em aberto

1. **SMTP do Resend:** sem ele, o código do PIN (e o de salvar a conta) só chega aos e-mails da equipe do projeto no Supabase. Quando a chave chegar, ela vai direto no painel do Supabase, como combinado.
2. **Advogado:** fica para a versão 2, junto com religar os menores de 13 (fluxo COPPA, aviso aos pais e o que fazer com o registro de consentimento quando um perfil de criança for removido).

---

## Fase 13 — QA rodada 3 (P1 e P2)

O relatório completo está em `docs/qa-round-3.md`. Todos os P1 e P2 foram corrigidos, em commits separados por grupo:

| Grupo                                                                    | Commit    |
| ------------------------------------------------------------------------ | --------- |
| Texto da QA 3                                                            | `95083a7` |
| P1 · trava de idade e erros sem internet (R3-01, R3-02)                  | `993507a` |
| P1 · segurança das trocas e cargas com as duas mãos (R3-07, R3-09)       | `1131502` |
| P1 · recuperação por músculo, mobilidade curta, equilíbrio (R3-04/05/08) | `d92128e` |
| P1 · Home "tudo se recuperando" e mobilidade para 60+ (R3-03, R3-06)     | `5fab956` |
| P2 · família, pagamento e PIN dos pais                                   | `e834c7b` |
| P2 · gerador, trocas e etiquetas da biblioteca                           | `6ba775b` |
| P2 · textos, acessibilidade, traduções e legenda do Share                | `ca07f3e` |

### Feito — P1

- **R3-01 Trava de idade.**
  - Vale só no cadastro "Eu", antes de existir conta.
  - Nunca bloqueia perfis da família nem a edição da data. Um adulto que digita 2016 por engano vê só a mensagem "13 anos ou mais" e pode corrigir.
  - Guarda a data digitada e se desfaz sozinha quando essa data completa 13 anos.
  - A tela de bloqueio tem "Falar com o suporte" (e-mail).
  - Mês de aniversário: quem faz aniversário no mês atual já conta a idade nova (o dia decide quando é conhecido). O banco já calculava assim.
- **R3-02 Sem internet.** Erros de rede do Supabase (que vêm como objeto, sem exceção) agora mostram "Você está offline" na sincronização do dono e no PIN esquecido, não mais "Salve sua conta" ou "Algo deu errado".
- **R3-03 Home.** Quando tudo está se recuperando, a Home (e a Home 60+) mostra "Tudo está se recuperando" com mobilidade curta, equilíbrio curto (novo: 3 exercícios, cerca de 10 min) ou descanso, em vez de um "Começar" que não gerava treino.
- **R3-04 Recuperação.**
  - Um músculo volta a ser treinado 44 h depois do _início_ da sessão (90 h para 60+).
  - Checagem por músculo, não pelo grupo inteiro.
  - Teste: quem treina 4 dias por semana (seg, ter, qui, sáb) recebe 4 treinos.
- **R3-05 Mobilidade curta.**
  - Aquecimento + 3 movimentos + desaquecimento, cerca de 10 min.
  - Foco alternando por dia: quadril, parte alta das costas, ombros, tornozelos.
  - O Done diz "Mobilidade feita!". O Progresso não conta como treino.
  - Alongamento, mobilidade, equilíbrio e respiração nunca deixam músculo vermelho no mapa.
- **R3-06 60+.** Botão de mobilidade curta; os minutos do cartão vêm da sessão, não do perfil.
- **R3-07 Trocas seguras.**
  - A troca usa a mesma dosagem da geração (articulação com restrição = leve, 12–15).
  - A rampa de aquecimento só acompanha o exercício novo se a geração permitiria.
  - Na fase 1 da recuperação, ficam fora os exercícios contraindicados para a área (Laura não recebe mais "Airplane arm hold").
  - O treino de recuperação troca com as regras de recuperação.
- **R3-08 Item de equilíbrio.** Aparece como "Equilíbrio", não entra no título do cartão nem no mapa, e a troca oferece só equilíbrio (3 rascunhos novos de equilíbrio sentado).
- **R3-09 Com apoio.** 40 exercícios com carga nas duas mãos perderam a posição "com apoio" (afundo com halteres, levantamento terra unilateral, roscas em pé, woodchop etc.). Um teste de auditoria impede novos casos.

### Feito — P2

- **Plano Família só para adultos (aprovado por você):**
  - dono com menos de 18 vê "O plano Família é para adultos a partir de 18 anos" e não tem botão de compra;
  - o próprio `buy()` recusa os produtos Família;
  - o Premium continua disponível.
- **Menores de 13 desligados:** Planos falam só de adolescentes; a mensagem da trava de adolescente não cita crianças; o link direto para o consentimento mostra "Ainda não disponível".
- **Remover membro:** se a exclusão na nuvem falhar, fica na fila, tenta de novo na sincronização e ao abrir Família, e o dono é avisado.
- **Adolescentes** não informam altura nem peso.
- **PIN dos pais:**
  - PBKDF2-SHA256 com 100.000 rodadas;
  - guardado no Keychain/Keystore (`expo-secure-store`);
  - o PIN antigo funciona uma vez e é convertido;
  - o bloqueio de 5 tentativas também é contado no servidor (`parent_pin_lockouts`, já aplicado no Supabase, com teste de banco).
- **Gerador:**
  - nova marca `isolation` (39 crucifixos, face pulls, pullovers): 10–15, nunca pesado, nunca com rampa;
  - o preenchimento respeita "descansa hoje", alterna entre as 3 melhores opções por data, mantém empurrar/puxar equilibrados e completa sessões curtas até perto do tempo pedido (máx. 8 exercícios);
  - usuário de academia com meta "Ficar mais forte" nunca recebe exercício só com peso do corpo;
  - sessão encurtada diz quais músculos ficaram para a próxima.
- **Trocas ≥ 3:** quando o músculo tem menos de 3 opções, a troca olha o grupo e depois os secundários. O `coverage.test.ts` agora roda 24 perfis (4 níveis × 3 posições × adulto/60+), incluindo a meta Mobilidade. 2 aquecimentos sentados novos.
- **Etiquetas:**
  - exercícios ajoelhados ficam fora com restrição no joelho;
  - máquinas assistidas marcadas como ajoelhadas;
  - caminhadas com joelho/tornozelo;
  - respiração quadrada e ponte com travesseiro ficam fora para coração/pressão alta (a dica da ponte não pede mais para prender a respiração).
- **Textos e acessibilidade:**
  - legenda "branco (recuperado) após ~3 dias", cinza-azulado = 5+ dias;
  - a legenda da Home começa pelos alvos do dia e concorda no plural;
  - desempate do Done pela ordem da sessão; nada de "PEITO · TAMBÉM PEITO SUPERIOR";
  - `aria-checked` nos seletores; altura explícita nos rótulos das abas;
  - PT "Mantenha sua sequência de N dias"; ES "Empezar" e "darles";
  - legenda do Share com pontos brancos e cinza.

### Verificações

- Lint, typecheck e **654 testes** passando; `npm run db:test` e `npm run bundle:check` limpos.
- **Testes de segurança novos:**
  - `r3-age-lock`;
  - `r3-offline`;
  - `r3-safety` (trocas, fase 1, auditoria "com apoio");
  - `r3-generator`;
  - `r3-home`;
  - `r3-pin` (PBKDF2, SecureStore, bloqueio no servidor);
  - `r3-family` (Família 18+, consentimento, fila de exclusão);
  - `r3-p2-generator`;
  - banco: `parent_pin.sql`.
- **Migrações aplicadas no Supabase:** `parent_pin_lockout` e `exercise_isolation`.

### Como testar (build de desenvolvimento)

1. **Trava de idade:** "Eu", nascido em 2016 → bloqueio com "Falar com o suporte". Adicione um avô em Família: entra normalmente.
2. **Tudo se recuperando:** treine tudo e abra a Home no dia seguinte → "Tudo está se recuperando" com mobilidade, equilíbrio e descanso.
3. **Mobilidade curta:** 3 movimentos e ~10 min; o Done diz "Mobilidade feita!"; em dias diferentes o primeiro movimento muda.
4. **Rosa (60+, caiu, com apoio, halteres):** nenhum exercício com halteres nas duas mãos.
5. **Família com dono de 17 anos:** Planos → Família mostra "só para adultos", sem botão de compra.
6. **PIN:** erre 5 vezes → bloqueio de 15 min, que continua mesmo apagando os dados do app, se estiver online.

### Perguntas em aberto

1. **PIN no aparelho:** o PBKDF2 com 100.000 rodadas roda em JavaScript puro (Hermes não tem JIT). Levou ~0,3 s no teste; num Android simples pode levar alguns segundos. Se ficar lento no aparelho, a saída é `react-native-quick-crypto` (gratuito, nativo), mas é dependência nativa nova, então preciso do seu OK. Adicionei `expo-secure-store` e `@noble/hashes` (gratuitos) porque a QA pediu explicitamente SecureStore e KDF lento.
2. **E-mail de suporte:** usei `support@tapstrong.app` como padrão (configurável em `EXPO_PUBLIC_SUPPORT_EMAIL`). Qual e-mail real devo usar?
3. **`kind` do perfil editável:** o PIN e o bloqueio estão no Keychain; a lista de perfis continua no armazenamento normal. Proteger também o tipo de perfil é um passo maior, que posso fazer numa próxima fase.
4. **Preenchimento até o tempo:** quando a sessão fica abaixo de 75% dos minutos pedidos, o gerador passa do número de exercícios escolhido (até 8). Se preferir respeitar sempre o número escolhido, é uma linha.

### Fase 14

Recebi o texto das melhorias v1 (pacotes A–D). Como você pediu, só começo depois de aprovar a Fase 13.

## Fase 14 — Melhorias v1 (pacotes A–D)

Base: `docs/improvements-v1.md`; mapa de telas × mockups em `docs/phase14-screens.md`. Um commit por pacote: `803fdeb` (A), `7931fb3` (B), `7f490ed` (C), `2ff161d` (D). Antes disso, as sugestões aprovadas da Fase 13: e-mail de suporte `danielrodovalho228@gmail.com` e o gerador respeitando o número de exercícios escolhido, com a oferta "adicionar 1 exercício?" quando sobra tempo.

### Feito

**A — Semana, programa e cargas**
- Faixa da semana na Home, na Home 60+ e na lista de treinos (hoje contornado, ponto cheio = treinou, vazado = planejado); tocar num dia abre o registro ou a prévia.
- Blocos de programa de 4 a 6 semanas, com a última semana de deload (40% menos séries). Cada treino tem nome do dia (Push, Pull, Pernas, Superior…) e o resumo "N exercícios · N min", com kcal só para adultos e 60+.
- Carga sugerida e progressão determinística:
  - +5/+10 lb (2,5/5 kg) quando as **2 últimas sessões** ficaram no topo da faixa com esforço ≤ 8 (corrigido na Fase 15: o código sempre exigiu 2 sessões);
  - +1 repetição no peso corporal;
  - 60+ e articulação em cuidado: repetição antes de carga;
  - mantém após 2 falhas e reduz após 3;
  - chips de esforço 6/8/10.
- Planos prontos por dias, objetivo e divisão (adolescentes sem planos de emagrecimento). O plano define alvos; o gerador continua escolhendo só exercícios seguros.
- Modos de treino: Meu plano, Treino avulso (mapa do corpo), Personalizado (aquecimento e desaquecimento sempre incluídos).
- Adolescente gerenciado só compartilha se o responsável ligar.

**B — Biblioteca**
- Nova aba Biblioteca com os mesmos pontos do BodyMapCanvas (frente/costas), busca e filtros. Só aparecem exercícios seguros; o resto fica em "Não é para você agora", com o motivo.
- Página do exercício:
  - orientação: demo, dicas, erros comuns, músculos;
  - desempenho: maior carga, 1RM, volume e nota;
  - adolescentes sem 1RM e volume; 60+ só a maior carga.
- Favoritos, preferidos pelo gerador e pela troca (que continua com no máximo 5 opções).
- Criar exercício (só adultos): nunca entra no plano automático, só no Personalizado, e passa pelas mesmas checagens de restrição e dor. Aparece como "Não revisado por treinador".

**C — Equipamentos**
- ~60 itens em grupos, com liga/desliga em Configurações → Equipamentos.
- Predefinições: Academia completa, Academia pequena, Casa, Só peso corporal, Hotel.
- Locais salvos (ex.: Academia e Casa), trocáveis no topo do treino; o treino é refeito para o local.
- Seed mapeado item a item; gerador, troca e biblioteca filtram pela lista exata.
- Teste de cobertura: cada predefinição mantém 5+ opções por músculo × posição.

**D — Atividade, conquistas, corpo, configurações**
- **Progresso → Atividade:**
  - período (7 dias a tudo), treinos, horas, volume e mobilidade;
  - calendário do mês;
  - gráfico da melhor carga por exercício com meta.
  - Adolescentes: sem volume. 60+: só treinos, horas e calendário.
- **Progresso → Corpo (só adultos):**
  - relação cintura-altura primeiro;
  - tendência do peso;
  - medidas de fita (cintura, peito, quadril, braço, coxa, panturrilha), guardadas no celular.
- **Conquistas novas:**
  - semanas seguidas (4/12/26/52);
  - volume em 3 níveis (lb ou kg);
  - fase do Repair concluída;
  - 30 dias de equilíbrio;
  - 100 treinos.
  - Adolescentes não veem as de volume. Migração `badges_v2` aplicada no Supabase.
- **Configurações:**
  - Preferências de treino: unidades, descanso padrão (60+ só 90/120 s), avisos por voz, aquecimento curto e nível de experiência.
    - O aquecimento curto encurta, nunca remove, o aquecimento e o desaquecimento.
    - "Começando a treinar" limita o nível dos exercícios.
  - Lembretes: horário, dias e "salvar a sequência".
  - Modelo do corpo, Ajuda (e-mail de suporte) e Compartilhar com amigos.
- **Dica na Home** no dia seguinte a um treino: "10 minutos de mobilidade mantêm sua sequência".
- **Proteção do tipo de perfil** (sugestão 3 da Fase 13):
  - o id do perfil dono fica no Keychain/Keystore;
  - um perfil editado para "self" cai no PIN dos pais;
  - preferências e medidas ficam separadas por perfil.

### Verificações

- Lint, typecheck e **731 testes** passando (64 suítes).
- `npm run db:test`, `functions:check` e `bundle:check` limpos.
- Testes novos: `program`, `a-screens`, `loads`, `library`, `equipment`, cobertura por predefinição e `d-package`. O `d-package` cobre atividade, conquistas com filtro de adolescente, corpo, descanso, aquecimento curto, experiência, lembretes, dica de sequência e proteção do perfil.

### Como testar (QA rodada 4)

1. **Home:** faixa da semana; toque em ontem (registro) e amanhã (prévia). Nome do dia e "N exercícios · N min".
2. **Treino:** registre carga e esforço 8 no topo da faixa em 2 treinos seguidos → no próximo a sugestão sobe 5 lb.
3. **Biblioteca:** toque num ponto, favorite um exercício, crie um exercício próprio (adulto) e use-o em Personalizado.
4. **Equipamentos:** escolha "Hotel", crie o local "Casa" e troque de local no topo do treino.
5. **Progresso:** Atividade (troque o período e o mês; defina uma meta de carga) e Corpo (adicione cintura → a relação aparece).
6. **Configurações → Preferências:** descanso de 90 s (o timer começa em 1:30), voz ligada, aquecimento curto.
7. **Adolescente e 60+:** confira que não aparecem volume, Corpo ou kcal para o adolescente, e que a tela 60+ fica simples.

### Perguntas em aberto

1. **Sincronização com Apple Saúde / Health Connect:** não construí. Precisa de biblioteca nativa nova e de um novo build, então aguardo seu OK.
2. **Som ao fim do timer:** a preferência existe, mas o som em si precisa de um arquivo de áudio e de `expo-audio`. Por enquanto só há avisos por voz. Posso adicionar?
3. **"Falta equipamento" na troca:** itens indisponíveis aparecem só em "Não é para você agora" na Biblioteca; na troca de exercício eles não aparecem desativados. Quer esse detalhe também na troca?
4. **Avaliar o app:** fica para depois do lançamento, quando as contas das lojas existirem.
5. **Velocidade do PIN:** continua como combinado; você testa no Expo Go e, se passar de 1 s, falamos da biblioteca nativa.

### Fase 14 — decisões finais (seguindo as recomendações)

Daniel: "Sobre as decisões seguir suas recomendações."

| Pergunta | Decisão | Situação |
|---|---|---|
| Apple Saúde / Health Connect | Deixar para depois do lançamento (biblioteca nativa, rótulos de privacidade e revisão das lojas) | Não feito |
| Som ao fim do timer | Fazer | **Feito** |
| Equipamento que falta, na troca | Fazer como texto, sem virar opção extra | **Feito** |
| Avaliar o app | Depois das contas das lojas | Não feito |
| Velocidade do PIN | Você testa no Expo Go; nativo só se passar de 1 s | Aguardando o teste |

**Feito:**
- **Som:** um toque curto, gerado por nós (sem licença de terceiros), quando o descanso ou uma contagem do aquecimento/desaquecimento chega a zero.
  - Liga/desliga em Preferências de treino → Sons (ligado por padrão).
  - Respeita o modo silencioso e não pausa a música da pessoa.
  - Pacotes gratuitos da Expo: `expo-audio` e `expo-asset`.
  - Configurei o `expo-audio` sem microfone e sem áudio em segundo plano, então não há permissão nova para o usuário nem mudança nos rótulos de privacidade. `RECORD_AUDIO` continua removido; `MODIFY_AUDIO_SETTINGS` é uma permissão comum do Android, sem pedido na tela.
  - O Expo Go já inclui o `expo-audio`; o build de desenvolvimento precisa ser refeito para ter o som.
- **Troca:** abaixo das opções aparece "Também parecidos, mas precisam de equipamento que você não tem: …" (até 3 nomes), com o link "Editar meus equipamentos".
  - São só texto: a troca continua oferecendo no máximo 5 substituições.
  - Todas as regras de segurança valem para esses nomes, exceto a de equipamento.

**Verificações:** lint e typecheck limpos, **734 testes** passando, `bundle:check` limpo. O `expo-doctor` volta ao estado anterior (as 2 falhas que já existiam: esquema do app.json e consulta de rede bloqueada).

## Fase 15 — QA rodada 4 (P1 de segurança, P1 de função, P2)

Texto da QA salvo em `docs/qa-round-4.md` (`d766a9b`). Três commits, um por grupo, na ordem pedida: segurança (`843093c`), função (`bce09a1`) e P2 (último commit desta fase).

### P1 — segurança

- **R4-01 Lombar:** bird dog (com e sem apoio), prancha, prancha lateral, prancha inclinada e "Goblet carry hold" ganharam a etiqueta de lombar. Depois de uma parada por dor aguda na lombar, eles saem do treino avulso e de todos os outros.
- **R4-02 Joelho:** 78 exercícios de perna, de locomoção em pé, unilaterais ou de carregar peso ganharam a etiqueta de joelho: os 8 citados (levantamento terra unilateral, equilíbrio num pé, panturrilha unilateral, andar nos calcanhares, farmer walk, andar pé ante pé, marchas e polichinelo sem impacto) e os parecidos.
  - O teste de auditoria novo exige a etiqueta de joelho em todo exercício de perna feito em pé ou carregando peso e a de lombar em toda prancha e todo exercício com lombar como músculo principal. Quem é feito sentado ou deitado e não carrega as pernas (alongamentos, abdução deitada) precisa de pelo menos uma etiqueta de joelho, tornozelo ou quadril.
  - `seed.sql` e a planilha de revisão foram regenerados.
- **R4-03 Exercício próprio:**
  - as articulações vêm sempre dos músculos principais (por exemplo, quadríceps inclui o joelho), além das que a pessoa marcar, e pelo menos 1 músculo principal é obrigatório;
  - a posição padrão é "em pé"; "com apoio" fica bloqueado quando há peso livre nas mãos;
  - o agachamento com halteres da Rosa e o exercício de quadríceps do Dave agora são barrados.
- **R4-04 Planos por link:** a idade é checada na página do plano, no gerador e na Home. Um adolescente que abre `/program/weightLoss-fullBody-3` vê "não disponível", sem botão; um plano inválido já ativo é apagado.
- **R4-05 Tipo de perfil:** o armazenamento seguro (Keychain/Keystore) agora também guarda o perfil ativo, espelhado a cada troca, e quais perfis são menores, gravado na criação. Resultado:
  - `kind` editado para "self" continua com a data de nascimento travada;
  - `activeId` editado à mão (para o dono ou para um id desconhecido) e perfil apagado da lista caem no PIN;
  - voltar para o dono pelo app continua normal;
  - um PIN colocado no armazenamento comum nunca é importado: a migração antiga foi removida, porque o app ainda não foi lançado.

### P1 — função

- **R4-06:** "Músculos trabalhados" mostra os principais como pontos cheios e os secundários como halo; "chest" acende os três pontos do peito.
- **R4-07:** Criar exercício usa a lista detalhada de equipamentos, agrupada. Os exercícios próprios já salvos migram das chaves antigas (kettlebell → kettlebells, cabos → estação de cabos etc.).
- **R4-08 Planos divididos:**
  - o dia Push fica só push (o preenchimento respeita os grupos do dia);
  - a prévia de dias futuros avança pelo plano;
  - escolher um plano refaz o treino de hoje;
  - a faixa da semana usa os dias do plano;
  - Planos ganhou filtros de equipamento ("sem pesos") e de músculos.
- **R4-09:** equipamento e local entram na chave de revisão. Mudar em Configurações descarta o treino planejado ainda não começado, e o local salvo deixa de aparecer ativo quando a lista não bate mais.
- **R4-10:** no dia de "+1 repetição" a carga anterior é mantida (60+ e articulação em cuidado). No peso corporal o texto não fala mais em "mesmo peso".

### P2

- **Listas:** Biblioteca com "Ver todos" (antes parava em 60); "Não é para você" sem limite; busca com espera enquanto se digita; o campo de busca não some mais.
- **60+:** Progresso sem "Séries" nem o gráfico semanal; a aba Corpo agora é só para adultos de 18 a 59 (também no check-in; ajustei a SPEC); a Biblioteca ganhou a área "Ombros".
- **Unidades:**
  - uma regra de arredondamento só (40 lb = 17,5 kg no treino, na página do exercício e no gráfico);
  - a tela de descanso mostra "última vez" na unidade da pessoa;
  - a dica "+5 lb" usa o passo real (+10 lb / +5 kg para perna).
- **Descanso:** o rótulo mostra o descanso que o timer vai usar (ex.: 90 s escolhido em Configurações).
- **Dias:** lembretes, faixa da semana e prévias usam a mesma regra de dias e respeitam o primeiro dia da semana do celular.
- **Dica "Dia de descanso?":** só em dias sem treino planejado.
- **"Descanse hoje":** vale só para duas sessões seguidas dentro de 72 h; treinos personalizados não contam.
- **Treino avulso:**
  - treina só os músculos escolhidos (até 2 exercícios por músculo) e não aparece mais como "Corpo todo";
  - depois de uma parada por dor aparece uma nota só, com o motivo certo ("fora hoje por causa da dor");
  - dead bug com halter não recebe mais séries de aquecimento com carga.
- **Sessões curtas:** equilíbrio curto só com exercícios de equilíbrio (sem abdominal reverso); mobilidade e equilíbrio curtos não mostram mais "semana de deload".
- **Deload:** pelo menos 40% menos séries (3→1, 4→2, 5→3), nunca abaixo de 1.
- **Variedade:** exercícios das 2 últimas sessões dão lugar a outras opções boas (favoritos continuam). O preenchimento não usa mais puxada de ponta de pé nem pendurar na barra.
- **Documento:** a progressão exige 2 sessões no topo da faixa; corrigi o texto da Fase 14.
- **Exercício próprio:** "Não revisado por treinador" aparece na lista, no treino e no player.
- **Compartilhar:**
  - adolescente com compartilhamento desligado não vê "Compartilhar sequência" nem "Compartilhar com amigos";
  - "Compartilhar com amigos" envia o link de convite.
- **Conquistas:** aberta pelo Progresso, a tela não mostra mais o "NOVA CONQUISTA" antigo, e os números saem formatados.
- **Gráfico de exercícios:** mostra todos os exercícios, com rolagem lateral; a meta salva ao sair do campo, também no web.
- **Textos para adolescentes:**
  - a pergunta do modelo do corpo não fala mais em altura e peso;
  - "Sua data de nascimento" no próprio perfil;
  - o dono de 17 anos não vê "consentimento dos pais";
  - o texto do PIN agora descreve só o que ele de fato bloqueia, e duas coisas passaram a pedir PIN para adolescentes: tirar uma restrição e mudar o nível de treino;
  - "Inchworm lite" foi liberado para adolescentes.
- **i18n:**
  - números e decimais localizados (horas, relação cintura-altura, recordes);
  - "Outubro de 2026";
  - ES "Entrenamientos";
  - PT "Nenhum exercício escolhido ainda";
  - "Salva-sequência" com um nome só (o título da seção passou a ser "Motivação");
  - o chip "Firme" virou "Exigente" (ES) e "Puxado" (PT);
  - o texto de experiência bate com o código;
  - o "&" na Home virou "y" em espanhol e "e" em português.
- **Acessibilidade:**
  - rótulos das abas sem corte (fonte 11, sem espaço extra) e novo fluxo Maestro `07-tab-labels` com captura de tela;
  - `aria-pressed` nos chips e nos pontos do corpo;
  - interruptores com área de 44 px e `aria-checked`;
  - `aria-expanded` em "Não é para você";
  - os cards da Biblioteca não têm mais botão dentro de botão;
  - os pontos vizinhos (peito médio e inferior) não se sobrepõem mais.
- **Outros:**
  - o onboarding sem predefinição termina com a predefinição do local (casa → "Só peso corporal"; academia → completa);
  - as "rotações de ombro sentado" da Laura agora têm pelo menos 3 trocas seguras;
  - o teste `d-package` ganhou mais tempo para máquinas lentas.

### Verificações

- Lint, typecheck e **795 testes** passando (68 suítes); `db:test`, `functions:check` e `bundle:check` limpos.
- **Achado durante a verificação:** o commit de função travava a exportação dos bundles (renderização estática). A prévia de dia futuro recebia o texto literal `[date]` e entrava num laço sem fim. Corrigido no commit P2: a data é validada e o laço tem limite de 1 ano; há teste para isso. O commit `bce09a1` sozinho não exporta, então use o commit final.
- Testes novos:
  - `r4-safety`: auditoria de etiquetas, parada por dor na lombar e no joelho, exercício próprio, planos por idade, proteção do perfil;
  - `r4-function`;
  - `r4-p2`;
  - PIN antigo não importado.

### Como testar (build de desenvolvimento)

1. **Dave (joelho):** pare um treino com dor aguda no joelho → no mesmo dia, nenhum exercício com marcha, equilíbrio num pé ou panturrilha, nem o exercício próprio de quadríceps.
2. **Lombar:** pare com dor aguda na lombar → Treino avulso → Lombar não oferece bird dog nem prancha.
3. **Adolescente:** abra `/program/weightLoss-fullBody-3` → "não disponível". Edite o `kind` para "self" → a data de nascimento continua travada.
4. **Plano PPL:** escolha Ganhar músculo · PPL · 3 dias → hoje aparece como "Push"; sexta aparece como "Pernas".
5. **60+ com dor no joelho:** no dia de +1 repetição, a carga continua a mesma da última vez.
6. **Configurações → Equipamentos:** tire os halteres → o treino planejado é refeito sem halteres.

### Perguntas em aberto

1. **Aviso "component name 'o'" do React:** não reproduziu nos testes nem no build local. Se aparecer de novo, me mande a tela em que surgiu.
2. **"Puxar atrás do empurrar":** a variedade nova e a regra de equilíbrio devem aproximar os dois, mas não mexi no peso de cada grupo. Vale medir de novo na rodada 5.
3. **Teste de captura das abas:** é um fluxo Maestro (roda num aparelho ou emulador) que salva a imagem para conferir a olho; não é uma comparação automática de pixels.

## Fase 16 — QA rodada 5 (P1 e P2)

Texto da QA em `docs/qa-round-5.md` (`5157a76`). Commits por grupo: P1 (`4ec6700`) e P2 com este relatório (último commit desta fase). Daniel confirmou a regra do plano grátis para quem escolhe 4 ou mais dias.

### P1

- **R5-01 Joelho:**
  - 36 exercícios a mais ganharam a etiqueta de joelho: balanço de perna (frontal e lateral), alongamentos de panturrilha e posterior em pé, panturrilha sentada com halter ou máquina (carga sobre as coxas), marchas e elevação de joelho sentado, encolhimento em pé, "hinge" em pé, Copenhagen e o supino no chão em ponte;
  - regra no código: depois de uma dor aguda no joelho, qualquer exercício de equilíbrio num pé também sai;
  - exercícios ajoelhados não entram mais por padrão para 60+ (inclui o alongamento de flexor do quadril ajoelhado);
  - auditoria: equilíbrio num pé, encolhimento em pé e "hinge" em pé precisam da etiqueta de joelho;
  - `seed.sql` e a planilha de revisão foram regenerados.
- **R5-02 Descanso:** a tela de descanso usa a mesma recomendação do player. Assim:
  - nada de "+5 lb" em dia de "+1 repetição", no peso corporal ou em elástico;
  - nunca uma segunda subida no mesmo treino;
  - a meta do peso corporal para no topo da faixa (15 em 10–15, não 16);
  - o contador de repetições começa na meta.
- **R5-03 Treino velho:**
  - o treino planejado vence no fim do dia;
  - um treino começado e não terminado é fechado como parcial, no dia da última série (conta para a sequência nesse dia);
  - isso roda ao abrir o app e ao voltar para ele;
  - a Home só oferece treinos de hoje, e a chave de revisão inclui a data.
- **R5-04 Adolescente:** para um adolescente gerenciado, pedem o PIN dos pais:
  - tirar dores ou condições da checagem de segurança;
  - mudar a posição;
  - encerrar um plano de recuperação.

  Adicionar continua livre. A edição agora é um rascunho, salvo em "Continuar".
- **R5-05 Alvos do plano:** pernas → quadríceps, posterior e glúteos; puxar → dorsais e costas; empurrar → peito e ombros.
- **R5-06 Push com 5 exercícios:** nos dias divididos, o mesmo músculo pode aparecer duas vezes, de outro ângulo.
- **R5-07 Abas:**
  - o nome das abas agora é um texto nosso (13 px, a regra mínima de fonte do projeto) e não é mais cortado;
  - novo `npm run tabs:check`: exporta a versão web, abre no Chromium (Playwright) a 390×844, mede cada rótulo (altura e largura do texto, nada cortando) e salva a imagem em `docs/tab-labels.png`.

### P2

- **Puxar x empurrar:** o preenchimento coloca puxada até ela chegar a 90% do empurrar, contando os últimos 7 dias. Quando faltou recentemente, a puxada escolhida é vertical. Numa simulação de 4 semanas com metas de peito e ombro, puxar ficou ≥ 90% e houve puxada vertical toda semana (antes: 50% e 3 vezes).
- **Preenchimento para "Ganhar força" na academia:** sem isometrias, elásticos ou exercícios de reabilitação.
- **Nomes do dia:** só pernas = "Pernas"; só core = "Core"; remada + prancha = "Parte de cima".
- **Prévia de dia fora do plano:** mostra "Dia de descanso".
- **Planos:**
  - o filtro de músculo só traz planos com um dia para aquele grupo;
  - um id desconhecido mostra "não encontrado";
  - 60+ não recebe PPL de 5 ou 6 dias.
- **Treino avulso:** no máximo 2 exercícios por músculo, com peso primeiro para quem treina força na academia.
- **Equilíbrio curto:**
  - aparece na Home para 60+, para quem tem meta de equilíbrio e para quem caiu no último ano;
  - depois de uma parada por dor aguda, o resto do dia só oferece mobilidade, equilíbrio ou descanso (Home normal e 60+).
- **Joe (72):** sem séries de aquecimento com carga para 60+ e descanso de pelo menos 60 s nas séries de força.
- **Motivo na Biblioteca:** "Fora hoje por causa da dor que você informou".
- **Família:**
  - a visão do dono e o botão de compartilhar seguem a checagem segura;
  - `canShare` usa o registro seguro de menores;
  - a migração v1→v2 do registro seguro agora preenche o perfil ativo e os menores a partir da lista da família.
- **Dono de 17 anos sozinho:** não recebe mais pedido de PIN. O texto do PIN diz "mudar a assinatura", não "mudar o plano".
- **Plano grátis com 4+ dias** (confirmado por você):
  - depois dos 3 treinos grátis da semana, a Home mostra "seus treinos grátis desta semana já foram", com a mobilidade curta em destaque e uma menção ao Premium, em vez do paywall ao tocar em Começar;
  - os lembretes dos dias extras sugerem a mobilidade curta.
- **Biblioteca:** carrega de 60 em 60 ("Ver mais 60 (de 715)") em vez de desenhar tudo de uma vez.
- **Link de convite:** `EXPO_PUBLIC_SHARE_BASE_URL` entrou como obrigatório em `docs/launch-readiness.md` (item 15).
- **Acessibilidade:**
  - cada interruptor agora é uma linha inteira, com um só ponto de foco, nome, `aria-checked` e 60 px de altura (conferido no DOM do web);
  - os pontos do corpo não têm mais área de toque sobreposta (sem tamanho mínimo; toque entre pontos vai para o mais próximo);
  - "Não é para você" aberto diz "Esconder os exercícios que não são para você";
  - no treino, "Terminei a série" é o primeiro foco do teclado.
- **Aviso do React "component name 'o'":** o layout raiz agora tem nome fixo.
- **i18n:**
  - ES "Elevación lateral inclinada";
  - as formas `_many` do plural ficam anotadas para depois: por enquanto ES e PT não precisam delas.

### Verificações

- Lint e typecheck limpos; **827 testes** passando (70 suítes).
- `db:test`, `functions:check`, `bundle:check` e `tabs:check` limpos.
- Testes novos:
  - `r5-p1`: joelho, auditorias, recomendação única, treino velho, PIN do adolescente, alvos e Push com 5;
  - `r5-p2`: simulação de 4 semanas puxar/empurrar, preenchimento, nomes, planos, avulso, 60+, motivo na Biblioteca, compartilhar, lembretes do plano grátis.
- Novo pacote de desenvolvimento, gratuito: `playwright-core`, usando o Chromium já instalado.

### Como testar

1. **Dave:** pare com dor aguda no joelho → no mesmo dia, nada de balanço de perna, alongamento de panturrilha em pé ou panturrilha sentada com halter.
2. **Tom (60+):** no dia de +1 repetição, a tela de descanso não diz "+5 lb".
3. **Treino velho:** abra um treino e não faça; no dia seguinte a Home mostra um treino novo.
4. **Adolescente:** Restrições → "Mudança na checagem" → tire uma dor → "Continuar" pede o PIN.
5. **Plano PPL:** o dia de pernas mira quadríceps e posterior; o dia de empurrar tem 5 exercícios.
6. **Abas:** confira os nomes inteiros; ou rode `npm run tabs:check`.
7. **Jess (grátis, 4 dias):** depois do 3º treino da semana, a Home sugere a mobilidade curta, sem paywall.

### Perguntas em aberto

1. **Biblioteca virtualizada:** usei páginas de 60 em vez de uma lista virtualizada (FlashList), porque a lista fica dentro da tela que já rola. O travamento some; se ainda parecer lento no aparelho, troco pela lista virtualizada.
2. **Abas em PT/ES:** o `tabs:check` mede a versão em inglês, que é a que o servidor renderiza. "BIBLIOTECA" e "PROGRESSO" têm folga pelas medidas, mas vale olhar no aparelho em português.

---

## Fase 17 — Tema v2 "Coral suave" (modo dia e noite)

Especificação: `docs/theme-v2.md`.

### O que foi feito

- **Configurações → Aparência:**
  - opções Automático (padrão, segue o celular), Claro e Escuro;
  - fica salvo neste aparelho e muda na hora, sem reiniciar;
  - a navegação não volta ao início quando o tema muda.
- **Sistema acompanha o tema:**
  - barra de status e fundo do sistema no Android (barra de navegação, edge-to-edge);
  - teclado (`keyboardAppearance`);
  - splash: claro #FAF7F4, escuro #15171B (`userInterfaceStyle: automatic` no `app.json`).
- **Tokens:**
  - duas paletas em `src/theme/palettes.ts`;
  - as telas leem as cores ativas (`makeStyles` refaz os estilos por modo);
  - ~60 arquivos passaram para esse formato.
- **Cor primária (coral) só em:**
  - botões principais;
  - aba ativa;
  - "hoje";
  - marcas de progresso.
  As etiquetas de músculo viraram um tom suave.
- **Mapa do corpo:**
  - cartão claro #E9E5DE com cantos de 16 px nos dois modos, nunca invertido;
  - cores de recuperação, ponto branco e anel #333 iguais nos dois modos;
  - textos sobre o cartão usam tokens próprios, que também não mudam.
- **Web:**
  - a página vem pré-renderizada no tema claro;
  - o tema escuro entra logo depois de carregar, porque o React manteria os estilos do servidor.

### Testes

- **Contraste WCAG AA:**
  - todo par texto/fundo nos dois modos, mínimo 4,5:1 (`src/theme/contrast.test.ts`);
  - marcas e anéis, mínimo 3:1.
- **Cores soltas:** um teste falha se houver hex, `rgb()` ou `hsl()` fora de `tokens.ts` e `palettes.ts` (`no-color-literals.test.ts`).
- **Troca de tema:**
  - `scheme.test.ts` e `appearance.test.tsx`;
  - Automático segue o celular, a escolha fixa vence, e a troca é instantânea.
- **Capturas por modo:** `npm run theme:check` (Chromium).
  - Abre 22 telas no claro e no escuro: boas-vindas, conversa do onboarding, mapa do corpo, objetivos, Home adulto e 60+, lista do treino, troca, player, descanso, fim, Biblioteca, página do exercício, Progresso (Atividade e Corpo), Planos, Equipamentos, Configurações, Aparência, Família, paywall, PIN dos pais.
  - Confere o fundo de cada modo e se a tela não redirecionou.
  - Salva 44 imagens em `docs/screenshots/theme/`.
- Lint e typecheck limpos; **888 testes** passando (73 suítes).
- `db:test`, `functions:check`, `bundle:check`, `tabs:check` e `theme:check` limpos.
- Nenhuma dependência nativa nova (`expo-system-ui` e `expo-status-bar` já estavam no projeto).

### Como testar

1. Configurações → **Aparência** → Escuro: o app muda na hora e continua na mesma tela.
2. Automático: troque o modo escuro do celular; o app acompanha.
3. Mapa do corpo no escuro: o corpo continua num cartão claro, com as mesmas cores de recuperação.
4. Treino, player, descanso e fim nos dois modos: botões principais em coral, texto legível.
5. `npm run theme:check` refaz as capturas.

### Perguntas em aberto

1. **Cores ajustadas para passar no AA.** Algumas cores da tabela ficavam abaixo de 4,5:1, então ajustei o mínimo:
   - cinza secundário claro: #6F6861 (a tabela dava 4,42:1);
   - texto sobre o botão coral: escuro #1A0F0C nos dois modos (branco sobre coral dava 3,58:1);
   - coral usado como texto no claro: #BF3721 (`accentText`); o botão continua #E8573F;
   - vermelho de erro no claro: #C73E3E (a tabela dava 4,38:1).

   Prefere manter o branco no botão coral (fora do AA) ou fica assim?
2. **Capturas das lojas:** a ordem ficou em `docs/store/listing.md`: claras primeiro, escuras como extras. As imagens finais saem do build de preview no celular. As de `docs/screenshots/theme/` são referência da web e usam a biblioteca de exemplo (versão de desenvolvimento). A tela de descanso aparece com um aviso de desenvolvimento, porque foi aberta direto pelo endereço.
3. **Biblioteca de vídeos (Gym Animations ou outra):** é serviço pago, então a decisão é sua (e do advogado, pela licença). Não mexi em nada disso.

---

## Fase 18 — Correções da rodada 6 de QA (tema claro e escuro)

Lista do QA: `docs/qa-round-6.md`. Commits separados: um por grupo de P1 e dois de P2 (gerador/lógica e interface).

### P1 — o que foi corrigido

- **R6-01 Troca de tema zerava a navegação.**
  - Agora o tema muda sem remontar nada: cada componente lê as cores por hook (`useColors`), e os estilos também viram hook (`makeStyles`).
  - Um treino em andamento continua na mesma tela, com as repetições digitadas e o timer.
  - A Biblioteca e a lista do treino não voltam mais para a Home.
  - Um teste garante que nenhuma tela volte a ler as cores "fixas".
  - No navegador, o `theme:check` abre o player no claro, muda o sistema para escuro e confere que a rota e o passo não mudam.
- **R6-02 Barra "Desfazer" ilegível no escuro:** novos tokens de painel elevado (`surfaceRaised`, `onSurfaceRaised`, `accentOnRaised`).
- **R6-03 Etiquetas das restrições ilegíveis no escuro:** usam o tom suave com texto escuro.
  - O `theme:check` agora mede o contraste de **todo texto visível** contra o que está pintado atrás dele, nas 24 telas e nos dois modos.
  - Com o código antigo, ele reproduziu exatamente os números do QA (1,00:1, 2,21:1 e 1,48:1). Agora passa.
- **R6-04 Adolescente apagando respostas sem PIN:**
  - Restrições → "Alterar na checagem" abre em modo edição.
  - Depois que a checagem está feita, qualquer caminho (inclusive link direto) edita um rascunho, e remover algo pede o PIN.
  - Um relato novo de dor que substituiria o plano ativo da mesma área também pede o PIN.
- **R6-05 Atualização antiga (registro v1 do dono):**
  - Os menores são semeados depois que os dois stores carregam.
  - O "perfil ativo" nunca vem da lista comum, que pode ser editada. Se ele não está comprovado, o app pede o PIN.
  - O PIN correto registra o dono como ativo.
  - Se não houver menores no celular, o dono fica ativo direto.
- **R6-06 Link de plano inexistente:** mostra "Plano não encontrado" e um botão Voltar, sem travar.
- **R6-07 "Equilíbrio curto" sem saída:**
  - A causa: os exercícios de equilíbrio sentados são marcados no músculo "pai" (abdômen), e a busca só olhava os subgrupos.
  - Agora quem treina só sentado, ou teve dor aguda no joelho, recebe exercícios de equilíbrio sentados.
  - Se mesmo assim não houver sessão possível, o botão some.
- **R6-08 Joelho:** 14 exercícios sentados que levantam ou dobram o joelho (e o "cable woodchop", pelo giro do pé) ganharam a marca de joelho. Uma auditoria nova cobre os sentados, com as exceções revisadas.

### P2 — o que foi corrigido

- **Puxar x empurrar** (sua pergunta), com a simulação de 5 semanas:
  - Quando os objetivos de empurrar ocupam todos os espaços e puxar fica abaixo de 90% nos últimos 7 dias, um alvo de empurrar cede lugar a um de puxar. O objetivo escolhido sempre mantém pelo menos 1 exercício.
  - A puxada vertical, para quem treina na academia, tem que ser de verdade: dorsal em primeiro (puxador, barra fixa, remada de cima para baixo). O "scapular dip" não conta mais.
  - Uma puxada vertical entra toda semana.
  - Resultado na cadeia do Ken: **toda semana puxar ≥ 90% do empurrar** e com puxada vertical real.
  - Exercícios de sustentação (dead hang, carregamentos) não entram como treino principal de força ou músculo na academia.
- **Progressão de carga:**
  - A carga só sobe depois de 2 sessões na carga atual (antes subia duas vezes seguidas).
  - 60+ e quem tem problema cardíaco ou pressão alta sobem o menor entre +5 lb (+2,5 kg) e cerca de 10%. Exemplos: 25 → 27,5 lb, e não 35.
  - Com o peso do corpo, no topo da faixa por 4 sessões: sugere uma versão mais difícil.
- **Depois de dor aguda:**
  - A Biblioteca diz "fora hoje" em vez de "restrição".
  - A página do dia mostra as opções "Pegue leve" em vez de um treino completo.
- **Treino avulso com peito superior, médio e inferior:** cobre as três regiões e completa a quantidade (5 exercícios, cerca de 38 min).
- **Fundo escurecido dos painéis:** token `scrim` (preto a 50% nos dois modos).
- **Web:**
  - `+html.tsx` com `theme-color` para os dois modos, `color-scheme` e o fundo certo antes de carregar, respeitando a escolha em Aparência.
  - O ícone adaptável do Android usa o fundo novo.
- **Switch:**
  - O Espaço alterna na web (conferido no navegador: alterna uma vez só).
  - O estado desligado tem contorno e bolinha escura.
- **Mapa do corpo:** as áreas de toque são redondas e não se sobrepõem mais.
- **Coral só onde deve:**
  - Os títulos pequenos (eyebrows) ficaram cinza.
  - O chip selecionado tem borda escura.
  - Os links ficaram escuros, incluindo "Cancele quando quiser".
- **Layout:**
  - O título "WORKOUT DONE!" no modo 60+ não quebra mais no meio da palavra.
  - "10 min" e "0 dias" não quebram mais.
  - O bloco de Progresso em espanhol virou "Sesiones", que cabe.
  - A barra de abas tem altura própria e espaço embaixo (o `tabs:check` confere que a página não passa da janela).
  - O avatar da Família usa o tom suave de cada modo.
- **Troca do alongamento de tríceps (60+, sentado):** novo rascunho "Alongamento de tríceps sentado atrás das costas", com textos nos 3 idiomas. Agora são 3 opções.
- **Plural em português:** "0 dias", e não "0 dia" (formas `_zero`).
- **Aviso "component name 'o'":** confirmado que só existe no modo de desenvolvimento. O `bundle:check` agora prova que ele nunca vai para o build final. Tirei a correção antiga, que não fazia efeito.
- **Encerrar plano de recuperação aberto por link:** volta para Restrições.
- **`tabs:check`:** agora roda em inglês, português e espanhol, no claro e no escuro.

### Verificações

- Lint e typecheck limpos; **931 testes** passando.
- `db:test`, `functions:check` e `bundle:check` limpos.
- `tabs:check` limpo nas 6 combinações.
- `theme:check` limpo: 24 telas × 2 modos, contraste de todos os textos e troca ao vivo.
- Testes novos:
  - `r6-safety` (adolescente e registro v1);
  - `r6-p1` (equilíbrio sentado e joelho);
  - `r6-p2` (puxar/empurrar em 5 semanas, carga, versão mais difícil, Biblioteca, treino avulso);
  - `theme-route`, `theme-hooks` (tema sem remontar);
  - `r6-swap`;
  - testes da página do dia e do plano inexistente.

### Como testar

1. Comece um treino, digite repetições, e troque o modo do celular (ou vá em Aparência). Você continua no mesmo passo, com os números.
2. No escuro, troque um exercício: a barra "Desfazer" fica legível. As etiquetas em Restrições também.
3. Adolescente: Restrições → "Alterar na checagem" → tire uma dor → pede o PIN. Pelo link direto também.
4. Joe (só sentado): Home → "Equilíbrio curto" abre uma sessão sentada.
5. Abra `/program/nao-existe`: aparece "Plano não encontrado".

### Perguntas em aberto

1. **Puxar x empurrar:** quando só há objetivos de empurrar, o app troca alguns deles por puxar, mantendo pelo menos 1 do objetivo. Concorda, ou prefere só uma nota sugerindo?
2. **Carga no 60+:** a regra "o menor entre +5 lb e cerca de 10%" vale para todo exercício com carga no 60+ (por exemplo, 20 → 22,5 lb no supino). Isso pede halteres de 2,5 em 2,5 lb. Fica assim?
3. **Exercício novo em rascunho:** o "Alongamento de tríceps sentado atrás das costas" precisa da revisão do especialista antes de ser liberado.
4. **Espanhol:** o bloco "Entrenamientos" virou "Sesiones" para caber no Progresso.
5. **Continua em aberto da Fase 17:** as cores ajustadas para passar no AA (texto escuro no botão coral e as outras três).
