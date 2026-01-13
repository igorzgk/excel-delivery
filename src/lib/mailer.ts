// src/lib/mailer.ts
import nodemailer from "nodemailer";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`mailer_not_configured: missing ${name}`);
  return v;
}

export function createMailer() {
  const host = getEnv("SMTP_HOST");
  const port = Number(getEnv("SMTP_PORT"));
  const secure = (process.env.SMTP_SECURE || "true") === "true";
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export function getFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";
}
