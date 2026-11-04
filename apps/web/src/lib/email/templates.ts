import type { EmailLocale } from "./locale.ts";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const resetPasswordLinkCopy: Record<
  EmailLocale,
  { subject: string; intro: string; action: string; ignore: string }
> = {
  en: {
    subject: "Reset your OfferKit password",
    intro: "We received a request to reset the password for your OfferKit account.",
    action: "Open this link to choose a new password:",
    ignore: "If you didn't ask for this, you can ignore this email.",
  },
  it: {
    subject: "Reimposta la password di OfferKit",
    intro: "Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account OfferKit.",
    action: "Apri questo link per scegliere una nuova password:",
    ignore: "Se non l'hai richiesto tu, puoi ignorare questa email.",
  },
  nl: {
    subject: "Stel je OfferKit-wachtwoord opnieuw in",
    intro: "We hebben een verzoek ontvangen om het wachtwoord van je OfferKit-account opnieuw in te stellen.",
    action: "Open deze link om een nieuw wachtwoord te kiezen:",
    ignore: "Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
  },
};

/** Self-service reset link sent by Better Auth's `sendResetPassword`. */
export function resetPasswordLinkEmail(
  vars: { url: string },
  locale: EmailLocale,
): RenderedEmail {
  const copy = resetPasswordLinkCopy[locale];
  const url = escapeHtml(vars.url);
  return {
    subject: copy.subject,
    html: [
      `<p>${escapeHtml(copy.intro)}</p>`,
      `<p>${escapeHtml(copy.action)} <a href="${url}">${url}</a></p>`,
      `<p>${escapeHtml(copy.ignore)}</p>`,
    ].join("\n"),
    text: `${copy.intro}\n\n${copy.action}\n${vars.url}\n\n${copy.ignore}`,
  };
}

interface TemporaryPasswordCopy {
  subject: string;
  intro: string;
  passwordLabel: string;
  outro: string;
}

function temporaryPasswordEmail(
  copy: TemporaryPasswordCopy,
  password: string,
): RenderedEmail {
  return {
    subject: copy.subject,
    html: [
      `<p>${escapeHtml(copy.intro)}</p>`,
      `<p>${escapeHtml(copy.passwordLabel)} <code>${escapeHtml(password)}</code></p>`,
      `<p>${escapeHtml(copy.outro)}</p>`,
    ].join("\n"),
    text: `${copy.intro}\n\n${copy.passwordLabel} ${password}\n\n${copy.outro}`,
  };
}

const accountCreatedCopy: Record<EmailLocale, TemporaryPasswordCopy> = {
  en: {
    subject: "Your OfferKit account",
    intro: "An administrator has created an OfferKit account for you.",
    passwordLabel: "Sign in with this temporary password:",
    outro: "You'll be asked to choose a new password after signing in.",
  },
  it: {
    subject: "Il tuo account OfferKit",
    intro: "Un amministratore ha creato per te un account OfferKit.",
    passwordLabel: "Accedi con questa password temporanea:",
    outro: "Dopo l'accesso ti verrà chiesto di scegliere una nuova password.",
  },
  nl: {
    subject: "Je OfferKit-account",
    intro: "Een beheerder heeft een OfferKit-account voor je aangemaakt.",
    passwordLabel: "Log in met dit tijdelijke wachtwoord:",
    outro: "Na het inloggen word je gevraagd een nieuw wachtwoord te kiezen.",
  },
};

/** Sent when an admin creates a staff account. */
export function accountCreatedEmail(
  vars: { password: string },
  locale: EmailLocale,
): RenderedEmail {
  return temporaryPasswordEmail(accountCreatedCopy[locale], vars.password);
}

const passwordResetByAdminCopy: Record<EmailLocale, TemporaryPasswordCopy> = {
  en: {
    subject: "Your OfferKit password was reset",
    intro: "An administrator has reset your OfferKit password.",
    passwordLabel: "Your new temporary password:",
    outro: "You'll be asked to choose a new password after signing in.",
  },
  it: {
    subject: "La tua password di OfferKit è stata reimpostata",
    intro: "Un amministratore ha reimpostato la tua password di OfferKit.",
    passwordLabel: "La tua nuova password temporanea:",
    outro: "Dopo l'accesso ti verrà chiesto di scegliere una nuova password.",
  },
  nl: {
    subject: "Je OfferKit-wachtwoord is opnieuw ingesteld",
    intro: "Een beheerder heeft je OfferKit-wachtwoord opnieuw ingesteld.",
    passwordLabel: "Je nieuwe tijdelijke wachtwoord:",
    outro: "Na het inloggen word je gevraagd een nieuw wachtwoord te kiezen.",
  },
};

/** Sent when an admin resets a staff user's password. */
export function passwordResetByAdminEmail(
  vars: { password: string },
  locale: EmailLocale,
): RenderedEmail {
  return temporaryPasswordEmail(passwordResetByAdminCopy[locale], vars.password);
}
