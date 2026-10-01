Daniel aqui. Fase 29: "Correções do teste no celular + o que aprender com o Gymverse". Gravei a tela usando o preview web (…-preview.vercel.app) no iPhone e comparei com o Gymverse (app concorrente, tema escuro e amarelo). Salve este texto em docs/phase-29-phone-test.md (commit) e faça os pacotes A, B e C nesta ordem, um commit por pacote. Se algo já existir, não duplique: diga no relatório "já existia (commit X)". Tudo com testes, i18n en/es/pt-BR, prints nos modos adolescente, adulto e 60+, e relatório em português no fim.

## A. Bugs que vi no teste (corrigir primeiro)

1. Os vídeos não aparecem no preview. Em TODOS os exercícios do treino (Polichinelo de baixo impacto, Elevação de joelhos sentado, Círculos com o quadril, Flexão inclinada aberta, Caminhada balançando os braços, Respiração lenta) aparece o quadro cinza "Demonstração · em repetição" com o texto "O vídeo de demonstração chega com a biblioteca de exercícios licenciada". Já temos 181 clipes.
   - Ligue os nossos clipes e pôsteres no preview web (pode ser uma flag de ambiente só do preview, por exemplo `EXPO_PUBLIC_DEMO_MEDIA=1`). A versão de loja continua bloqueada pelo `bundle:check` até eu liberar.
   - Quando o exercício não tiver clipe, mostre o pôster (se houver) ou o mapa do corpo com o músculo aceso, e o texto "Demonstração em breve". Tire a frase "biblioteca licenciada": os vídeos são nossos.
   - Confira se os slugs do treino de iniciante (warm-up e cool-down) têm clipe. Os que não têm vão para o `docs/media-redo.md` como "faltando, prioridade alta: aparece no primeiro treino".
2. "Sentar e levantar": a imagem invade a tela. A foto do homem ocupa a tela inteira atrás do texto, corta o rosto, e o selo "DEMO DE PROTÓTIPO · SÓ NO DESENVOLVIMENTO" fica por cima do título. Os textos ficam ilegíveis em cima da foto.
   - O vídeo ou pôster fica sempre dentro do mesmo quadro 9:16 (ou 4:5) no topo da tela, com cantos arredondados e `contain`. Nunca fica como fundo da tela.
   - O selo de protótipo fica pequeno, dentro do quadro, e não aparece no preview.
   - Teste automático: nenhum texto do player fica por cima da mídia.
3. A folha "Trocar" ("No lugar de…") está pesada. Cada opção tem um botão vermelho grande "SUBSTITUIR", os quadros de vídeo aparecem vazios e o texto aparece cortado e borrado.
   - Cada opção vira uma linha: pôster à esquerda (o do sexo do perfil), nome e 1 linha de dica. Toque na linha = troca. Use 1 botão secundário, ou nenhum.
   - Coloque no topo: "Mesmo músculo · mais fácil / igual / mais difícil".
4. Fim do treino. O mapa mostra "bolinhas" nas articulações, e não os músculos acesos. Use o mapa por músculo (áreas pintadas), como no resto do app e no Gymverse ("Muscles worked": primário em cor forte, secundário em cor clara, frente e costas lado a lado).
   - O card "Termine forte" ("Seus músculos das costas ainda não foram treinados…") aparece depois de um treino de 2 minutos do primeiro dia. No primeiro treino, não mostre: a pessoa acabou de começar.
5. Salvar o mapa (pós-treino). O aviso vermelho "As notificações do TapStrong estão desligadas. Ligue nos ajustes do celular" aparece sem a pessoa ter ligado nada.
   - Só mostre esse aviso se a pessoa tentar ligar um lembrete e a permissão for negada.
   - Na web, esconda os lembretes ou explique "disponível no app".
6. Detalhes que vi:
   - "SINTO DOR" em vermelho no topo de toda tela chama mais atenção que o próprio exercício. Deixe com a cor do texto secundário e um ícone, sem caixa alta vermelha.
   - O toast "Trocado por Elevação de joelhos sentado · DESFAZER" cobre o botão FEITO. Suba o toast ou deixe ele acima do botão.

## B. O que vale copiar do Gymverse (adaptado ao nosso público e às regras de idade)

1. Prévia do treino com imagem. Na Home, o card do treino mostra a lista de exercícios com o pôster de cada um (no sexo do perfil), "3 séries × 8–12" e o ícone de trocar, mais o resumo no topo (exercícios · minutos). Hoje a prévia é só texto.
2. Semana no topo da Home. Uma faixa com os 7 dias (Dom–Sáb), com o dia de hoje marcado e um ponto nos dias treinados. Toque num dia = treino daquele dia.
3. Tela do exercício com 2 abas: "Como fazer" e "Meu histórico".
   - "Como fazer": vídeo, músculos trabalhados (frente/costas, primário e secundário) e dicas.
   - "Meu histórico": as últimas vezes, com séries × reps (e carga, só para adultos).
4. Sugestão do dia por série (adultos com carga). Mostre "Sugerido: 80 lb × 10–12 (da última vez: 75 × 12)" e um botão grande "Feito" que registra a sugestão com 1 toque. Ajustar continua opcional. Mostre também um mini gráfico da carga máxima e a meta "Bata 85 lb para superar a sua marca". Para menores, só repetições, sem carga e sem recorde.
5. Aquecimento por exercício (adultos com carga). Antes do 1º exercício com peso, mostre um card "Aquecimento: 10 reps leve · 5 reps médio · 3 reps quase lá" com "Feito" ou "Pular".
6. Descanso. O timer circular com −15 s e +15 s, e "toque para pular". Hoje temos +30 s e Pular; deixe −15/+15.
7. Menu do treino. Um "⋯" no player com "Pausar treino", "Concluir treino" e "Descartar treino" (este com confirmação).
8. Biblioteca de programas. Uma aba ou seção "Programas" com cards grandes de foto e objetivo: "Ganhar força", "Perder peso", "Ganhar músculo", "Mobilidade 60+", "Começar do zero", com filtro por dias por semana (3, 4, 5). Use os nossos pôsteres, sem fotos de academia com marca.
9. Equipamentos que eu tenho. Uma lista agrupada (Casa: cadeira, toalha, elástico, halteres · Academia: bancos, máquinas, cabos) com interruptores. O gerador de treino só usa o que está ligado. Se já existir, mostre no relatório onde está.
10. Corpo que gira. Na aba do mapa, além de frente/costas, deixe arrastar para girar (ou um botão 180°), como o "Swipe 360°" do Gymverse.

O que NÃO copiar:

- fotos de academia com logos e homens sem camisa em todo lugar;
- "calorias" estimadas no treino (dado de saúde impreciso);
- ranking ("Leaderboards").

As nossas regras de idade e de privacidade continuam valendo.

## C. Tema e acabamento

- O preview está vermelho forte (#E2463A?). O aprovado foi o coral suave (docs/theme-coral). Confira se os botões principais usam o token do tema e não um vermelho fixo.
- No modo escuro, faça o teste com o mesmo roteiro (o Gymverse é todo escuro e fica bem no celular).

## Testes mínimos

- O preview mostra o clipe e o pôster certos por sexo em 10 exercícios do treino de iniciante. Sem clipe: pôster ou mapa e o texto "Demonstração em breve".
- Nenhum texto sobreposto à mídia no player (snapshot).
- "Termine forte" não aparece no 1º treino. O aviso de notificação só aparece depois de uma permissão negada.
- Sugestão por série: 1 toque registra; menores não veem carga.
- i18n sem chaves faltando.

## Relatório

Em português:

- o que foi feito;
- prints antes/depois do player, da folha Trocar, do fim do treino e da Home com a prévia;
- a lista dos exercícios do treino de iniciante sem clipe;
- o link do preview atualizado para eu testar de novo no celular;
- perguntas (no máximo 3), com a opção recomendada primeiro.
