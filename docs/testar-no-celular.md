# Como testar o TapStrong no celular

Os vídeos de demonstração só entram na versão de **teste** (desenvolvimento), nunca na versão de loja (SPEC §6). Por isso a versão "prévia" comum do EAS **não mostra vídeos**: ela é igual à de loja.

## 1. Link web (o mais rápido, funciona no iPhone e no Android)

- Endereço: **https://tapstrong-preview-daniels-projects-386afd6c.vercel.app**
- Ele pede login na Vercel, com a mesma conta de sempre. O link é protegido para que só você veja o protótipo.
- É a versão de teste, com os vídeos, montada a partir do GitHub. Cada vez que algo novo entra na branch `claude/sweet-ride-3drey3`, a Vercel monta de novo sozinha, em uns 5 minutos.
- Para parecer um app: no Safari, toque em Compartilhar → "Adicionar à Tela de Início". No Chrome, toque nos três pontos → "Adicionar à tela inicial".

O que **não** dá para testar pela web:

- **Adolescente e família:** no navegador, esses perfis ficam bloqueados de propósito (Fase 24). Teste-os no app (passo 2).
- **Conta, sincronização e convite:** a prévia não liga no Supabase, para não criar usuários de mentira no banco de verdade. Os dados ficam só no navegador.
- **Vibração, Stories do Instagram e "salvar na galeria":** só no app. Na web, compartilhar manda um texto.

## 2. Android: app de teste com os vídeos

O app de teste é instalado por um link e mostra os vídeos. Ele carrega o código do seu computador pela rede Wi-Fi, então o computador precisa ficar ligado com o projeto aberto enquanto você testa.

**Uma vez só (cerca de 20 minutos, quase tudo é espera):**

1. Crie uma conta grátis em **expo.dev** (se ainda não tiver).
2. No computador, abra o terminal na pasta do projeto e rode:
   - `npx eas-cli@latest login` (entre com a conta do Expo);
   - `npx eas-cli@latest build --profile development --platform android`.
3. Quando terminar, o terminal mostra um link e um QR code. Abra no celular Android e instale o APK. O Android pede para "permitir instalar de fontes desconhecidas": aceite.

**Cada vez que for testar:**

1. Computador e celular na mesma rede Wi-Fi.
2. No terminal, na pasta do projeto: `npx expo start`.
3. Abra o app "TapStrong" no celular e escolha o seu computador na lista (ou leia o QR code que aparece no terminal).

Se a rede não deixar o celular achar o computador, use `npx expo start --tunnel`.

## 3. iPhone

- **Expo Go não serve:** o app usa partes nativas que o Expo Go não tem (assinaturas, compartilhar no Instagram).
- **App de teste no iPhone** (igual ao do Android): precisa de conta **Apple Developer** (US$ 99 por ano, serviço pago, decisão sua). Com a conta:
  - `npx eas-cli@latest device:create` (cadastra o seu iPhone);
  - depois `npx eas-cli@latest build --profile development --platform ios`.
- **TestFlight:** também precisa da conta Apple, e é a versão de loja, ou seja, **sem vídeos**.
- **Enquanto isso:** use o link web do passo 1 no Safari, que mostra os vídeos.

## Roteiro de 10 minutos

1. **Mulher adulta:** crie o perfil como mulher, 30–40 anos. Na Home, toque em "Treinar agora".
2. **Vídeo e pôster:** no primeiro exercício, veja a imagem parada (pôster) e depois o vídeo. Os dois devem ser de mulher. Onde o vídeo ainda não existe, aparece "demo em breve".
3. **Mapa do corpo:** na aba Corpo, toque num músculo (por exemplo, glúteos) e veja ele marcado.
4. **Terminar o treino:** registre umas séries, vá até o fim e confira o mapa acendendo músculo por músculo na tela final.
5. **Homem:** abra o link numa janela anônima (na web) ou apague os dados do app (no app de teste) e crie um perfil de homem. Repita os passos 1 e 2. Os vídeos devem ser de homem, exceto `wall_push_up`, `standing_supported_bird_dog`, `low_step_up` e `rx_low_step_up`, que usam o do homem para os dois sexos (decisão de 01/10).
6. **60+:** crie um perfil com 65 anos. Confira letras maiores, o botão grande "Começar" e os vídeos.
7. **Adolescente (só no app, passo 2):** crie um perfil de 15 anos. Confira que não aparece botão de compartilhar sem a permissão do responsável.

Anote o que estranhar (tela, exercício e o que esperava) e me mande.
