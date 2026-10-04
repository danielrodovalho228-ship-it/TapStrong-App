// Builds the public Terms of Use, Privacy Policy and Support pages (Phase 32)
// in English, Spanish and Portuguese (BR) into public/legal/, which the web
// export copies to the site root: <site>/legal/terms, /legal/privacy,
// /legal/support. Static HTML, no script (the site's CSP allows none inline).
//
//   node scripts/build-legal.mjs           # write the pages
//   node scripts/build-legal.mjs --check   # fail while a [[ ]] blank is left
//
// Facts come from docs/store/privacy-labels.md (re-check both before each
// release). A lawyer should review the text before launch (SPEC §13).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Fill these in (then run the script again) -------------------------------
const OWNER = {
  /** The person or company that runs TapStrong, as on the store listings. */
  entity: 'Daniel Rodovalho',
  /** Daniel, Oct 3: Texas law until the lawyer's review (the LLC replaces the name later). */
  law: {
    en: 'the State of Texas, USA',
    es: 'del Estado de Texas (EE. UU.)',
    'pt-BR': 'do Estado do Texas (EUA)',
  },
  email: 'support@tapstrong.app',
  updated: '2026-10-03',
};
// ----------------------------------------------------------------------------

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public/legal');
const LANGS = [
  ['en', 'English'],
  ['es', 'Español'],
  ['pt-BR', 'Português'],
];
const mail = `<a href="mailto:${OWNER.email}">${OWNER.email}</a>`;

const T = {
  en: {
    updated: 'Last updated',
    draft: 'Draft: legal review pending.',
    nav: { terms: 'Terms of Use', privacy: 'Privacy Policy', support: 'Support' },
    terms: [
      [
        'Agreement',
        `These Terms of Use are an agreement between you and ${OWNER.entity} ("TapStrong", "we"). By using the TapStrong app you agree to them. If you do not agree, do not use the app.`,
      ],
      [
        'Not medical advice',
        'TapStrong adapts workouts to the answers you give. It does not diagnose, treat or replace a doctor, physical therapist or coach. Talk to a health professional before you start, especially if you have a heart condition, are pregnant or postpartum, had recent surgery, or have pain. Stop any exercise that hurts and use "I feel pain" in the app. You train at your own risk.',
      ],
      [
        'Who can use it',
        'You must be at least 13. If you are under 18, a parent or guardian must agree to these Terms for you. A parent or guardian who adds a family profile is responsible for that profile.',
      ],
      [
        'Your account',
        'You can use the app without an account. If you save your progress, keep your email account secure; you are responsible for what happens in your account.',
      ],
      [
        'Subscriptions',
        "Some features need a paid subscription, bought through the App Store or Google Play. Price and period are shown before you buy. Subscriptions renew automatically unless you cancel at least 24 hours before the period ends, in your App Store or Google Play account settings. A free trial, if offered, turns into a paid subscription unless cancelled before it ends. Refunds follow the store's rules. Deleting the app does not cancel a subscription.",
      ],
      [
        'The AI coach',
        'The coach uses an AI model to understand your answers. It only chooses from exercises our reviewers released; it can still misunderstand. Do not share information you do not want processed.',
      ],
      [
        'Fair use',
        'Do not misuse the app: no reverse engineering, scraping, automated access, attempts to break security or limits, or use that breaks the law or harms others.',
      ],
      [
        'Our content',
        'The app, its exercises, videos, images and text belong to TapStrong or its licensors. We give you a personal, non-transferable licence to use the app on your devices. Content you create (like custom exercises) stays yours; you let us store and process it to run the app.',
      ],
      [
        'Apple and Google',
        "If you got the app from the App Store, Apple's standard Licensed Application End User License Agreement also applies where these Terms are silent; Apple is not responsible for the app or its support. The same goes for Google Play.",
      ],
      [
        'Ending',
        'You can stop using the app and delete your account at any time (Settings → Delete account). We may suspend accounts that break these Terms.',
      ],
      [
        'Warranty and liability',
        'The app is provided "as is". To the extent the law allows, we do not promise it will be error free and we are not liable for indirect or consequential damages, or for injuries from exercise done against the app\'s safety guidance. Nothing here limits rights you have under consumer law.',
      ],
      [
        'Law',
        `These Terms are governed by the laws of ${OWNER.law.en}, except where your local consumer law says otherwise.`,
      ],
      [
        'Changes',
        'We may update these Terms. We will show the new date here and, for important changes, tell you in the app.',
      ],
      ['Contact', `Questions: ${mail}.`],
    ],
    privacy: [
      [
        'Summary',
        'We collect what the app needs to build safe workouts, never sell your data, show no ads and do no tracking across apps. Before and after photos never leave your phone. You can delete everything in the app.',
      ],
      ['Who we are', `TapStrong is run by ${OWNER.entity}. Contact: ${mail}.`],
      [
        'What we collect',
        '<ul><li><b>Profile:</b> birth month and year (never the full date), sex or a neutral body, and, optionally, height and weight (never for under-13).</li><li><b>Health and safety answers:</b> pain areas, conditions and training position, used only to keep workouts safe.</li><li><b>Fitness:</b> workouts, sets, swaps, pain reports, streaks, check-ins (body measurements for adults only), Repair results.</li><li><b>Email and account ID</b>, only if you save your progress.</li><li><b>Purchases:</b> subscription status from the App Store or Google Play (card details stay with the store).</li><li><b>Coach text:</b> what you type to the coach is processed to understand it and is not stored.</li><li><b>Anonymous usage and crash data</b>, without names, emails or health data, and never from a child profile.</li></ul>We do not collect location, contacts, advertising ID or uploaded photos. Reminders are scheduled on your phone.',
      ],
      [
        'Health data',
        "Your health and fitness answers are consumer health data. We use them only to run the app for you, never for ads, never sold and never shared for anyone else's purposes. You give them in the health check, and you can change or delete them at any time.",
      ],
      [
        'Who processes it for us',
        'Service providers process data only on our behalf: Supabase (database and sign-in), RevenueCat (subscriptions), Anthropic (the AI coach, text not stored), Resend (sign-in emails), Cloudflare Turnstile (bot check), PostHog (anonymous analytics) and Sentry (crash reports), plus Apple and Google for purchases. Data may be processed in the United States.',
      ],
      [
        'Children and teens',
        'The app is for ages 13 and up. Teens get stricter safety rules and no body measurements or weight targets. A parent or guardian manages family profiles, protected by a parent PIN. We do not knowingly collect data from children under 13; if you think we did, write to us and we will delete it.',
      ],
      [
        'How long we keep it',
        'Until you delete it or your account. Deleting your account (Settings → Delete account) erases your data from our database; backup copies roll off within 30 days. Anonymous analytics cannot be linked back to you.',
      ],
      [
        'Your rights',
        'You can see, correct or delete your data and withdraw consent in the app, and ask us for a copy by writing to us. Depending on where you live (for example California, Washington or the European Union) you may have more rights, such as knowing what we collect and opting out of sale (we do not sell data). We will not treat you differently for using your rights.',
      ],
      [
        'Security',
        'Data is encrypted in transit, access is limited by row-level rules in the database, and keys never ship inside the app.',
      ],
      [
        'Changes',
        'We will post updates here with a new date and tell you in the app about important changes.',
      ],
      ['Contact', `Privacy questions or requests: ${mail}.`],
    ],
    support: [
      ['Contact us', `Email ${mail}. We answer within 2 business days.`],
      [
        'Cancel a subscription',
        'iPhone: Settings → your name → Subscriptions → TapStrong. Android: Google Play → Payments & subscriptions → Subscriptions → TapStrong. Deleting the app does not cancel it.',
      ],
      [
        'Restore a purchase',
        'In the app: Settings → tap your plan → Restore purchases, signed in to the same App Store or Google Play account.',
      ],
      [
        'Delete your account and data',
        'In the app: Settings → Delete account. It erases your profile, workouts and health answers.',
      ],
      ['Forgot the parent PIN', 'On the PIN screen, tap "Forgot the PIN?" to get a code by email.'],
      [
        'Pain during a workout',
        'Tap "I feel pain". Sharp pain ends today\'s workout; dull pain swaps the exercise. If pain continues, see a health professional. In an emergency, call your local emergency number.',
      ],
    ],
  },
  es: {
    updated: 'Última actualización',
    draft: 'Borrador: revisión legal pendiente.',
    nav: { terms: 'Términos de uso', privacy: 'Política de privacidad', support: 'Soporte' },
    terms: [
      [
        'Acuerdo',
        `Estos Términos de uso son un acuerdo entre tú y ${OWNER.entity} ("TapStrong", "nosotros"). Al usar la app TapStrong los aceptas. Si no estás de acuerdo, no uses la app.`,
      ],
      [
        'No es consejo médico',
        'TapStrong adapta los entrenamientos a tus respuestas. No diagnostica, no trata y no reemplaza a un médico, fisioterapeuta o entrenador. Habla con un profesional de la salud antes de empezar, sobre todo si tienes una afección cardíaca, estás embarazada o en posparto, tuviste una cirugía reciente o tienes dolor. Detén cualquier ejercicio que duela y usa "Siento dolor" en la app. Entrenas bajo tu propio riesgo.',
      ],
      [
        'Quién puede usarla',
        'Debes tener al menos 13 años. Si tienes menos de 18, tu padre, madre o tutor debe aceptar estos Términos por ti. Quien agrega un perfil familiar es responsable de ese perfil.',
      ],
      [
        'Tu cuenta',
        'Puedes usar la app sin cuenta. Si guardas tu progreso, mantén segura tu cuenta de correo; eres responsable de lo que pase en tu cuenta.',
      ],
      [
        'Suscripciones',
        'Algunas funciones requieren una suscripción de pago, comprada en App Store o Google Play. El precio y el período se muestran antes de comprar. La suscripción se renueva automáticamente salvo que la canceles al menos 24 horas antes del fin del período, en la configuración de tu cuenta de App Store o Google Play. Una prueba gratuita, si se ofrece, pasa a ser de pago si no la cancelas antes de que termine. Los reembolsos siguen las reglas de la tienda. Borrar la app no cancela la suscripción.',
      ],
      [
        'El coach con IA',
        'El coach usa un modelo de IA para entender tus respuestas. Solo elige entre ejercicios aprobados por nuestros revisores, pero puede equivocarse. No compartas información que no quieras que se procese.',
      ],
      [
        'Uso justo',
        'No hagas mal uso de la app: nada de ingeniería inversa, extracción de datos, acceso automatizado, intentos de romper la seguridad o los límites, ni usos ilegales o que dañen a otros.',
      ],
      [
        'Nuestro contenido',
        'La app, sus ejercicios, videos, imágenes y textos pertenecen a TapStrong o a sus licenciantes. Te damos una licencia personal e intransferible para usar la app en tus dispositivos. Lo que creas (como ejercicios propios) sigue siendo tuyo; nos permites guardarlo y procesarlo para que la app funcione.',
      ],
      [
        'Apple y Google',
        'Si descargaste la app de App Store, el Acuerdo de Licencia de Usuario Final estándar de Apple también se aplica donde estos Términos no digan nada; Apple no es responsable de la app ni de su soporte. Lo mismo vale para Google Play.',
      ],
      [
        'Fin',
        'Puedes dejar de usar la app y borrar tu cuenta cuando quieras (Ajustes → Eliminar cuenta). Podemos suspender cuentas que incumplan estos Términos.',
      ],
      [
        'Garantía y responsabilidad',
        'La app se ofrece "tal cual". En la medida que la ley lo permita, no garantizamos que esté libre de errores y no respondemos por daños indirectos o consecuentes, ni por lesiones de ejercicios hechos en contra de las indicaciones de seguridad de la app. Nada aquí limita tus derechos como consumidor.',
      ],
      [
        'Ley',
        `Estos Términos se rigen por las leyes ${OWNER.law.es}, salvo que tu ley de consumo local disponga otra cosa.`,
      ],
      [
        'Cambios',
        'Podemos actualizar estos Términos. Mostraremos la nueva fecha aquí y, si el cambio es importante, te avisaremos en la app.',
      ],
      ['Contacto', `Preguntas: ${mail}.`],
    ],
    privacy: [
      [
        'Resumen',
        'Recogemos lo que la app necesita para crear entrenamientos seguros, nunca vendemos tus datos, no mostramos anuncios ni te rastreamos entre apps. Las fotos de antes y después nunca salen de tu teléfono. Puedes borrarlo todo en la app.',
      ],
      ['Quiénes somos', `TapStrong es operado por ${OWNER.entity}. Contacto: ${mail}.`],
      [
        'Qué recogemos',
        '<ul><li><b>Perfil:</b> mes y año de nacimiento (nunca la fecha completa), sexo o un cuerpo neutro y, si quieres, altura y peso (nunca en menores de 13).</li><li><b>Respuestas de salud y seguridad:</b> zonas de dolor, condiciones y posición de entrenamiento, usadas solo para que los entrenamientos sean seguros.</li><li><b>Actividad:</b> entrenamientos, series, cambios, reportes de dolor, rachas, controles (medidas corporales solo en adultos), resultados de Repair.</li><li><b>Correo e ID de cuenta</b>, solo si guardas tu progreso.</li><li><b>Compras:</b> el estado de la suscripción de App Store o Google Play (los datos de la tarjeta quedan en la tienda).</li><li><b>Texto del coach:</b> lo que escribes al coach se procesa para entenderlo y no se guarda.</li><li><b>Datos anónimos de uso y de fallos</b>, sin nombres, correos ni datos de salud, y nunca de un perfil infantil.</li></ul>No recogemos ubicación, contactos, ID de publicidad ni fotos subidas. Los recordatorios se programan en tu teléfono.',
      ],
      [
        'Datos de salud',
        'Tus respuestas de salud y actividad son datos de salud del consumidor. Solo las usamos para que la app funcione para ti; nunca para anuncios, nunca se venden ni se comparten para fines de otros. Las das en el control de salud y puedes cambiarlas o borrarlas cuando quieras.',
      ],
      [
        'Quién los procesa por nosotros',
        'Proveedores que procesan datos solo en nuestro nombre: Supabase (base de datos e inicio de sesión), RevenueCat (suscripciones), Anthropic (el coach con IA, el texto no se guarda), Resend (correos de inicio de sesión), Cloudflare Turnstile (verificación anti-bots), PostHog (analítica anónima) y Sentry (informes de fallos), además de Apple y Google para las compras. Los datos pueden procesarse en Estados Unidos.',
      ],
      [
        'Niños y adolescentes',
        'La app es para mayores de 13 años. Los adolescentes tienen reglas de seguridad más estrictas y no ven medidas corporales ni metas de peso. Un padre, madre o tutor gestiona los perfiles familiares, protegidos con un PIN. No recogemos a sabiendas datos de menores de 13; si crees que lo hicimos, escríbenos y los borraremos.',
      ],
      [
        'Cuánto tiempo los guardamos',
        'Hasta que los borres a ellos o a tu cuenta. Borrar la cuenta (Ajustes → Eliminar cuenta) elimina tus datos de nuestra base; las copias de seguridad se eliminan en 30 días. La analítica anónima no puede vincularse contigo.',
      ],
      [
        'Tus derechos',
        'Puedes ver, corregir o borrar tus datos y retirar tu consentimiento en la app, y pedirnos una copia escribiéndonos. Según dónde vivas (por ejemplo California, Washington o la Unión Europea) puedes tener más derechos, como saber qué recogemos u oponerte a la venta (no vendemos datos). No te trataremos distinto por ejercer tus derechos.',
      ],
      [
        'Seguridad',
        'Los datos viajan cifrados, el acceso está limitado por reglas de fila en la base de datos y las claves nunca van dentro de la app.',
      ],
      [
        'Cambios',
        'Publicaremos los cambios aquí con una nueva fecha y te avisaremos en la app si son importantes.',
      ],
      ['Contacto', `Preguntas o solicitudes de privacidad: ${mail}.`],
    ],
    support: [
      ['Contáctanos', `Escribe a ${mail}. Respondemos en 2 días hábiles.`],
      [
        'Cancelar la suscripción',
        'iPhone: Ajustes → tu nombre → Suscripciones → TapStrong. Android: Google Play → Pagos y suscripciones → Suscripciones → TapStrong. Borrar la app no la cancela.',
      ],
      [
        'Restaurar una compra',
        'En la app: Ajustes → toca tu plan → Restaurar compras, con la misma cuenta de App Store o Google Play.',
      ],
      [
        'Borrar tu cuenta y tus datos',
        'En la app: Ajustes → Eliminar cuenta. Elimina tu perfil, entrenamientos y respuestas de salud.',
      ],
      [
        'Olvidé el PIN de padres',
        'En la pantalla del PIN, toca "¿Olvidaste el PIN?" para recibir un código por correo.',
      ],
      [
        'Dolor durante el entrenamiento',
        'Toca "Siento dolor". El dolor agudo termina el entrenamiento de hoy; el dolor sordo cambia el ejercicio. Si el dolor sigue, consulta a un profesional de la salud. En una emergencia, llama al número de emergencias local.',
      ],
    ],
  },
  'pt-BR': {
    updated: 'Atualizado em',
    draft: 'Rascunho: revisão jurídica pendente.',
    nav: { terms: 'Termos de uso', privacy: 'Política de privacidade', support: 'Suporte' },
    terms: [
      [
        'Acordo',
        `Estes Termos de uso são um acordo entre você e ${OWNER.entity} ("TapStrong", "nós"). Ao usar o app TapStrong, você concorda com eles. Se não concordar, não use o app.`,
      ],
      [
        'Não é orientação médica',
        'O TapStrong adapta os treinos às suas respostas. Ele não diagnostica, não trata e não substitui médico, fisioterapeuta ou treinador. Fale com um profissional de saúde antes de começar, principalmente se você tem problema cardíaco, está grávida ou no pós-parto, fez cirurgia recente ou sente dor. Pare qualquer exercício que doa e use "Sinto dor" no app. Você treina por sua conta e risco.',
      ],
      [
        'Quem pode usar',
        'Você precisa ter pelo menos 13 anos. Se tiver menos de 18, seu pai, mãe ou responsável deve aceitar estes Termos por você. Quem adiciona um perfil da família é responsável por esse perfil.',
      ],
      [
        'Sua conta',
        'Você pode usar o app sem conta. Se salvar seu progresso, mantenha seu e-mail seguro; você é responsável pelo que acontece na sua conta.',
      ],
      [
        'Assinaturas',
        'Alguns recursos exigem assinatura paga, comprada pela App Store ou pelo Google Play. O preço e o período aparecem antes da compra. A assinatura renova sozinha, a menos que você cancele pelo menos 24 horas antes do fim do período, nas configurações da sua conta da App Store ou do Google Play. Um teste grátis, se houver, vira assinatura paga se não for cancelado antes de acabar. Reembolsos seguem as regras da loja. Apagar o app não cancela a assinatura.',
      ],
      [
        'O coach com IA',
        'O coach usa um modelo de IA para entender suas respostas. Ele só escolhe entre exercícios liberados pelos nossos revisores, mas pode entender errado. Não compartilhe informações que você não quer que sejam processadas.',
      ],
      [
        'Uso correto',
        'Não use o app de forma indevida: nada de engenharia reversa, coleta automática de dados, acesso automatizado, tentativas de quebrar a segurança ou os limites, nem uso ilegal ou que prejudique outras pessoas.',
      ],
      [
        'Nosso conteúdo',
        'O app, seus exercícios, vídeos, imagens e textos pertencem ao TapStrong ou a quem os licencia. Damos a você uma licença pessoal e intransferível para usar o app nos seus aparelhos. O que você cria (como exercícios próprios) continua seu; você nos permite guardar e processar isso para o app funcionar.',
      ],
      [
        'Apple e Google',
        'Se você baixou o app pela App Store, o Contrato de Licença de Usuário Final padrão da Apple também vale onde estes Termos forem omissos; a Apple não é responsável pelo app nem pelo suporte. O mesmo vale para o Google Play.',
      ],
      [
        'Encerramento',
        'Você pode parar de usar o app e apagar sua conta quando quiser (Configurações → Excluir conta). Podemos suspender contas que descumprirem estes Termos.',
      ],
      [
        'Garantia e responsabilidade',
        'O app é oferecido "no estado em que se encontra". Na medida em que a lei permitir, não garantimos que ele seja livre de erros e não respondemos por danos indiretos ou consequentes, nem por lesões de exercícios feitos contra as orientações de segurança do app. Nada aqui limita seus direitos de consumidor.',
      ],
      [
        'Lei',
        `Estes Termos são regidos pelas leis ${OWNER.law['pt-BR']}, exceto quando a lei de defesa do consumidor do seu país disser outra coisa.`,
      ],
      [
        'Mudanças',
        'Podemos atualizar estes Termos. A nova data aparece aqui e, se a mudança for importante, avisamos no app.',
      ],
      ['Contato', `Dúvidas: ${mail}.`],
    ],
    privacy: [
      [
        'Resumo',
        'Coletamos o que o app precisa para montar treinos seguros, nunca vendemos seus dados, não mostramos anúncios e não rastreamos você entre apps. As fotos de antes e depois nunca saem do seu celular. Você pode apagar tudo no app.',
      ],
      ['Quem somos', `O TapStrong é operado por ${OWNER.entity}. Contato: ${mail}.`],
      [
        'O que coletamos',
        '<ul><li><b>Perfil:</b> mês e ano de nascimento (nunca a data completa), sexo ou corpo neutro e, se quiser, altura e peso (nunca para menores de 13).</li><li><b>Respostas de saúde e segurança:</b> áreas de dor, condições e posição de treino, usadas só para deixar os treinos seguros.</li><li><b>Treino:</b> treinos, séries, trocas, relatos de dor, sequências, check-ins (medidas do corpo só para adultos), resultados do Repair.</li><li><b>E-mail e ID da conta</b>, só se você salvar seu progresso.</li><li><b>Compras:</b> a situação da assinatura na App Store ou no Google Play (os dados do cartão ficam com a loja).</li><li><b>Texto do coach:</b> o que você escreve para o coach é processado para ser entendido e não é guardado.</li><li><b>Dados anônimos de uso e de falhas</b>, sem nomes, e-mails ou dados de saúde, e nunca de um perfil infantil.</li></ul>Não coletamos localização, contatos, ID de publicidade nem fotos enviadas. Os lembretes são agendados no seu celular.',
      ],
      [
        'Dados de saúde',
        'Suas respostas de saúde e de treino são dados de saúde do consumidor. Só as usamos para o app funcionar para você; nunca para anúncios, nunca são vendidas nem compartilhadas para fins de terceiros. Você as informa na avaliação de saúde e pode mudar ou apagar a qualquer momento.',
      ],
      [
        'Quem processa por nós',
        'Prestadores que processam dados só em nosso nome: Supabase (banco de dados e login), RevenueCat (assinaturas), Anthropic (o coach com IA, o texto não é guardado), Resend (e-mails de login), Cloudflare Turnstile (verificação contra robôs), PostHog (análise anônima) e Sentry (relatórios de falhas), além de Apple e Google nas compras. Os dados podem ser processados nos Estados Unidos.',
      ],
      [
        'Crianças e adolescentes',
        'O app é para maiores de 13 anos. Adolescentes têm regras de segurança mais rígidas e não veem medidas do corpo nem metas de peso. Um pai, mãe ou responsável gerencia os perfis da família, protegidos por um PIN. Não coletamos, de propósito, dados de menores de 13; se achar que isso aconteceu, escreva para nós e apagaremos.',
      ],
      [
        'Por quanto tempo guardamos',
        'Até você apagar os dados ou a conta. Excluir a conta (Configurações → Excluir conta) apaga seus dados do nosso banco; os backups são limpos em até 30 dias. A análise anônima não pode ser ligada a você.',
      ],
      [
        'Seus direitos',
        'Você pode ver, corrigir ou apagar seus dados e retirar seu consentimento no app, e pedir uma cópia escrevendo para nós. Dependendo de onde mora (por exemplo, Califórnia, Washington, União Europeia ou Brasil, pela LGPD), você pode ter mais direitos, como saber o que coletamos ou se opor à venda (não vendemos dados). Ninguém é tratado de forma diferente por exercer seus direitos.',
      ],
      [
        'Segurança',
        'Os dados trafegam criptografados, o acesso é limitado por regras de linha no banco de dados e as chaves nunca vão dentro do app.',
      ],
      [
        'Mudanças',
        'Publicamos as mudanças aqui com uma nova data e avisamos no app quando forem importantes.',
      ],
      ['Contato', `Dúvidas ou pedidos de privacidade: ${mail}.`],
    ],
    support: [
      ['Fale com a gente', `Escreva para ${mail}. Respondemos em até 2 dias úteis.`],
      [
        'Cancelar a assinatura',
        'iPhone: Ajustes → seu nome → Assinaturas → TapStrong. Android: Google Play → Pagamentos e assinaturas → Assinaturas → TapStrong. Apagar o app não cancela.',
      ],
      [
        'Restaurar uma compra',
        'No app: Configurações → toque no seu plano → Restaurar compras, com a mesma conta da App Store ou do Google Play.',
      ],
      [
        'Apagar sua conta e seus dados',
        'No app: Configurações → Excluir conta. Apaga seu perfil, treinos e respostas de saúde.',
      ],
      [
        'Esqueci o PIN dos pais',
        'Na tela do PIN, toque em "Esqueceu o PIN?" para receber um código por e-mail.',
      ],
      [
        'Dor durante o treino',
        'Toque em "Sinto dor". Dor aguda encerra o treino de hoje; dor incômoda troca o exercício. Se a dor continuar, procure um profissional de saúde. Em emergência, ligue para o número de emergência local.',
      ],
    ],
  },
};

const esc = (s) => s.replace(/&(?!\w+;)/g, '&amp;');
const page = (kind) => {
  const sections = LANGS.map(([code, label]) => {
    const t = T[code];
    const body = t[kind]
      .map(([h, p]) => `<h3>${esc(h)}</h3>${p.startsWith('<') ? p : `<p>${p}</p>`}`)
      .join('\n');
    return `<section id="${code}" lang="${code}"><h2>${t.nav[kind]} <small>(${label})</small></h2><p class="meta">${t.updated}: ${OWNER.updated} · ${t.draft}</p>\n${body}</section>`;
  }).join('\n');
  const title = T.en.nav[kind];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · TapStrong</title>
<meta name="description" content="TapStrong ${title}">
<style>
:root { --bg: #f7f3ee; --fg: #1d1a17; --muted: #5d5650; --line: #e3dbd2; --accent: #c2410c; }
@media (prefers-color-scheme: dark) { :root { --bg: #121417; --fg: #f2efea; --muted: #b5aea6; --line: #2a2e33; --accent: #ff8a65; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
header strong { font-size: 20px; letter-spacing: .5px; }
nav a, .langs a { color: var(--accent); margin-right: 12px; }
.langs { margin: 16px 0 8px; }
h2 { margin-top: 40px; font-size: 26px; } h2 small { color: var(--muted); font-size: 15px; font-weight: 400; }
h3 { margin: 24px 0 4px; font-size: 18px; }
.meta { color: var(--muted); font-size: 14px; margin-top: 0; }
a { color: var(--accent); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
section + section { border-top: 1px solid var(--line); margin-top: 48px; }
</style>
</head>
<body>
<main>
<header><strong>TapStrong</strong><nav><a href="terms">${T.en.nav.terms}</a><a href="privacy">${T.en.nav.privacy}</a><a href="support">${T.en.nav.support}</a></nav></header>
<p class="langs">${LANGS.map(([c, l]) => `<a href="#${c}">${l}</a>`).join('')}</p>
${sections}
<footer>${LANGS.map(([c]) => T[c].draft).join(' · ')}</footer>
</main>
</body>
</html>
`;
};

const blanks = ['terms', 'privacy', 'support'].flatMap((k) => (page(k).includes('[[') ? [k] : []));
if (process.argv.includes('--check')) {
  if (blanks.length) {
    console.error(
      `Fill in OWNER in scripts/build-legal.mjs (blank left in: ${blanks.join(', ')}).`,
    );
    process.exit(1);
  }
  console.log('legal pages: no blanks left');
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
for (const k of ['terms', 'privacy', 'support']) writeFileSync(join(OUT, `${k}.html`), page(k));
console.log(
  `wrote public/legal/{terms,privacy,support}.html` +
    (blanks.length ? ` — fill in OWNER first (blanks in: ${blanks.join(', ')})` : ''),
);
