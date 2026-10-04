# Versão de teste interno (TestFlight e teste interno do Google Play)

Perfil EAS `internal` (Daniel, 03/10).

É um build de verdade (release), só para você e quem você convidar. Ele **não vai para a loja pública**.

O que ele traz:
- os 243 exercícios do conjunto de lançamento, mesmo em rascunho;
- os clipes enviados ao bucket `exercise-media`;
- a assinatura em sandbox (compras de teste, sem cobrança);
- o selo "Versão de teste" em Ajustes.

O perfil `production` continua travado: sem rascunhos e sem clipes de protótipo. Só entra exercício `released`. O `npm run bundle:check` confere os dois perfis em builds reais.

## 0. Contas (do seu lado)

- **Apple Developer Program:** US$ 99 por ano. Necessário para o TestFlight.
- **Google Play Console:** US$ 25, uma vez só.
- **Expo:** conta grátis em expo.dev.
- **No App Store Connect:** crie o app com o bundle ID `app.tapstrong`.
- **No Play Console:** crie o app com o pacote `app.tapstrong`.

## 1. Variáveis mínimas do `internal` (ambiente "preview" do EAS)

| Variável | Onde pegar |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → chave `anon` / publishable (pública; nunca a secret) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat → Project → API keys → chave pública do app iOS (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat → Project → API keys → chave pública do app Android (`goog_…`) |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → seu site → Site key |
| `EXPO_PUBLIC_TURNSTILE_BASE_URL` (recomendado) | `https://tapstrong-preview.vercel.app/` enquanto o domínio não existir. Coloque esse host na lista de domínios do site no Turnstile. |

Os links de Termos, Privacidade, suporte e convite **não são obrigatórios** no `internal`. Se você puser, eles já funcionam.

**Assinatura em sandbox:**
- **iPhone:** no TestFlight, a compra já é de teste, sem cobrança.
- **Android:** em Play Console → Configurações → Teste de licença, coloque os e-mails dos testadores.
- **Nos dois:** os produtos precisam existir no RevenueCat e nas lojas, mesmo em teste.

Para criar cada variável:

```
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://SEU-PROJETO.supabase.co" --visibility plaintext
```

Repita para as outras.

Para conferir no seu computador antes do build:

```
npm run env:check -- --internal
```

## 2. Banco e vídeos (antes do primeiro build)

1. **Bucket dos vídeos:** aplique as migrações com `npx supabase db push`. A nova cria o bucket `exercise-media`.
2. **Envie os clipes** pelo PowerShell (Windows), na pasta do projeto. A chave fica só nesta janela; o `Read-Host` não guarda no histórico.

```powershell
$env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
$s = Read-Host "Cole a Secret key (sb_secret_...)" -AsSecureString
$env:SUPABASE_SECRET_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
node scripts/upload-exercise-media.mjs --dry-run
node scripts/upload-exercise-media.mjs
Remove-Item Env:SUPABASE_SECRET_KEY
```

O script:
- envia os exercícios do conjunto de lançamento que já têm clipe nos dois sexos (hoje 124, 496 arquivos, cerca de 115 MB);
- atualiza `assets/media/uploaded.json`.

**Depois de cada lote novo do Flow:** importe os clipes, rode o upload de novo, faça commit do `uploaded.json` e gere outro build.

## 3. Build e instalação

```
npx eas-cli@latest login
npx eas-cli@latest init
```

O `init` grava o `projectId` no `app.json`. Faça commit dessa mudança.

```
npx eas-cli@latest build --profile internal --platform ios
npx eas-cli@latest build --profile internal --platform android
```

- No primeiro build iOS, o EAS pede o login da Apple e cria os certificados sozinho.
- Cada build leva de 15 a 30 min na nuvem.

**iPhone (TestFlight):**

```
npx eas-cli@latest submit --profile internal --platform ios --latest
```

1. No App Store Connect → TestFlight → Teste interno, crie um grupo e adicione você e a Allinne. Cada pessoa precisa ser usuária do App Store Connect (Usuários e acesso).
2. Instale o app "TestFlight" no iPhone e aceite o convite.
3. Cada build novo aparece lá.

**Android (teste interno):**

1. A primeira vez é manual, porque o Google exige. Baixe o `.aab` na página do build no expo.dev.
2. Em Play Console → Testes → Teste interno → Criar versão, envie o arquivo.
3. Em Testadores, crie uma lista com os e-mails.
4. Copie o link de participação e abra no Android de cada pessoa. O app instala pela Play Store.
5. Nas próximas vezes:

```
npx eas-cli@latest submit --profile internal --platform android --latest
```

Isso precisa de uma chave de conta de serviço do Google, que o EAS pede na primeira vez.

## 4. O que testar

- **Primeiro treino:** use perfis adulto, adolescente e 60+, em casa e na academia.
  - O vídeo é do sexo do perfil.
  - O aquecimento e o alongamento entram sempre.
  - "Sinto dor" funciona.
- **Exercícios sem clipe ainda:** mostram o corpo com os músculos e os passos. Isso é esperado até o Flow terminar.
- **Assinatura de teste:** comprar, restaurar e cancelar.
- **Ajustes:** o selo "Versão de teste" aparece.
