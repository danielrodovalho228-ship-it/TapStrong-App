Daniel aqui. Fase 31: "Refazer o fluxo do app igual ao Gymverse". Testei o preview no celular e a sequência está chata: tela clara, um exercício por vez com cronômetro, quadro cinza sem vídeo e um botão vermelho grande. Quero a mesma navegação, as mesmas telas e os mesmos momentos do treino do Gymverse (as 3 gravações de tela que mandei), usando os nossos atores (os corpos e clipes `.f`/`.m` do Google Flow) e as nossas regras.

Salve este texto em `docs/phase-31-gymverse-flow.md` (commit) e faça os pacotes A → F nesta ordem, um commit por pacote. Pode mover e reescrever as telas que precisar; não precisa preservar o fluxo antigo. Tudo com testes, i18n en/es/pt-BR, prints dos modos adolescente, adulto e 60+, e relatório em português no fim.

Regras que continuam valendo:
- não copiar logo, nome, fotos nem textos do Gymverse; só a estrutura, a ordem das telas e o comportamento;
- nada de calorias, de ranking ou de leaderboard;
- menores de 18 não veem carga;
- botão "Sinto dor" e restrições continuam em todo treino;
- clipe e pôster sempre do sexo do perfil; sem clipe, mostrar o pôster ou o mapa do corpo com "Demonstração em breve".

Tema: o padrão passa a ser o **escuro**, como na referência (fundo grafite, cards um tom acima). O amarelo do Gymverse vira o nosso **coral** (token do tema). O modo claro continua como opção em Ajustes.

## A. Barra de abas (5 abas, ícone + rótulo)
1. Treino ("Meu plano")
2. Exercícios (corpo)
3. Biblioteca
4. Progresso
5. Ajustes

## B. Aba Treino — "Meu plano"
- **Topo:** "Meu plano ▾" (troca de plano), ícone de calendário e ícone de filtros.
- **Faixa da semana:** Seg a Dom, com o dia de hoje marcado e um ponto nos dias com treino. Tocar num dia mostra o treino daquele dia.
- **Título:** linha pequena em coral "Semana 3/5 · Base". Embaixo, em caixa alta, "TREINO DE HOJE" (ou "TREINO DE SEGUNDA") e o nome da divisão ("Empurrar", "Puxar", "Corpo todo"). Lápis para editar.
- **Linha de resumo:** "6 exercícios · 48 min" + ícone de compartilhar. Sem calorias.
- **Lista do treino, em cards grandes:**
  - "Aquecimento geral": card baixo, com miniatura.
  - Cada exercício: card com o vídeo do nosso ator rodando sem som (ou o pôster). Nome no canto de cima à esquerda, ícone de trocar no canto de cima à direita e selo embaixo "5 séries × 10–12 reps × 35 lb" (para menores, só "3 séries × 10–12 reps").
  - "Alongamento final": card baixo.
- **Botão fixo embaixo:** "COMEÇAR TREINO" (coral, largura total).
- **Dia de descanso:** tela "DIA DE DESCANSO" com ícone e o texto "Recomendamos 5–10 minutos de alongamento hoje para ajudar na recuperação". Botão "Alongar agora".

## C. Trocar exercício (folha "TROCAR EXERCÍCIO")
- **Formato:** folha que sobe de baixo, com título e X.
- **Linhas:** miniatura do nosso ator, nome e ícone (i). Tocar na linha troca o exercício.
- **Ordem:** primeiro "Mesmo músculo", depois "Outras alternativas", e "Mais" no fim.
- **Filtro:** só o equipamento que o usuário marcou.
- Continua só trocando, nunca adicionando.

## D. Durante o treino (o principal)
1. **Aquecimento geral:**
   - vídeo em tela cheia com o nosso ator;
   - embaixo: "Exercício 1/4", o nome, "6 reps" grande à direita e 2 linhas de instrução;
   - botão "CONCLUIR AQUECIMENTO".
2. **Tela do exercício (registro de séries):**
   - **Topo:** "Sair" | "EXERCÍCIO 1/6" | "Exercícios" (lista para pular).
   - **Linha de contadores:** Tempo (cronômetro do treino) · Volume (lb ou kg) · Reps.
   - **Cabeçalho:** miniatura do ator, nome, chip do músculo e ícone de notas. Tocar no cabeçalho abre o detalhe (item 5).
   - **"Carga máxima":** mini gráfico de área da carga máxima com a meta tracejada (adultos).
   - **Card "Aquecimento do exercício"** (só exercícios com carga): "10 reps barra vazia · 5 leve · 3 média · 1 média-pesada", com botão "Fiz".
   - **"Próximo":** linha "Próximo: 5 séries × 10–12 reps".
   - **Lista de séries:**
     - a série atual fica destacada em coral: "Sugerido 80 lb (última 75)", "10–12 reps (última 12)" e botão "Fiz" à direita. Embaixo, "Peso da barra + anilhas";
     - as séries futuras ficam apagadas, com ▶;
     - ao tocar em "Fiz", a série vira uma linha registrada "80 lb | 12 reps ✓ Refazer" e o descanso começa;
     - tocar no número de peso ou de reps abre o ajuste rápido.
   - **Descanso:**
     - círculo grande sobreposto com "Descanso 1:29", "−15" e "+15" e "Toque para pular";
     - vibra no fim;
     - o tempo vem de Ajustes > Descanso.
   - **Botões:** "Registrar todas as séries" e "Personalizar exercício". Este abre uma folha com séries −/+, reps −/+ e "Aplicar a: Plano inteiro / Só este exercício", com "Descartar" e "Pronto".
   - **Meta:** faixa "Faça 85 lb para bater a meta deste exercício!" quando houver progressão.
   - **Fim da tela:** card "Próximo exercício" com miniatura e "5 séries × 15–20 reps".
   - **Menores:** sem coluna de carga, só reps. **60+:** botões e números maiores.
3. **Entre exercícios:** tela de prévia do próximo exercício, com "Fechar", cabeçalho, carga máxima, séries sugeridas apagadas e botão "Começar exercício".
4. **Menu ⋯ do treino:** "Pausar treino", "Concluir treino" e "Descartar treino". Descartar pede confirmação: "Descartar e sair" / "Cancelar".
5. **Detalhe do exercício**, com abas "Orientação" e "Desempenho":
   - **Orientação:** vídeo do ator, "Músculos trabalhados" (primário forte, secundário claro, frente e costas lado a lado usando o NOSSO mapa por músculo), instruções e "Notas do exercício" (campo livre).
   - **Desempenho (adultos):** nível de força, recordes pessoais (carga máxima, 1RM estimado, volume máximo), histórico por data com as séries (editável) e gráfico.
6. **Alongamento final:** igual ao aquecimento geral, com o botão "CONCLUIR ALONGAMENTO".
7. **Fim do treino:**
   - resumo com tempo, volume, séries e o mapa "Músculos trabalhados" (áreas pintadas, frente e costas);
   - botões "Compartilhar" e "Salvar progresso";
   - depois, a conta grátis, mas só a partir do 2º treino (já decidido).

## E. Aba Exercícios (corpo)
- **Corpo:** corpo 3D grande do nosso ator do sexo e da faixa de idade do perfil, com pontos coral sobre cada grupo muscular.
- **Rótulos:** nomes dos músculos nas laterais (Ombros, Peito, Antebraços, Oblíquos, Quadríceps / Cardio, Bíceps, Abdômen, Adutores).
- **Girar:** "Deslize 180°" para ver as costas.
- **Ao tocar num músculo:** abre a grade de 2 colunas com o vídeo do ator, o nome e uma estrela de favorito, mais a busca.
- **Atalhos:** estrela no topo para "Favoritos" e lupa para buscar por nome.

## F. Biblioteca, Progresso e Ajustes
- **Biblioteca:**
  - filtros no topo: "Equipamentos (n)", "Músculos (n)" e "Tempo";
  - fileiras "3 dias por semana", "4 dias", "5 dias", "6 dias", com cards grandes de foto (nossos pôsteres), o objetivo em destaque ("FICAR EM FORMA", "GANHAR MÚSCULO", "PERDER PESO", "FORÇA", "MOBILIDADE 60+", "OMBRO — REABILITAÇÃO") e a divisão embaixo;
  - **Equipamentos:**
    - tela "EQUIPAMENTOS SELECIONADOS (n)" com busca e o aviso "Suas escolhas aqui não mudam o plano atual";
    - atalhos: Academia completa / Academia pequena / Casa / Peso do corpo;
    - grupos com "Desmarcar tudo" e um interruptor por item;
    - botões "Descartar" e "Pronto".
- **Progresso**, com abas "Atividade" e "Corpo":
  - **Atividade:** filtros 7D / 30D / 6M / 12M / Tudo. Mostra o número de treinos, as horas e o peso total levantado, o calendário "Seus treinos" com os dias marcados e "Gráficos por exercício";
  - **Corpo:** peso corporal, fotos "Antes e depois" (privadas, só no aparelho) e conquistas (selos de semanas seguidas e de volume). Sem nutrição e sem calorias.
- **Ajustes:**
  - card do plano (Premium/Família);
  - perfil;
  - minha conta;
  - nível de experiência;
  - unidades (lb/kg);
  - "Peso e reps inteligentes";
  - tempo de descanso;
  - aquecimento e alongamento (liga/desliga);
  - exibição da aba Treino;
  - "Escolher modelo" (corpo do ator: sexo e faixa de idade);
  - Apple Health / Health Connect;
  - ajuda;
  - avaliar o app;
  - compartilhar;
  - Termos e Privacidade;
  - excluir conta.

## Testes mínimos
- Fluxo completo no adulto: Meu plano → Começar → aquecimento → 2 exercícios com "Fiz", descanso, "Refazer" e "Personalizar" → alongamento → fim. Repetir no adolescente (sem carga) e no 60+.
- Trocar exercício filtra pelo equipamento e não aumenta o número de exercícios.
- Descartar treino pede confirmação e não salva nada.
- Clipe ou pôster do sexo certo em todos os cards; sem clipe, mostra o pôster ou o mapa.
- Nenhum texto em cima do vídeo no player (snapshot).
- Tema escuro por padrão sem nenhum vermelho fixo (tudo pelo token coral); modo claro funcionando.
- i18n sem chaves faltando.

## Relatório
Em português:
- o que foi feito em cada pacote;
- prints lado a lado com a referência (Meu plano, Trocar, aquecimento, registro de séries com descanso, detalhe, fim, corpo, biblioteca, equipamentos, progresso, ajustes);
- o link do preview para eu testar no celular;
- perguntas (no máximo 3), com a opção recomendada primeiro.
