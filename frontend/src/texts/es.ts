/**
 * Every text of the interface, in Spanish (Q3 of feature 09), and nothing else: no screen writes a text of its own.
 * A second language would be another file with the same shape.
 *
 * The words for the terms of the glossary are fixed here, and a Listing is a "producto", not an "oferta", which in
 * Spanish suggests a discount.
 */

/** The terms of the glossary as the screens say them. */
export const vocabulary = {
  account: "cuenta",
  session: "sesión",
  signIn: "Entrar",
  register: "Crear cuenta",
  signOut: "Salir",
  catalogue: "catálogo",
  listing: "producto",
  retailer: "tienda",
  priceAlert: "alerta de precio",
  notification: "notificación",
  targetPrice: "precio objetivo",
  currentPrice: "precio actual",
  observedAt: "observado el",
} as const;

const v = vocabulary;

/** The words of the screens that are not a failure: titles, labels, buttons and what they say while they work. */
export const screens = {
  appName: "PricePulse",
  checkingSession: `Comprobando la ${v.session}…`,
  email: "Correo",
  password: "Contraseña",
  /** BR-14: a form with an empty field is not sent, and says which one. */
  emailMissing: "Escribe el correo.",
  passwordMissing: "Escribe la contraseña.",
  signIn: {
    title: v.signIn,
    submit: v.signIn,
    submitting: "Entrando…",
    toRegister: "¿No tienes cuenta? Crea una",
    /** SC-10: the Account exists and the sign-in that followed it did not work. */
    accountCreated: `Tu ${v.account} se ha creado, pero no se ha podido entrar. Entra con tu correo y contraseña.`,
  },
  register: {
    title: v.register,
    submit: v.register,
    submitting: "Creando…",
    toSignIn: "¿Ya tienes cuenta? Entra",
  },
  signOut: {
    submit: v.signOut,
    submitting: "Saliendo…",
  },
  loading: "Cargando…",
  retry: "Reintentar",
  catalogue: {
    title: "Catálogo",
    empty: "Todavía no hay productos.",
    pagesLabel: "Páginas del catálogo",
  },
  /** What every list that is read one page at a time says (SC-18, SC-07, SC-22). */
  paging: {
    /** Which ones of how many are shown. */
    range: (from: number, to: number, total: number) => `Mostrando ${from}–${to} de ${total}`,
    previous: "Anterior",
    next: "Siguiente",
  },
  nav: {
    label: "Navegación principal",
    catalogue: "Catálogo",
    alerts: "Mis alertas",
    notifications: "Mis notificaciones",
  },
  /** Feature 10: the Price Alerts of the person. */
  alerts: {
    title: "Mis alertas de precio",
    /** SC-05: the person has none, and the way to get one is the Catalogue. */
    empty: `No tienes ninguna ${v.priceAlert}.`,
    emptyFiltered: `No tienes ninguna ${v.priceAlert} con ese estado.`,
    toCatalogue: "Ir al catálogo",
    filterLabel: "Filtrar por estado",
    pagesLabel: "Páginas de alertas",
    /** SC-06: the filter has the three states of an alert and "all". */
    filters: { all: "Todas", active: "Activas", triggered: "Disparadas", cancelled: "Canceladas" },
    status: { active: "Activa", triggered: "Disparada", cancelled: "Cancelada" },
    targetPrice: (amount: string) => `Precio objetivo: ${amount}`,
    state: (status: string) => `Estado: ${status}`,
    createdAt: (when: string) => `Creada el ${when}`,
  },
  /** Feature 10: the Notifications of the person. */
  notifications: {
    title: "Mis notificaciones",
    /** BR-10: they are a record, and nothing is sent anywhere else. */
    note: `Una ${v.notification} es el registro de una ${v.priceAlert} que ha alcanzado su ${v.targetPrice}. Se guardan aquí y no se envían a ningún otro sitio.`,
    empty: "Todavía no tienes ninguna notificación.",
    pagesLabel: "Páginas de notificaciones",
    targetPrice: (amount: string) => `Precio objetivo: ${amount}`,
    currentPrice: (amount: string) => `Precio actual: ${amount}`,
    observedAt: (when: string) => `Observado el ${when}`,
  },
  /** What a Listing shows wherever it is shown. */
  listing: {
    retailer: (name: string) => `Tienda: ${name}`,
    /** SC-16: a Listing with no Current Price says so, and shows no amount. */
    noPrice: "Sin precio",
    observedAt: (when: string) => `${v.observedAt} ${when}`,
    backToCatalogue: "← Volver al catálogo",
    /** SC-22: the Listing does not exist, so the way out is the Catalogue. */
    toCatalogue: "Ir al catálogo",
  },
  /** The form to create a Price Alert on the screen of a Listing. */
  alertForm: {
    title: `Crear una ${v.priceAlert}`,
    amount: (currency: string) => `Precio objetivo (${currency})`,
    submit: `Crear ${v.priceAlert}`,
    submitting: "Creando…",
    /** BR-14: an empty target is not sent. */
    amountMissing: `Escribe el ${v.targetPrice}.`,
    /** SC-23: it was created now. */
    created: (amount: string) => `Alerta de precio creada: ${v.targetPrice} ${amount}.`,
    /** SC-24: it already existed, so it is not said to be new. */
    existed: (amount: string) => `Ya tenías esa ${v.priceAlert}: ${v.targetPrice} ${amount}.`,
  },
} as const;

// The messages that two actions of this feature give for the same answer are written once.
const alertNoLongerActive = `Esa ${v.priceAlert} ya no está activa.`;
const alertChanged = `La ${v.priceAlert} ha cambiado mientras tanto. Mírala de nuevo.`;
const alertNotFound = `Esa ${v.priceAlert} no existe.`;
const targetReached = `El ${v.currentPrice} ya alcanza ese ${v.targetPrice}.`;
const amountNotValid = "El importe no es válido. Los decimales se escriben con punto, como en 80.00.";

/** What the person is told when each action fails. Nothing of the cause is in any of them (BR-12). */
export const failures = {
  /** BR-06: the answer was that the Session is not valid. */
  sessionEnded: `Tu ${v.session} ha terminado. Entra de nuevo.`,

  signIn: {
    /** BR-03: the same for a wrong password and for an email that has no account. */
    invalid: "El correo o la contraseña no son válidos.",
    locked: (seconds: number | undefined) =>
      seconds === undefined
        ? "Demasiados intentos. Espera un poco e inténtalo de nuevo."
        : `Demasiados intentos. Espera ${seconds} ${seconds === 1 ? "segundo" : "segundos"} e inténtalo de nuevo.`,
    other: "No se ha podido entrar. Inténtalo de nuevo.",
  },

  register: {
    emailTaken: `Ese correo ya tiene una ${v.account}.`,
    /** BR-04: what the API says is wrong with the email or the password, one message for each reason. */
    emailInvalid: "El correo no es válido.",
    passwordTooShort: "La contraseña es demasiado corta.",
    passwordTooLong: "La contraseña es demasiado larga.",
    passwordIsEmail: "La contraseña no puede ser el correo.",
    other: `No se ha podido crear la ${v.account}. Inténtalo de nuevo.`,
  },

  /** BR-05: the sign-out was not confirmed, so the person is still signed in. */
  signOut: {
    other: `No se ha podido cerrar la ${v.session}. Sigues dentro: inténtalo de nuevo.`,
  },

  session: {
    other: `No se ha podido comprobar la ${v.session}. Inténtalo de nuevo.`,
  },

  readCatalogue: {
    other: `No se ha podido leer el ${v.catalogue}. Inténtalo de nuevo.`,
  },

  readListing: {
    notFound: `Ese ${v.listing} no existe.`,
    other: `No se ha podido leer el ${v.listing}. Inténtalo de nuevo.`,
  },

  /** BR-10: each answer of creating a Price Alert has its own message. */
  createAlert: {
    duplicate: `Ya tienes una ${v.priceAlert} activa para este ${v.listing} con otro ${v.targetPrice}.`,
    reached: targetReached,
    invalidAmount: amountNotValid,
    notFound: `Ese ${v.listing} no existe.`,
    other: `No se ha podido crear la ${v.priceAlert}. Inténtalo de nuevo.`,
  },

  readAlerts: {
    other: `No se han podido leer tus alertas de precio. Inténtalo de nuevo.`,
  },

  readNotifications: {
    other: "No se han podido leer tus notificaciones. Inténtalo de nuevo.",
  },

  /** BR-07: each answer of changing a Target Price has its own message. */
  changeTarget: {
    invalidAmount: amountNotValid,
    reached: targetReached,
    notActive: alertNoLongerActive,
    changed: alertChanged,
    notFound: alertNotFound,
    other: `No se ha podido cambiar el ${v.targetPrice}. Inténtalo de nuevo.`,
  },

  /** BR-07: and each answer of cancelling. */
  cancelAlert: {
    notActive: alertNoLongerActive,
    changed: alertChanged,
    notFound: alertNotFound,
    other: `No se ha podido cancelar la ${v.priceAlert}. Inténtalo de nuevo.`,
  },
} as const;
