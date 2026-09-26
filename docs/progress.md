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
