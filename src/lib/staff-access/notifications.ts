import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
export async function sendStaffAccessEmail(input: {
  to: string;
  subject: string;
  message: string;
  actionUrl: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { skipped: true as const };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/u, "") ?? "http://localhost:3000";
  const url = `${baseUrl}${input.actionUrl}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: `${input.message}\n\n${url}`,
      html: `<div style="background:#05070a;color:#f4f8fb;padding:28px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;border:1px solid #1c2a36;border-radius:20px;background:#0b1117;padding:24px"><p style="color:#20e7d5;font-size:12px;text-transform:uppercase;letter-spacing:.1em">SkySend Security</p><h1 style="font-size:22px">${escapeHtml(input.subject)}</h1><p style="color:#b7c7d4;line-height:1.65">${escapeHtml(input.message)}</p><p><a style="color:#20e7d5" href="${escapeHtml(url)}">Deschide SkySend</a></p></div></div>`,
    }),
  });
  if (!response.ok) console.error("[staff-access-email] delivery failed", await response.text());
  return { skipped: false as const };
}
