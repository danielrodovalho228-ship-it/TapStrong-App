Daniel aqui. Fase 27: "Regra dos 3 S" — Simples, Sexy e Surpreendente. Só comece DEPOIS de fechar a Fase 26 (fechamento do mês). Salve este texto em docs/phase-27-three-s.md (commit) e implemente os pacotes A, B e C nesta ordem, um commit por pacote. Cada regra com teste, i18n en/es/pt-BR, prints nos modos adolescente, adulto e 60+, e relatório em português no fim.

## A regra
Toda tela e toda função do TapStrong precisa passar nos 3 S antes de ir para a loja:
1. **Simples:** a pessoa entende em 3 segundos o que fazer e faz com 1 toque.
2. **Sexy:** dá vontade de abrir, é bonito e dá orgulho. Aqui "sexy" quer dizer atraente e caprichado, NUNCA sensual. Nada de corpo como objeto, nada de "corpo perfeito", nada de comparação física. Para menores, "sexy" quer dizer "legal/estiloso", e as regras atuais de idade continuam valendo (sem peso, medidas, fotos, recordes nem ranking).
3. **Surpreendente:** de vez em quando o app faz algo bom que a pessoa não esperava. É uma surpresa, nunca uma armadilha: sem culpa, sem pressão e sem nada pago.

Novidade traz aderência, mas recompensa previsível perde a graça rápido. Por isso a surpresa é rara e variada, e o básico (treinar) fica cada vez mais fácil.

## A. SIMPLES — menos toques, menos palavras

### 1. Auditoria de toques (fazer primeiro e pôr no relatório)
Conte os toques e as telas destes caminhos, nos 3 modos, antes e depois da fase:
- abrir o app → primeira série registrada (meta: **no máximo 3 toques** para quem já tem plano);
- instalar → primeiro exercício do primeiro treino (meta: **menos de 90 s** e no máximo 6 perguntas antes do treino; o resto o coach pergunta depois);
- trocar um exercício → no máximo 2 toques;
- terminar o treino → no máximo 1 toque ("Concluir") mais a tela final.

### 2. Home com uma ação só
- Um botão grande no topo: **"Treinar agora · Costas e bíceps · 35 min"** (o próximo treino do plano). Ao tocar, abre o player direto, sem tela intermediária. A prévia continua acessível por um link pequeno "Ver treino".
- Todo o resto da Home fica abaixo desse botão: semana, mapa, cards. Nenhum card acima dele. O card do mês (Fase 26) aparece embaixo.
- No 60+ (SeniorHome), o mesmo botão, maior, e no máximo 3 elementos na tela.

### 3. Uma decisão por tela
- Cada tela tem **um** botão principal (cor cheia) e no máximo um secundário (texto). Revise as telas onde há 2 ou mais botões cheios e rebaixe os outros.
- As configurações raras vão para "Mais opções" (recolhido).

### 4. Linguagem de gente
- Troque o jargão por palavras simples em todos os textos visíveis: "RPE" → "quanto sobrou no tanque" (escala com rostinhos); "deload" → "semana leve"; "hipertrofia" → "ganhar músculo"; "unilateral" → "um lado de cada vez".
- Frases com no máximo 12 palavras em botões e avisos. Teste automático: nenhuma string de botão com mais de 4 palavras (lista de exceções documentada).

### 5. Player simples
- Durante a série, uma ação gigante: **"Feito"**. Repetições e carga já vêm preenchidas com a sugestão; ajustar é opcional (± pequenos).
- O descanso começa sozinho. O próximo exercício aparece sozinho. Nada de "confirmar" entre as etapas.

## B. SEXY — bonito, caprichado, dá orgulho

### 1. O mapa que acende (momento-assinatura do app)
Ao terminar o treino, os músculos trabalhados **acendem no body map** um por um: pulso suave em coral, 150 ms entre um e outro, uma vibração leve (haptic) em cada. Termina com o número grande "8 músculos · 42 min". Isso já existe em versão simples ("body turns red"); a tarefa é polir para virar a marca do app.
- Com "reduzir movimento" ligado no sistema: sem animação, só o estado final.
- 60+: animação mais lenta e texto maior.

### 2. Micro-interações e sensação
- Haptics leves ao marcar série, ao completar exercício e ao bater recorde (só adultos). Nada de vibração no meio da contagem do descanso.
- Transições de 200–300 ms entre as telas do player; botões com leve "afundar" ao toque.
- Sons opcionais (desligados por padrão): um "tic" ao marcar série e um acorde curto no fim do treino.

### 3. Acabamento visual
- Tema coral suave (já aprovado) em tudo: sem cinza "de sistema" e sem tela branca de carregamento. Use esqueleto (skeleton) com a forma do conteúdo.
- Números grandes e bonitos (tempo, séries, músculos) com a fonte do app e numerais tabulares.
- Vídeos: o pôster sempre aparece antes do play (Fase de mídia). Nunca mostre uma caixa preta.
- Estados vazios desenhados: sem "Nenhum dado". Por exemplo: "Seu mapa começa a acender no primeiro treino" + mapa apagado + botão.

### 4. Orgulho sem comparação
- Card de compartilhar mais bonito: o mapa aceso do treino, o total da semana e a sequência. Sem peso, sem medidas e sem foto do corpo. Menores seguem a regra atual (oculto no plano Família sem permissão do responsável).
- Linguagem de identidade, não de culpa: "Você treinou 3 vezes esta semana. Isso é consistência." Nunca "Você perdeu 2 treinos".

## C. SURPREENDENTE — pequenos presentes inesperados

### 1. "Momentos" (o sistema de surpresas)
Crie um motor simples de "Momentos": pequenos cards que aparecem na tela final do treino ou na Home. Tudo local, determinístico e testado.

Exemplos (implemente pelo menos 12, com textos nos 3 idiomas):
- **Primeiras vezes:** primeiro treino de costas, primeiro exercício no chão, primeira semana completa.
- **Mapa:** "Você acendeu todos os músculos das costas este mês", "Músculo novo no seu mapa: panturrilha".
- **Marcos:** 10º, 25º, 50º e 100º treino; 1.000 repetições no total; 100ª série.
- **Curiosidade do músculo de hoje:** 1 fato curto e verdadeiro sobre o músculo principal do treino, por exemplo "O glúteo máximo é o maior músculo do corpo". Crie a lista com 30 fatos revisados, sem promessa de saúde.
- **Coach lembra de você:** "Semana passada seu joelho reclamou. Hoje deu tudo certo? 👍" (só se houve registro de dor; a resposta vai para o histórico).
- **Datas:** aniversário (se informado) e 1 mês ou 1 ano de app.
- **Repair (adultos e 60+):** "Seu lado esquerdo alcançou o direito no teste de 2 minutos".

### 2. Regras da surpresa (importante)
- **Raras:** no máximo 1 Momento por treino, e em média só em 1 de cada 3 treinos. Os marcos grandes aparecem sempre; os pequenos são sorteados com semente fixa por usuário e semana, para os testes serem reproduzíveis.
- **Nunca repetir** o mesmo Momento para a mesma pessoa, exceto os marcos numéricos.
- **Nunca no meio do exercício** nem durante o descanso. Só na tela final ou na Home.
- **Nunca pago e nunca pressão:** sem "loot box", sem moeda, sem "não perca sua sequência!", sem notificação só para mostrar Momento. Pode ser desligado em Configurações ("Surpresas: ligado/desligado").
- **Idades:** menores só recebem Momentos de hábito, curiosidade e mapa (nada de peso, recorde ou corpo). No 60+, texto maior e no máximo 1 por semana.
- Guardar por perfil: a lista de Momentos já mostrados, com data. Sync e RLS iguais aos do progresso.

### 3. Uma surpresa no produto
- No fechamento do mês (Fase 26), o destaque vira um Momento especial: **"Seu músculo destaque de setembro: costas"**, com o mapa aceso. Mostre só isso, sem nova tela.

## Medir (para saber se funcionou)
Registre os eventos locais anônimos (já existentes ou novos, sem dado sensível):
- toques até a primeira série;
- tempo da instalação até o primeiro exercício;
- treinos por semana;
- volta no dia 7 e no dia 30;
- Momentos mostrados e compartilhados.

No relatório, mostre os números da auditoria (A.1) antes e depois.

## Testes mínimos
- Auditoria: teste de fluxo abertura → primeira série em até 3 toques (adulto com plano) e em até 3 toques no 60+.
- Nenhuma tela com mais de 1 botão principal (teste de componentes das telas principais).
- Strings: nenhuma com jargão da lista proibida (RPE, deload, hipertrofia, unilateral) em textos visíveis; botões com no máximo 4 palavras.
- Momentos: frequência (no máximo 1 por treino e média de ~1 em 3), sem repetição, nunca durante o treino, idade (menor não recebe corpo, peso ou recorde), desligar funciona, semente reproduzível.
- "Reduzir movimento" desliga a animação do mapa.
- i18n en/es/pt-BR sem chaves faltando. Prints da Home, do player, da tela final com o mapa acendendo (sequência de 3 quadros) e de 3 Momentos, nos 3 idiomas e nos 3 modos.

## Relatório
Em português: o que foi feito, a tabela de toques e tempos antes e depois, os prints, o que ficou de fora e perguntas (no máximo 3), com a opção recomendada primeiro.
