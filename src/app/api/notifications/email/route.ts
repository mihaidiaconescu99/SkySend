import { NextResponse } from "next/server";
import {
  sendSkySendEmail,
  type SkySendEmailEvent,
} from "@/lib/email/resend";

const emailEvents: SkySendEmailEvent[] = [
  "order_confirmation",
  "payment_confirmation",
  "recipient_tracking_link",
  "delivery_completed",
  "order_cancelled",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: SkySendEmailEvent;
      to?: string | null;
      orderId?: string | null;
      trackingUrl?: string | null;
    };

    if (!body.event || !emailEvents.includes(body.event)) {
      return NextResponse.json(
        { error: "Unsupported email event." },
        { status: 400 },
      );
    }

    const result = await sendSkySendEmail({
      event: body.event,
      to: body.to,
      orderId: body.orderId,
      trackingUrl: body.trackingUrl,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Email notification could not be sent." },
      { status: 500 },
    );
  }
}
