export type SkySendEmailEvent =
  | "order_confirmation"
  | "payment_confirmation"
  | "recipient_tracking_link"
  | "delivery_completed"
  | "order_cancelled";

export type SkySendEmailInput = {
  event: SkySendEmailEvent;
  to?: string | null;
  orderId?: string | null;
  trackingUrl?: string | null;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function getEmailTemplate(input: SkySendEmailInput): EmailTemplate {
  const orderLine = input.orderId ? `Comanda ${input.orderId}` : "Your order";
  const trackingUrl = safeHttpUrl(input.trackingUrl);
  const trackingLine = trackingUrl
    ? `\nUrmărește livrarea: ${trackingUrl}`
    : "";
  const escapedOrderLine = escapeHtml(orderLine);
  const trackingLink = trackingUrl
    ? `<p><a href="${escapeHtml(trackingUrl)}">Urmărește livrarea</a></p>`
    : "";

  switch (input.event) {
    case "payment_confirmation":
      return {
        subject: "Your SkySend payment is confirmed",
        text: `${orderLine} is paid and ready for dispatch.${trackingLine}`,
        html: `<p>${escapedOrderLine} is paid and ready for dispatch.</p>${trackingLink}`,
      };
    case "recipient_tracking_link":
      return {
        subject: "Track your SkySend delivery",
        text: `Your SkySend delivery can be tracked here.${trackingLine}`,
        html: `<p>Your SkySend delivery can be tracked here.</p>${trackingLink}`,
      };
    case "delivery_completed":
      return {
        subject: "Your SkySend delivery was completed",
        text: `${orderLine} was delivered successfully.`,
        html: `<p>${escapedOrderLine} was delivered successfully.</p>`,
      };
    case "order_cancelled":
      return {
        subject: "Your SkySend order was cancelled",
        text: `${orderLine} was cancelled before dispatch.`,
        html: `<p>${escapedOrderLine} was cancelled before dispatch.</p>`,
      };
    default:
      return {
        subject: "Your SkySend delivery is confirmed",
        text: `${orderLine} is confirmed and being prepared.${trackingLine}`,
        html: `<p>${escapedOrderLine} is confirmed and being prepared.</p>${trackingLink}`,
      };
  }
}

export async function sendSkySendEmail(input: SkySendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!input.to || !apiKey || !fromEmail) {
    return {
      skipped: true,
      reason: "Email service is not configured.",
    };
  }

  const template = getEmailTemplate(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: `
        <div style="background:#05070A;color:#F4F8FB;font-family:Arial,sans-serif;padding:24px">
          <div style="max-width:560px;margin:0 auto;border:1px solid #1C2A36;border-radius:20px;padding:24px;background:#0B1117">
            <p style="color:#20E7D5;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px">SkySend</p>
            <h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(template.subject)}</h1>
            <div style="color:#B7C7D4;font-size:15px;line-height:1.6">${template.html}</div>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Email could not be sent.");
  }

  return {
    skipped: false,
  };
}

export type OrderCommunicationEmailInput = {
  event: "confirmation" | "scheduled_reminder";
  to: string;
  locale: "ro" | "en";
  orderId: string;
  total: string;
  pickup: string;
  dropoff: string;
  scheduledAt?: string | null;
  trackingUrl?: string | null;
  idempotencyKey: string;
  invoiceAttachment?: { filename: string; contentBase64: string } | null;
  invoiceDownloadUrl?: string | null;
  invoicePending?: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function safeHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export async function sendOrderCommunicationEmail(input: OrderCommunicationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail || !input.to) return { skipped: true, reason: "Email service is not configured." };

  const ro = input.locale === "ro";
  const trackingUrl = safeHttpUrl(input.trackingUrl);
  const invoiceDownloadUrl = safeHttpUrl(input.invoiceDownloadUrl);
  const scheduledDate = input.scheduledAt
    ? new Intl.DateTimeFormat(ro ? "ro-RO" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date(input.scheduledAt))
    : null;
  const reminder = input.event === "scheduled_reminder";
  const subject = reminder
    ? (ro ? `Livrarea ${input.orderId} începe în 4 ore` : `Delivery ${input.orderId} starts in 4 hours`)
    : scheduledDate
      ? (ro ? `Comanda ${input.orderId} este programată` : `Order ${input.orderId} is scheduled`)
      : (ro ? `Comanda ${input.orderId} este confirmată` : `Order ${input.orderId} is confirmed`);
  const intro = reminder
    ? (ro ? "Livrarea ta programată se apropie." : "Your scheduled delivery is approaching.")
    : scheduledDate
      ? (ro ? "Am rezervat data și ora alese. Îți trimitem un reminder cu 4 ore înainte." : "We reserved your chosen date and time. We will remind you 4 hours before.")
      : (ro ? "Plata este confirmată. Pregătim livrarea." : "Payment is confirmed. We are preparing your delivery.");
  const rows = [
    [ro ? "Total" : "Total", input.total],
    [ro ? "Ridicare" : "Pickup", input.pickup],
    [ro ? "Livrare" : "Drop-off", input.dropoff],
    ...(scheduledDate ? [[ro ? "Programată" : "Scheduled", scheduledDate]] : []),
  ];
  const text = `${subject}\n\n${intro}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}${trackingUrl ? `\n\n${ro ? "Urmărește livrarea" : "Track delivery"}: ${trackingUrl}` : ""}`;
  const invoiceNote = input.invoicePending
    ? (ro ? "Factura este încă în procesare și va fi trimisă separat." : "The invoice is still processing and will be sent separately.")
    : input.invoiceAttachment
      ? (ro ? "Factura PDF este atașată acestui email." : "The PDF invoice is attached to this email.")
      : null;
  const finalText = `${text}${invoiceNote ? `\n\n${invoiceNote}` : ""}${invoiceDownloadUrl ? `\n${ro ? "Descarcă factura" : "Download invoice"}: ${invoiceDownloadUrl}` : ""}`;
  const htmlRows = rows.map(([label, value]) => `<tr><td style="padding:10px 0;color:#8093a3;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 0;color:#f4f8fb;text-align:right">${escapeHtml(value)}</td></tr>`).join("");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject,
      text: finalText,
      html: `<div style="background:#05080b;padding:32px 16px;color:#f4f8fb;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto"><p style="color:#20e7d5;font-size:12px;letter-spacing:.18em;margin:0 0 28px">SKYSEND</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 14px">${escapeHtml(subject)}</h1><p style="color:#aab9c5;line-height:1.7;margin:0 0 26px">${escapeHtml(intro)}</p><table style="width:100%;border-collapse:collapse;border-top:1px solid #21303b;border-bottom:1px solid #21303b">${htmlRows}</table>${invoiceNote ? `<p style="color:#aab9c5;line-height:1.7;margin:24px 0 0">${escapeHtml(invoiceNote)}</p>` : ""}${invoiceDownloadUrl ? `<a href="${escapeHtml(invoiceDownloadUrl)}" style="display:inline-block;margin-top:18px;color:#20e7d5">${ro ? "Descarcă factura" : "Download invoice"}</a>` : ""}${trackingUrl ? `<a href="${escapeHtml(trackingUrl)}" style="display:inline-block;margin-top:26px;background:#20e7d5;color:#04110f;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:10px">${ro ? "Urmărește livrarea" : "Track delivery"}</a>` : ""}<p style="color:#607381;font-size:12px;margin-top:34px">SkySend · Pitești</p></div></div>`,
      ...(input.invoiceAttachment ? { attachments: [{ filename: input.invoiceAttachment.filename, content: input.invoiceAttachment.contentBase64 }] } : {}),
    }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Email could not be sent.");
  return { skipped: false };
}

export type BillingDocumentEmailInput = {
  to: string;
  locale: "ro" | "en";
  orderId: string;
  documentType: "invoice" | "credit_note";
  documentNumber: string;
  downloadUrl: string;
  attachment: { filename: string; contentBase64: string };
  idempotencyKey: string;
};

export async function sendBillingDocumentEmail(input: BillingDocumentEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail || !input.to) {
    return { skipped: true, reason: "Email service is not configured." };
  }
  const ro = input.locale === "ro";
  const downloadUrl = safeHttpUrl(input.downloadUrl);
  if (!downloadUrl) throw new Error("Billing document URL is invalid.");
  const correction = input.documentType === "credit_note";
  const subject = correction
    ? (ro ? `Document de corecție ${input.documentNumber}` : `Credit note ${input.documentNumber}`)
    : (ro ? `Factura ${input.documentNumber} este disponibilă` : `Invoice ${input.documentNumber} is ready`);
  const intro = correction
    ? (ro ? `Rambursarea comenzii ${input.orderId} a fost confirmată. Documentul de corecție este atașat.` : `The refund for order ${input.orderId} was confirmed. The credit note is attached.`)
    : (ro ? `Factura pentru comanda ${input.orderId} a fost finalizată și este atașată.` : `The invoice for order ${input.orderId} is complete and attached.`);
  const action = correction
    ? (ro ? "Descarcă documentul de corecție" : "Download credit note")
    : (ro ? "Descarcă factura" : "Download invoice");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject,
      text: `${subject}\n\n${intro}\n\n${action}: ${downloadUrl}`,
      html: `<div style="background:#05080b;padding:32px 16px;color:#f4f8fb;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto"><p style="color:#20e7d5;font-size:12px;letter-spacing:.18em;margin:0 0 28px">SKYSEND</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 14px">${escapeHtml(subject)}</h1><p style="color:#aab9c5;line-height:1.7;margin:0 0 26px">${escapeHtml(intro)}</p><a href="${escapeHtml(downloadUrl)}" style="display:inline-block;background:#20e7d5;color:#04110f;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:10px">${escapeHtml(action)}</a></div></div>`,
      attachments: [{ filename: input.attachment.filename, content: input.attachment.contentBase64 }],
    }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Billing document email could not be sent.");
  return { skipped: false };
}
