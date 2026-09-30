Daniel aqui. Fase 28: "Compartilhar bonito" — cards, adesivos, print inteligente e conquistas. Só comece DEPOIS da Fase 27 (3 S). Salve este texto em docs/phase-28-sharing.md (commit) e implemente os pacotes A a E nesta ordem, um commit por pacote. Tudo com testes, i18n en/es/pt-BR, prints nos modos adolescente, adulto e 60+, e relatório em português no fim.

## Por quê (resumo da pesquisa)
- Os apps que crescem sozinhos transformam cada treino em uma imagem bonita, pronta para postar. O Hevy gera automaticamente, ao fim de cada treino, imagens de recordes, volume, **gráfico de músculos trabalhados**, comparações divertidas ("você levantou o peso de um carro"), calendário e resumo do mês, com fundo claro, escuro ou **transparente** para colar em cima de uma selfie e mandar direto para os Stories do Instagram. O Strava lançou em 2025 os "Sticker Stats": um adesivo transparente com os números e o desenho do trajeto, que vai para a área de transferência ou direto para os Stories.
- O compartilhamento de um usuário para outro é o canal de aquisição mais barato que existe. Quando a pessoa tira print, apps como Audible e Etsy mostram na hora "Compartilhar com um amigo?", com um link rastreável no lugar da imagem solta.
- **Técnica:** o iOS avisa quando o usuário tira print (`userDidTakeScreenshotNotification`). O Android 14+ também avisa (`ScreenCaptureCallback`, permissão `DETECT_SCREEN_CAPTURE`, o sistema mostra um aviso ao usuário). Nenhum dos dois entrega a imagem: o app sabe só que houve print e em qual tela. Mandar direto para os Stories do Instagram exige um App ID do Facebook registrado (regra do Instagram desde 2022).
- **Motivação:** num estudo randomizado com 800 pessoas (Penn, 2016), a comparação amigável entre pares aumentou a frequência nos treinos mais do que o apoio social puro. Mostrar o próprio progresso ajuda.
- **Cuidado:** as revisões sobre "fitspiration" mostram que fotos de corpo e comparação física pioram a imagem corporal, principalmente em adolescentes. Por isso **o nosso card mostra o mapa de músculos e o esforço, nunca o corpo da pessoa, o peso ou medidas.** É o nosso diferencial: orgulho do treino, não do corpo.

## O que já existe (não duplicar)
`/share` (card com mapa, sequência e link de convite, oculto para criança), o compartilhamento da sequência em `/milestone`, e a regra `canShare` para menores. Esta fase **substitui** esse card por um sistema de modelos e unifica tudo em um só componente de compartilhamento. Tudo que já foi corrigido nos QAs continua valendo: "Compartilhar com amigos" = link de convite, e `canShare` é checado em todo lugar.

## A. Motor de cards (base de tudo)
1. Um componente `ShareCard` que desenha **fora da tela** (react-native-view-shot ou Skia) e exporta PNG em 1080×1920 (Stories) e 1080×1350 (feed), em 3 fundos: **claro (coral suave), escuro e transparente (adesivo)**.
2. Cada card leva: a marca TapStrong discreta no rodapé e um link curto `tapstrong.app/c/<código>`. Não coloque QR grande nem nome completo. O nome aparece só se a pessoa ligar "Mostrar meu nome".
3. Nunca entra no card: foto do corpo, peso corporal, medidas, IMC, local, horário exato, dor ou restrição, nome de criança. Teste automático para cada modelo.
4. A folha de compartilhar tem 4 botões: **Stories do Instagram** (direto, com o App ID do Facebook em `.env`; sem ID, cai no compartilhar do sistema), **WhatsApp**, **Salvar na galeria** e **Mais…** (folha do sistema). Mais um botão "Copiar adesivo" para o fundo transparente.

## B. Os modelos (o que dá para compartilhar)
1. **Treino feito** (tela final e histórico): o mapa aceso com os músculos do dia, o nome do treino ("Costas e bíceps"), a duração, o número de exercícios e séries, e a sequência de dias. Variação **adesivo**: só o mapa aceso com 2 números, fundo transparente.
2. **Músculo do dia:** 1 músculo em destaque no mapa com a frase "Hoje eu treinei: glúteos 🔥". É o mais simples de todos e funciona para todas as idades.
3. **Ficha do exercício** (a "imagem perfeita do exercício"): o pôster do exercício no sexo do perfil, o nome, os músculos principal e secundário no mini-mapa, 3 dicas curtas de execução e a marca. Serve para salvar e mandar para alguém: "faz esse aqui". Botão "Salvar ficha" na tela do exercício e na biblioteca.
4. **Conquista:** os Momentos da Fase 27 (primeiro treino de costas, 25º treino, músculo novo no mapa etc.) viram cards com um desenho simples (ícone + frase + mapa). Recorde de carga só para adultos, que já é a regra atual.
5. **Semana e mês:** "Minha semana" (dias treinados + mapa da semana) e "Meu mês" (vem da Fase 26: músculo destaque, treinos, mapa do mês). O resumo do mês é o card mais bonito do app; capriche nele.
6. **Comparação divertida (só adultos, só quando houver carga registrada):** "Esta semana você levantou o equivalente a 2 cavalos 🐎". A tabela de equivalências é fixa, com números conferidos, arredondados e bem-humorados.

## C. Print inteligente
- Ative a detecção de print (iOS: notificação do sistema; Android 14+: `ScreenCaptureCallback`) **só** em 5 telas: fim do treino, tela do exercício, mapa do corpo, conquista e resumo do mês.
- Ao detectar o print, mostre uma barrinha discreta embaixo por 5 s: **"Quer uma versão bonita para postar?"** com os botões [Criar card] e [x]. O card aberto é o modelo daquela tela (tela do exercício → Ficha do exercício).
- No máximo 1 barrinha por sessão do app. Se a pessoa fechar 3 vezes seguidas, pare de oferecer (dá para reativar em Configurações).
- Não use FLAG_SECURE em nenhuma dessas telas: o print é bem-vindo.

## D. Link, convite e página pública
1. Cada card compartilhado gera um código curto. O link `tapstrong.app/c/<código>` abre uma página web simples e rápida com a imagem do card, "Treine com o TapStrong" e os botões da App Store e da Google Play. Com o app instalado, o link abre o app (deep link). O card de ficha abre direto aquele exercício.
2. **Convite:** se quem chegou pelo link criar a conta, as duas pessoas ganham 7 dias de Premium (no máximo 5 convites premiados por mês por pessoa). Sem dinheiro e sem ranking.
3. **Dados:** a tabela `share_links` guarda (código, modelo, data, perfil dono, contagem de aberturas). A imagem pública não contém nenhum dado sensível (ver A.3). RLS: só o dono vê e apaga os próprios links. Apagar a conta apaga os links e as imagens. A página pública não indexa (noindex) e não tem contador visível.
4. **Eventos (sem dado de saúde):** `share_opened` (modelo, origem: botão ou print), `share_completed` (destino), `share_link_opened`, `referral_signup`. Isso completa o `share_card_shared` que já existe.

## E. Idades, família e privacidade
- **Menores (13–17):** só os modelos "Músculo do dia", "Treino feito" (sem carga) e Conquistas de hábito, e só se `canShare` permitir (no plano Família, o responsável decide). Sem nome, sem link de convite com recompensa, sem página pública com o nome e sem print inteligente (a barrinha não aparece). Padrão: desligado até o responsável ligar.
- **60+:** os mesmos modelos dos adultos, com letras maiores, e o botão WhatsApp em primeiro lugar (é o canal da família).
- **Todos:** a opção "Nunca mostrar ofertas de compartilhar" em Configurações. Compartilhar nunca é obrigatório para desbloquear nada, exceto o bônus do convite, que é opcional.
- **Nada de localização**, nunca. O Strava teve problemas sérios com mapas de calor mostrando bases militares; nós não temos GPS e vamos continuar assim.

## Testes mínimos
- Cada modelo × 3 fundos × 3 idiomas × 2 formatos gera um PNG sem cortar texto (snapshot).
- Nenhum modelo inclui peso, medidas, foto, local, dor, restrição ou nome de menor (teste que varre os dados de entrada de cada card).
- Menor sem permissão: nenhum botão de compartilhar aparece em nenhuma tela; com permissão, só os modelos liberados.
- Print: a barrinha aparece só nas 5 telas, no máximo 1 vez por sessão, e para depois de 3 recusas; nunca para menores.
- Link: o código abre a página certa; o deep link abre o exercício certo; apagar a conta apaga os links; RLS impede ver o link de outra pessoa.
- Convite: o bônus é aplicado às 2 pessoas uma única vez, respeitando o limite de 5 por mês.
- i18n sem chaves faltando. Prints de todos os modelos no relatório.

## Relatório
Em português: o que foi feito, os prints de cada modelo (claro, escuro e adesivo em cima de uma foto de exemplo), o que ficou de fora, o que eu preciso fazer (criar o App ID do Facebook e configurar o domínio `tapstrong.app` com os links do app) e perguntas (no máximo 3), com a opção recomendada primeiro.

---
Fontes:
- Hevy (imagens compartilháveis): https://www.hevyapp.com/features/shareable/
- Strava Sticker Stats (2025): https://www.bikeradar.com/news/strava-sticker-stats-spring-2025-updates
- Detecção de print para oferecer compartilhamento: https://www.branch.io/resources/blog/how-to-detect-when-a-screenshot-is-taken-and-prompt-a-share-to-increase-app-engagement/
- Android 14, detecção de print: https://developer.android.com/about/versions/14/features/screenshot-detection
- Instagram exige App ID do Facebook para Stories: https://www.adweek.com/media/instagram-adds-new-requirement-for-developers-using-sharing-to-stories/
- Competição × apoio (Penn, RCT com 800 pessoas): https://penntoday.upenn.edu/research/online-competition-not-online-social-support-motivates-people-to-exercise
- Fitspiration e imagem corporal (revisão sistemática): https://link.springer.com/article/10.1007/s40519-022-01505-4
- Redes sociais e imagem corporal de adolescentes (revisão): https://pmc.ncbi.nlm.nih.gov/articles/PMC11229793/
