import tls from "node:tls";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "mail.spacemail.com";
const port = Number(process.env.SMTP_PORT || 465);
const timeout = Number(process.env.SMTP_TIMEOUT_MS || 10_000);

const tlsResult = await new Promise((resolve, reject) => {
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
  const timer = setTimeout(() => { socket.destroy(); reject(new Error("SMTP TLS connection timed out")); }, timeout);
  socket.once("secureConnect", () => {
    clearTimeout(timer);
    const certificate = socket.getPeerCertificate();
    resolve({ protocol: socket.getProtocol(), authorized: socket.authorized, validTo: certificate.valid_to });
    socket.end();
  });
  socket.once("error", (error) => { clearTimeout(timer); reject(error); });
});
if (!tlsResult.authorized) throw new Error("SMTP certificate authorization failed");
console.log(`SMTP TLS: PASS (${host}:${port}, ${tlsResult.protocol}, certificate valid to ${tlsResult.validTo})`);

const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;
if (!user || !password) {
  console.log("SMTP authentication: BLOCKED (SMTP_USER/SMTP_PASSWORD not supplied; no secret was read or printed)");
  process.exit(0);
}
const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password }, connectionTimeout: timeout });
await transport.verify();
console.log("SMTP authentication: PASS");
if (process.env.EMAIL_SMOKE_SEND === "true") {
  const recipient = process.env.EMAIL_SMOKE_RECIPIENT;
  if (!recipient) throw new Error("EMAIL_SMOKE_RECIPIENT is required when EMAIL_SMOKE_SEND=true");
  await transport.sendMail({ from: "Picom <info@picom.gg>", replyTo: "info@picom.gg", to: recipient, subject: "Picom SMTP acceptance test", text: "This operator-initiated message validates Picom SMTP delivery." });
  console.log("SMTP delivery acceptance message: QUEUED");
}
transport.close();
