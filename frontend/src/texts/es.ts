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
  catalogue: {
    title: "Catálogo",
  },
} as const;

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
    reached: `El ${v.currentPrice} ya alcanza ese ${v.targetPrice}.`,
    invalidAmount: "El importe no es válido. Los decimales se escriben con punto, como en 80.00.",
    notFound: `Ese ${v.listing} no existe.`,
    other: `No se ha podido crear la ${v.priceAlert}. Inténtalo de nuevo.`,
  },
} as const;
