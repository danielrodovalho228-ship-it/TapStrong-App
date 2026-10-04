Daniel aqui. Fase 32: "Teste no Android (APK) + programa de ombro 3S". Instalei o APK (`--profile apk`) num Samsung e testei o programa de ombro. A Allinne precisa usar isso já (ombro congelado), então este é o pacote mais urgente. Salve este texto em `docs/phase-32-android-test.md` (commit). Faça os pacotes A → D nesta ordem, um commit por pacote, com testes, i18n en/es/pt-BR, prints Android (adulto, 60+ e adolescente) e relatório em português no fim.

## A. Segurança (P0, corrigir primeiro)
1. **Tríceps francês com halter no programa de ombro.** É um exercício acima da cabeça, e a própria tela diz "Ombro protegido: nada acima da cabeça". Troque pelo **tríceps coice (kickback) com halter**, que é o que o programa da AAOS usa. Teste automático: com ombro congelado ou dor no ombro ativos, nenhum exercício com o ombro acima de 90° ou atrás das costas entra no plano, no Ombro hoje nem na folha Trocar.
2. **Respostas pré-marcadas.** "O seu fisioterapeuta liberou treino de ombro e braço?" já vem marcado como **Sim**, e "Ombro afetado" já vem como **Direito**.
   - Nada vem marcado. A sessão de força (B e C) só libera depois de a pessoa responder.
   - Com "Não / não sei", entra só a sessão A (mobilidade).
3. **"Dose completa" e "Fortalecimento antes do treino"** vêm ligados. O padrão deve ser **desligado**, e a pessoa liga se o fisioterapeuta mandar.

## B. Bugs vistos no APK
1. **Nenhum vídeo nem pôster no app inteiro.**
   - Todos os cards mostram o bonequinho cinza e o player mostra só o mapa.
   - O APK foi gerado sem `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_DEMO_MEDIA`.
   - Para os perfis `apk` e `internal`, configure no EAS (`eas env` ou `eas.json`) as variáveis de mídia apontando para o bucket.
   - Coloque também **dentro do APK** os clipes e pôsteres do programa de ombro, com fallback offline, para funcionar sem internet.
   - Liste no relatório quais dos 18 exercícios do ombro (Pêndulo, Alongamento cruzado, Rotação passiva com bastão interna e externa, Sleeper stretch, Remada com elástico, Rotação externa a 90°, Rotação interna e externa com elástico, Rosca, Tríceps coice, Elevação polegar para cima, Ativação das escápulas, Retração da escápula, Abdução horizontal de bruços, Rotação deitado a 90°, Rotações deitado de lado) **têm clipe f/m e quais faltam**. O Moacir gera os que faltam no Flow, com prioridade máxima.
2. **Não dá para pular o aquecimento.**
   - O botão "Concluir aquecimento" fica bloqueado até a metade do tempo ("Feito libera na metade do tempo").
   - Deixe sempre um **"Pular"** visível. Quem já se aqueceu ou está com pouco tempo não fica presa.
   - Mantenha o aviso curto, mas sem bloqueio.
3. **O aquecimento do ombro é "Caminhada rápida 5 min".** Para reabilitação de ombro, use 2–3 min de mobilidade leve: pêndulo, encolher e girar os ombros. Também precisa dar para pular.
4. **"Ombro hoje · Só alongamentos · Cerca de 73 min"** está errado em três pontos:
   - O card diz "só alongamentos", mas a lista tem 12 exercícios com elástico e halter.
   - 73 minutos é longo demais para alguém com ombro congelado.
   - No **primeiro dia** do programa já aparece "Inclui 7 exercícios que ficaram para trás nesta semana". Não pode haver atraso no dia 1.

   Regra nova:
   - Semana 1: no máximo **20–25 min**.
   - O que ficou para trás nunca soma mais de 1 exercício extra por sessão.
   - O título do card mostra o que a sessão é de fato: "Mobilidade", "Mobilidade + elástico" ou "Mobilidade + halter leve".
5. **Exercício repetido:** Pêndulo e Sleeper stretch aparecem nos alongamentos **e** no desaquecimento, e o sleeper ainda tem os "3 vezes por dia" à parte. Cada exercício aparece **uma vez** por sessão.
6. **Tela do player:**
   - O mapa usa **bolinhas** em vez das áreas do músculo pintadas. Isso já tinha sido pedido na Fase 29. Use o nosso mapa por músculo.
   - O texto "Demonstração em breve" fica por cima da imagem; tire de cima da mídia.
   - A tela do aquecimento está **clara** enquanto o resto do app está escuro. Use o tema escuro.
7. **Aba Treino (Meu plano):**
   - Embaixo de "TREINO DE HOJE" aparece uma barra escura vazia. Era para ser a linha "N exercícios · X min".
   - Os dias "do se te qu qu se sá" repetem "qu" e "se". Use "D S T Q Q S S" ou "dom seg ter qua qui sex sáb".
   - "Semana 1/4 · Evolução" (plano) e "Semana 1 de 6" (ombro) confundem lado a lado. Quando o programa de ombro estiver ativo, ele é o plano principal e a semana mostrada é a dele.
   - A lista de exercícios com os vídeos, como no Gymverse, não aparece. Só aparece o card "Ombro hoje" e "Mais opções".
8. O aviso "Build de desenvolvimento: exercícios em rascunho…" pode ficar no APK de teste, mas **pequeno, no rodapé de Ajustes**, e não dentro do treino.

## C. Programa de ombro 3S (simples, sexy, surpreendente)
**Simples:**
- A tela do programa fica com 3 blocos: **Hoje** (um botão grande), **Semana** (os 7 quadradinhos) e **Ajustes do ombro** (recolhido).
- A lista "Nesta semana" com 18 linhas "0 de 3" vai para dentro de "Ver detalhes".

**Sexy:**
- Cada exercício abre com o clipe do nosso ator (mesmo sexo do perfil) em loop e o lado afetado destacado.
- Ao terminar, o ombro "acende" no mapa e aparece a sequência de dias.
- O quadradinho do dia fica coral.

**Surpreendente:**
- "Amplitude da semana": a pessoa toca até onde levantou o braço hoje (escala de 0 a 180°, com desenho) e vê a curva subir semana a semana.
- Mensagem simples a cada semana completa ("Semana 1 feita. Seu ombro agradece.").
- Lembrete do sleeper stretch com 1 toque para registrar.

## D. Testes mínimos (Android de verdade ou emulador, com Maestro)
- Fluxo da adulta com ombro congelado:
  - instalar, fazer o cadastro e responder "Não sei" sobre o fisioterapeuta → só a sessão A;
  - pular o aquecimento;
  - fazer 2 exercícios com "Fiz" e descanso;
  - usar "Sinto dor";
  - terminar;
  - fechar e reabrir o app → o progresso continua salvo.
- Modo avião: a sessão A inteira funciona, com clipes.
- Nenhum exercício acima da cabeça com a restrição de ombro ativa (teste unitário).
- Sem atraso no dia 1. Semana 1 com 25 min ou menos.
- Grave o fluxo (Maestro) e mande o vídeo no relatório.

No fim, gere de novo o APK (`--profile apk`) e o `.aab` (`--profile internal`) e me passe os dois links.

## Relatório
Em português:
- o que foi feito em cada pacote;
- prints antes e depois (Meu plano, programa de ombro, player e aquecimento);
- a tabela dos 18 exercícios do ombro com o status do clipe f/m;
- os dois links;
- perguntas (no máximo 3), com a opção recomendada primeiro.
