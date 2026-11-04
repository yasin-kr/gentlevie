import "server-only";
import { Socket } from "node:net";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getEmailAvailability, getSmtpConfiguration } from "./auth-config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

export function isEmailConfigured(): boolean {
  return getEmailAvailability();
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const configuration = getSmtpConfiguration();
  if (!configuration) throw new Error("Email delivery is not configured");
  if (!z.email().safeParse(message.to).success || /[\r\n]/.test(message.subject)) {
    throw new Error("Invalid email message");
  }
  const headers = message.headers;
  if (headers && Object.entries(headers).some(([key, value]) =>
    !/^[A-Za-z0-9-]+$/.test(key) || /[\r\n]/.test(value))) {
    throw new Error("Invalid email headers");
  }
  // Keep a handle to the underlying socket: Nodemailer's non-pooled close()
  // releases transport resources but does not cancel an active SMTP send.
  // Nodemailer connects this socket and still performs TLS/STARTTLS itself.
  const socket = new Socket();
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    socket,
    requireTLS: true,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    auth: { user: configuration.user, pass: configuration.pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const closeTransport = () => {
    socket.destroy();
    try { transporter.close(); } catch { /* Closing must not expose SMTP details. */ }
  };
  try {
    const result = await Promise.race([
      transporter.sendMail({
        from: configuration.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          closeTransport();
          reject(new Error("Email delivery timed out"));
        }, 25_000);
      }),
    ]);
    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new Error("Email rejected");
    }
  } catch {
    // SMTP errors can contain credentials, message bodies or recipients.
    throw new Error("Email delivery failed");
  } finally {
    if (deadline) clearTimeout(deadline);
    closeTransport();
  }
}
