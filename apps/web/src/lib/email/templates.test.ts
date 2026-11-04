import { describe, expect, it } from "vitest";
import { EMAIL_LOCALES } from "./locale.ts";
import {
  accountCreatedEmail,
  escapeHtml,
  passwordResetByAdminEmail,
  resetPasswordLinkEmail,
  type RenderedEmail,
} from "./templates.ts";

const PLACEHOLDER = /\{\{|\}\}|\$\{|\{[a-zA-Z]+\}|undefined|null/;

function expectWellFormed(email: RenderedEmail): void {
  expect(email.subject.trim().length).toBeGreaterThan(0);
  expect(email.subject).toContain("OfferKit");
  expect(email.subject).not.toContain("Offerkit");
  expect(email.html).not.toContain("Offerkit");
  expect(email.text).not.toContain("Offerkit");
  for (const part of [email.subject, email.html, email.text]) {
    expect(part).not.toMatch(PLACEHOLDER);
  }
}

describe("escapeHtml", () => {
  it("escapes markup-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe.each(EMAIL_LOCALES)("templates (%s)", (locale) => {
  it("reset password link interpolates and escapes the URL", () => {
    const url = `https://offerkit.test/reset-password/tok?callbackURL=%2F&a="<x>"`;
    const email = resetPasswordLinkEmail({ url }, locale);
    expectWellFormed(email);
    const escaped = "https://offerkit.test/reset-password/tok?callbackURL=%2F&amp;a=&quot;&lt;x&gt;&quot;";
    expect(email.html).toContain(`<a href="${escaped}">${escaped}</a>`);
    expect(email.html).not.toContain("<x>");
    expect(email.text).toContain(url);
  });

  it.each([
    ["account created", accountCreatedEmail],
    ["password reset by admin", passwordResetByAdminEmail],
  ] as const)("%s interpolates and escapes the password", (_name, render) => {
    const password = `a<b>&"c'`;
    const email = render({ password }, locale);
    expectWellFormed(email);
    expect(email.html).toContain("<code>a&lt;b&gt;&amp;&quot;c&#39;</code>");
    expect(email.html).not.toContain("a<b>");
    expect(email.text).toContain(password);
  });
});

describe("localization", () => {
  it("uses distinct copy per locale", () => {
    for (const render of [
      () => resetPasswordLinkEmail({ url: "https://x.test" }, "en"),
      () => accountCreatedEmail({ password: "p" }, "en"),
      () => passwordResetByAdminEmail({ password: "p" }, "en"),
    ]) {
      expect(render().subject).toMatch(/OfferKit/);
    }
    const subjects = EMAIL_LOCALES.map(
      (locale) => accountCreatedEmail({ password: "p" }, locale).subject,
    );
    expect(new Set(subjects).size).toBe(EMAIL_LOCALES.length);
    expect(resetPasswordLinkEmail({ url: "u" }, "it").subject).toBe(
      "Reimposta la password di OfferKit",
    );
    expect(passwordResetByAdminEmail({ password: "p" }, "nl").subject).toBe(
      "Je OfferKit-wachtwoord is opnieuw ingesteld",
    );
  });
});
