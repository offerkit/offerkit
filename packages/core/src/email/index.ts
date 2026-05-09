import pino from "pino";

const log = pino({ name: "email" });

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

class LogAdapter implements EmailAdapter {
  send(message: EmailMessage): Promise<void> {
    log.info(
      {
        to: message.to,
        subject: message.subject,
        text: message.text ?? message.html,
      },
      "[email:dev] would send",
    );
    return Promise.resolve();
  }
}

class ResendAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${body}`);
    }
  }
}

export function createEmailAdapter(env: NodeJS.ProcessEnv = process.env): EmailAdapter {
  const apiKey = env["RESEND_API_KEY"];
  const from = env["RESEND_FROM"] ?? "Offerkit <onboarding@resend.dev>";
  if (apiKey) {
    return new ResendAdapter(apiKey, from);
  }
  return new LogAdapter();
}

let cachedAdapter: EmailAdapter | undefined;

export async function sendEmail(message: EmailMessage): Promise<void> {
  cachedAdapter ??= createEmailAdapter();
  await cachedAdapter.send(message);
}
