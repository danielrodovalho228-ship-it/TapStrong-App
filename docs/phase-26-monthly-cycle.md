Daniel aqui. Fase 26: "Fechamento do mês" (resumo + próximo mês com um toque). Só comece DEPOIS de fechar a Fase 25 (segurança). Salve este texto em docs/phase-26-monthly-cycle.md (commit), implemente na ordem abaixo, testes para cada regra, i18n en/es/pt-BR, relatório em português no fim.

## Por quê
Eu uso o Gymverse e todo mês tenho que trocar exercício por exercício na mão para não ficar repetitivo. No TapStrong isso tem que ser automático: o app fecha o mês, mostra a evolução e já traz o próximo mês pronto, com no máximo UMA decisão (e zero obrigatórias).

Base científica (resumo da pesquisa):
- Variar exercícios aleatoriamente a cada treino não traz mais músculo nem força (Baz-Valle 2019, PLOS One; revisão Kassiano 2022, JSCR) e atrapalha a sobrecarga progressiva; mas a variação aumentou a motivação intrínseca (Baz-Valle 2019) e a novidade ajuda a aderência (Frontiers Psychol 2020).
- Melhor prática: variação SISTEMÁTICA entre blocos — manter o exercício principal (composto) que ainda está progredindo e trocar os acessórios; trocar o que estagnou.
- ACSM 2026: o melhor programa é o que a pessoa mantém; todos os grupos grandes ≥2x/semana → não trocar TODOS os músculos por mês, e sim girar o FOCO.

## Decisões minhas
1. **Quando:** no fim do bloco (depois da semana leve/deload), na primeira abertura do app. Bloco padrão passa a 4 semanas (3 normais + 1 deload) = "1 mês". Planos que pedem 5–6 semanas continuam valendo; o resumo sai no fim do bloco que for. Sem plano ativo: a cada 28 dias desde o 1º treino / último resumo. Só aparece se houve ≥4 treinos no bloco; senão, card leve "Vamos retomar?" sem resumo.
2. **Músculos:** base + foco que gira. O corpo continua sendo treinado; cada mês o app sugere 1–2 músculos de foco (os mais atrasados ou desequilibrados) além das metas que o usuário marcou. Nunca remove metas do usuário sozinho.
3. **Sem resposta:** aplica a sugestão. Se ele fechar a tela ou for direto treinar, o novo mês começa com a recomendação e o 1º treino mostra "Renovei 4 exercícios · Desfazer" (desfazer vale 7 dias e volta ao mês anterior igual).

## O que construir

### A. Tela "Mês fechado" (tela cheia ao abrir o app, uma vez por bloco)
Unifica o check-in de 4 semanas atual (checkin.ts / checkin.tsx) com este resumo — não podem existir os dois. Uma tela rolável, com "Pular" sempre visível:
1. Título: "1 mês completo!" (ou "Bloco N completo" se o plano tiver 5–6 semanas) + número de treinos, dias treinados (calendário do mês, já existe monthGrid), tempo total.
2. **Corpo da evolução:** body map colorido pelas séries do mês por músculo (não pelo estado de recuperação), com legenda; toque em um músculo mostra séries deste mês vs mês anterior.
3. Força: reaproveitar strengthChanges() (semana 1 vs semana 4) + recordes do mês (respeitando visibleRecords por idade).
4. Corpo/medidas/fotos: o que já existe no check-in, só para quem já pode ver (adultos; 60+ só se ativou; nunca menores).
5. Destaques em 2 frases, sem culpa: um ponto forte ("Costas foi seu destaque: +3 séries/semana") e um ponto a melhorar ("Posterior de coxa ficou com pouco treino").
6. Repair: se o reteste estiver vencido, mostrar "Refaça o teste de 2 minutos antes de montar o próximo mês" como primeiro passo (não bloqueia).

### B. Card "Seu próximo mês" (mesma tela, no fim) — uma escolha, com padrão pronto
- **Botão principal (padrão, destacado): "Continuar evoluindo (recomendado)"**. Mesmos músculos e metas, exercícios renovados pelas regras de C, + foco sugerido (1–2 músculos). Mostra uma prévia curta: "Mantém: agachamento, remada · Troca: 4 exercícios · Foco novo: posterior de coxa". Link "Ver/ajustar" abre a lista com cadeado por exercício (travar = manter).
- "Repetir igual": mesmos exercícios exatamente (para quem quer medir progresso no mesmo movimento).
- "Escolher no corpo": abre o body map com os músculos atuais já marcados e o foco sugerido piscando.
Sem outras perguntas. Não perguntar "quer mudar os exercícios?" separado — isso já é o botão principal.

### C. Regras de renovação (função pura, testada)
Por músculo trabalhado no mês:
- **Mantém** o principal (composto) se ele ainda progrediu nas últimas 2–3 semanas (carga, reps ou tempo) — é ele que mede a evolução.
- **Troca** acessórios (pelo menos metade) por alternativas seguras do mesmo músculo (alternatives.ts), preferindo o que ele não fez nos últimos 2 blocos e outro ângulo/região do músculo.
- **Troca** qualquer exercício estagnado (sem progresso 3 semanas) ou com dor registrada no bloco (nunca volta um exercício que gerou dor "sharp").
- **Nunca troca** exercícios com estrela (favoritos) nem travados no "Ver/ajustar".
- Limite de mudanças: adultos/teens até ~50% dos exercícios; 60+ e joint-care no máximo 2 trocas por mês (estabilidade e segurança); Repair segue o plano do reteste.
- Todas as travas atuais continuam valendo (limites semanais de séries por idade, orçamento articular, equipamento, restrições).
- A carga do exercício novo começa conservadora (primeira sessão = descobrir carga), a do mantido continua a progressão.

### D. Foco do próximo mês (função pura, testada)
Sugerir no máximo 2 músculos, nesta ordem:
1. Músculo marcado pelo usuário que ficou abaixo do mínimo (<~4 séries/semana na média do mês);
2. Desequilíbrio: empurrar vs puxar (peito+ombro frontal vs costas), quadríceps vs posterior, lados (Repair "uneven");
3. Músculo grande "negligenciado" no mapa (sem treino ≥14 dias).
Foco = +2–3 séries/semana nesse músculo dentro do limite semanal; não tira músculo de ninguém. Frase explicando o porquê em 1 linha.

### E. Aparição sem incomodar
- Tela cheia só UMA vez por bloco, na 1ª abertura após o fim do deload. Fechou → vira card na Home por 7 dias ("Seu resumo do mês") e some.
- Se ele começar um treino sem escolher: aplica o padrão (B) e toast "Renovei N exercícios · Desfazer".
- Notificação local opcional "Seu mês fechou 🎉" no dia seguinte ao fim do bloco, respeitando as preferências de notificação e horário atuais (sem nova permissão).
- Nada disso aparece no meio de um treino, nem para perfil sem treinos.

### F. Idades e família
- Menores (13–17): resumo com dias treinados, séries, sequência e mapa; sem peso, medidas, fotos ou recordes (regras atuais). Linguagem de hábito, não de corpo.
- 60+: textos maiores/SeniorHome, trocas limitadas (C), foco em equilíbrio e mobilidade quando o plano for seniorSteady.
- Família: um resumo por perfil; o responsável não vê fotos/medidas de ninguém.

### G. Dados
- Guardar por perfil: blockNo, datas, resumo calculado (JSON pequeno), escolha (continue/repeat/body/auto), lista de trocas (de→para, motivo) e undoUntil. Local + sync existente; RLS igual às tabelas de progresso (dono do perfil). Nada de dado sensível novo.
- Permitir ver resumos antigos em Progresso > "Meses".

## Testes mínimos
- Trigger: fim de bloco 4 e 6 semanas, sem plano (28 dias), <4 treinos, uma vez por bloco, card 7 dias.
- Renovação: mantém composto que progrediu; troca estagnado e com dor; respeita estrela/trava; limites 50%/2 trocas; respeita limites semanais e orçamento articular; nunca repete exercício "sharp".
- Foco: ordem das regras, máximo 2, nunca remove metas.
- Auto-aplicar + desfazer (7 dias restaura o mês anterior idêntico).
- Idades: menor não vê peso/foto/recorde; 60+ limite de trocas.
- i18n en/es/pt-BR sem chaves faltando; screenshots da tela e do card nos 3 idiomas.

## Relatório
Em português: o que foi feito, prints, o que ficou de fora e perguntas (no máximo 3), com a opção recomendada primeiro.
