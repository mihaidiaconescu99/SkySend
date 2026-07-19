import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getSkySendAssistantReply } from "@/lib/ai/skysend-assistant";
import { getSupportIdentity, persistAiExchange } from "@/lib/support/support-hub";

const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(700),
  language: z.enum(["ro", "en"]).optional().default("ro"),
  conversationId: z.string().uuid().optional(),
});

const requestsByIp = new Map<string, number[]>();
const requestWindowMs = 60_000;
const maximumRequestsPerWindow = 12;

function isRateLimited(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (requestsByIp.get(key) ?? []).filter(
    (timestamp) => now - timestamp < requestWindowMs,
  );

  if (recent.length >= maximumRequestsPerWindow) {
    requestsByIp.set(key, recent);
    return true;
  }

  requestsByIp.set(key, [...recent, now]);
  return false;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      {
        message:
          "Ai trimis mai multe întrebări într-un interval scurt. Încearcă din nou peste un minut sau consultă pagina de întrebări frecvente.",
        action: { label: "Vezi întrebările frecvente", href: "/faq" },
      },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          "Trimite o întrebare scurtă despre livrare, colet, acoperire, tracking sau cont, iar eu te ghidez către funcția SkySend potrivită.",
        action: { label: "Vezi întrebările frecvente", href: "/faq" },
      },
      { status: 400 },
    );
  }

  const reply = await getSkySendAssistantReply(parsed.data.message, parsed.data.language);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ...reply, persistent: false });

  try {
    const identity = await getSupportIdentity(userId);
    if (!identity) return NextResponse.json({ ...reply, persistent: false });
    const conversationId = await persistAiExchange(identity, parsed.data.message, reply.message, parsed.data.conversationId);
    return NextResponse.json({ ...reply, conversationId, persistent: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "support_unavailable";
    if (reason === "human_support_active") return NextResponse.json({ error: reason }, { status: 409 });
    console.error("[ai/assistant] persistence", error);
    return NextResponse.json({ ...reply, persistent: false });
  }
}
