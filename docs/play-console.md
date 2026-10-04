# Android: APK de teste e Google Play (teste interno)

Pedido do Daniel em 04/10: a Allinne precisa usar o programa de ombro no Android esta semana.

## Caminho 1, hoje: APK instalado direto (perfil `apk`)

- É o mesmo app do build interno: conjunto de lançamento, os 18 exercícios do ombro e o selo "Versão de teste".
- **Não precisa de nenhuma variável.** Sem Supabase, tudo fica no celular dela: o coach usa as respostas guiadas e o programa de ombro é grátis e sem limite (o limite do plano grátis só conta treinos normais).
- Com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no ambiente "preview" do EAS, os vídeos já enviados ao bucket também tocam.

No PowerShell, na pasta do projeto:

```powershell
git pull
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile apk --platform android
```

1. **`init`:** só na primeira vez. Ele grava o `projectId` no `app.json`; depois faça commit.
2. **Keystore:** o EAS pergunta "Generate a new Android Keystore?". Responda **Y**. O EAS guarda a chave; o mesmo app é usado depois na Play Store.
3. **No fim:** o EAS mostra um link e um QR code. Mande o link para ela.
4. **No Android dela:** abrir o link, baixar o `.apk`, permitir "Instalar apps desconhecidos" para o Chrome e abrir. Na primeira vez o Play Protect pode avisar que o app é desconhecido; toque em "Instalar mesmo assim".

## Como ela abre o programa de ombro

- **No primeiro passo do cadastro ("Para quem é?"):** ligar "Tenho ombro congelado ou dor no ombro". Ao terminar o cadastro, o app abre direto o programa.
- **Depois, a qualquer momento:**
  - aba **Biblioteca** → card "Ombro — reabilitação", primeiro da lista;
  - ou **Progresso** → "Reabilitação" → Ombro.
- **Na tela do programa:** "Começar programa", depois as regras de segurança e a pergunta "Qual ombro?" (direito, esquerdo ou os dois). Também pergunta se o fisioterapeuta liberou treino de ombro e braço.
- **Uso diário:**
  - o card "Ombro hoje" aparece na aba Treino;
  - o sleeper stretch tem 3 lembretes por dia (9h, 15h e 21h), que ela pode ligar;
  - os alongamentos têm contagem de 30 s, com o lado afetado indicado;
  - "Sinto dor" funciona em todo exercício.
- **Exercícios sem vídeo aprovado:** mostram o corpo com o músculo aceso e os passos em texto.

## Caminho 2: Google Play, teste interno (sem revisão do Google)

1. **Gerar o build:** `npx eas-cli@latest build --profile internal --platform android`. Gera um `.aab`. Sem as chaves, ele avisa mas gera.
2. **Primeira vez, envio à mão** (o Google exige):
   - baixe o `.aab` na página do build em expo.dev;
   - no Play Console: **Testar e lançar → Teste → Teste interno → Criar nova versão**;
   - envie o `.aab`, dê um nome (ex.: "0.1 teste ombro") e toque em Salvar → Revisar versão → Iniciar lançamento para teste interno.
3. **Testadores:**
   - na aba **Testadores**, crie a lista "Família" e adicione o Gmail da Allinne (o mesmo da Play Store no celular dela);
   - salve e copie o **link de participação**;
   - ela abre o link no Android, aceita e instala pela Play Store, em alguns minutos.
4. **Próximas versões:** `npx eas-cli@latest submit --profile internal --platform android --latest`. Precisa de uma chave de conta de serviço do Google (Play Console → Configuração → Acesso à API); o EAS pede na primeira vez.

O teste interno não passa pela revisão do Google.

Para a loja pública, contas pessoais novas precisam antes de um **teste fechado com pelo menos 12 testadores por 14 dias**.

## O que o Play Console vai pedir (Conteúdo do app) e as respostas

Base: `docs/store/privacy-labels.md`, que é o que o app coleta de verdade.

- **Política de privacidade:** `https://tapstrong-preview.vercel.app/legal/privacy` (ou `https://tapstrong.app/legal/privacy` quando o domínio estiver ligado).
- **Acesso ao app:** "Todo o recurso está disponível sem acesso especial". Não precisa de login.
- **Anúncios:** Não, o app não tem anúncios.
- **Classificação de conteúdo (questionário IARC):**
  - categoria: "Referência, notícias ou educacional"? Não; escolha **"Todos os outros tipos de app"**;
  - violência, sexo, linguagem, drogas e apostas: **Não**;
  - os usuários interagem ou trocam conteúdo? **Sim, limitado**: dá para compartilhar um card do treino por link. Não há chat;
  - compartilha a localização? **Não**;
  - compras digitais? **Sim** (assinatura).
  - Resultado esperado: classificação livre (Livre / Everyone).
- **Público-alvo:**
  - faixas **13–15, 16–17 e 18+** (não marque menores de 13; o cadastro abaixo de 13 está desligado);
  - "O app é atraente para crianças?": **Não**;
  - se o Google insistir por causa da faixa 13–15, pode deixar só **18+** no teste e voltar a incluir adolescentes antes da loja pública.
- **Segurança dos dados:**
  - **Coleta dados?** Sim. **Compartilha com terceiros?** Não (prestadores agindo em nosso nome não contam como compartilhamento).
  - **Criptografado em trânsito:** Sim.
  - **Exclusão:** o usuário pode pedir. No app: Ajustes → Excluir conta. Link: `https://tapstrong-preview.vercel.app/legal/support`.
  - **Tipos de dados coletados:**
    - Informações pessoais: e-mail (só se salvar o progresso), IDs do usuário, outras (mês/ano de nascimento);
    - Saúde e condicionamento físico: informações de saúde (áreas de dor, condições) e de condicionamento (treinos);
    - Informações financeiras: histórico de compras;
    - Atividade no app: interações, outro conteúdo gerado (texto do coach, processado e não guardado);
    - Informações e desempenho do app: registros de falhas.
  - **Para todos:** finalidade "Funcionalidade do app". Para as interações, também "Análise", de forma anônima.
  - **Não coleta:** localização, contatos, fotos (as fotos de antes e depois ficam no celular), arquivos nem ID de publicidade.
- **Apps de saúde (declaração):** "Atividade física e condicionamento". Não é dispositivo médico, não faz diagnóstico.
- **ID de publicidade:** não usa.
- **Apps de governo, financeiros, notícias, COVID:** Não.
