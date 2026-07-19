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
  const trackingLine = input.trackingUrl
    ? `\nUrmărește livrarea: ${input.trackingUrl}`
    : "";

  switch (input.event) {
    case "payment_confirmation":
      return {
        subject: "Your SkySend payment is confirmed",
        text: `${orderLine} is paid and ready for dispatch.${trackingLine}`,
        html: `<p>${orderLine} is paid and ready for dispatch.</p>${input.trackingUrl ? `<p><a href="${input.trackingUrl}">Urmărește livrarea</a></p>` : ""}`,
      };
    case "recipient_tracking_link":
      return {
        subject: "Track your SkySend delivery",
        text: `Your SkySend delivery can be tracked here.${trackingLine}`,
        html: `<p>Your SkySend delivery can be tracked here.</p>${input.trackingUrl ? `<p><a href="${input.trackingUrl}">Open tracking</a></p>` : ""}`,
      };
    case "delivery_completed":
      return {
        subject: "Your SkySend delivery was completed",
        text: `${orderLine} was delivered successfully.`,
        html: `<p>${orderLine} was delivered successfully.</p>`,
      };
    case "order_cancelled":
      return {
        subject: "Your SkySend order was cancelled",
        text: `${orderLine} was cancelled before dispatch.`,
        html: `<p>${orderLine} was cancelled before dispatch.</p>`,
      };
    default:
      return {
        subject: "Your SkySend delivery is confirmed",
        text: `${orderLine} is confirmed and being prepared.${trackingLine}`,
        html: `<p>${orderLine} is confirmed and being prepared.</p>${input.trackingUrl ? `<p><a href="${input.trackingUrl}">Urmărește livrarea</a></p>` : ""}`,
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
            <h1 style="font-size:24px;margin:0 0 16px">${template.subject}</h1>
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
