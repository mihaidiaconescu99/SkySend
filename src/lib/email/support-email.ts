import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendSupportEmail(input: { to: string | null; title: string; message: string; ticketId: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!input.to || !apiKey || !from) return { skipped: true };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/u, "") ?? "http://localhost:3000";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.title, text: `${input.message}\n\nDeschide SkySend pentru a răspunde: ${baseUrl}/client/support`, html: `<p>${escapeHtml(input.message)}</p><p><a href="${baseUrl}/client/support">Deschide SkySend</a></p>` }),
  });
  if (!response.ok) console.error("[support-email] delivery failed", await response.text());
  return { skipped: false };
}
