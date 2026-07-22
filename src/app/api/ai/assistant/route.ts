import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { buildAssistantRuntimeContext } from "@/lib/ai/skysend-assistant-context";
import { getSkySendAssistantReply } from "@/lib/ai/skysend-assistant";
import {
  getConversation,
  getSupportIdentity,
  persistAiExchange,
} from "@/lib/support/support-hub";
import type { AssistantHistoryMessage } from "@/types/assistant";

type StoredAssistantMessage = {
  author_type: "client" | "assistant" | "operator" | "system";
  body: string | null;
  created_at: string;
};

const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
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

  const { userId } = await auth();
  let identity = null;
  let history: AssistantHistoryMessage[] = [];

  if (userId) {
    identity = await getSupportIdentity(userId).catch(() => null);
  }

  if (parsed.data.conversationId) {
    if (!identity) {
      return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
    }
    const conversation = await getConversation(identity, parsed.data.conversationId).catch(() => null);
    if (!conversation || conversation.profile_id !== identity.profileId) {
      return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
    }
    const messages: StoredAssistantMessage[] = Array.isArray(conversation.assistant_messages)
      ? conversation.assistant_messages as StoredAssistantMessage[]
      : [];
    let usedCharacters = 0;
    history = messages
      .filter((item) => item.author_type === "client" || item.author_type === "assistant")
      .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
      .slice(-8)
      .map((item) => ({
        role: item.author_type === "client" ? "user" as const : "assistant" as const,
        content: String(item.body ?? "").slice(0, 1_000),
      }))
      .filter((item) => {
        if (usedCharacters + item.content.length > 6_000) return false;
        usedCharacters += item.content.length;
        return true;
      });
  }

  const context = await buildAssistantRuntimeContext({
    message: `${history.filter((item) => item.role === "user").map((item) => item.content).join("\n")}\n${parsed.data.message}`.slice(-8_000),
    profileId: identity?.profileId,
  });
  const reply = await getSkySendAssistantReply({
    message: parsed.data.message,
    language: parsed.data.language,
    history,
    context,
  });
  if (!identity) return NextResponse.json({ ...reply, persistent: false });

  try {
    const conversationId = await persistAiExchange(identity, parsed.data.message, reply.message, parsed.data.conversationId);
    return NextResponse.json({ ...reply, conversationId, persistent: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "support_unavailable";
    if (reason === "human_support_active") return NextResponse.json({ error: reason }, { status: 409 });
    console.error("[ai/assistant] persistence", error);
    return NextResponse.json({ ...reply, persistent: false });
  }
}
