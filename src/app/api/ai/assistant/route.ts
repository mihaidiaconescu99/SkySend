import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { validateRequest } from "@/lib/api/validation";
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
  message: plainTextSchema(1, 2000),
  language: z.enum(["ro", "en"]).optional().default("ro"),
  conversationId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, "assistant");
  if (rateLimit) return rateLimit;

  const parsed = await validateRequest(assistantRequestSchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) {
    if (parsed.response.status === 413 || parsed.response.status === 415) {
      return parsed.response;
    }
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
