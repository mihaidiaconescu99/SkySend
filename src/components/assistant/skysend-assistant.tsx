"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CircleHelp,
  Clock3,
  LoaderCircle,
  MessageSquare,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { assistantFaq, normalizeAssistantText } from "@/lib/ai/skysend-assistant-knowledge";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { useSettings } from "@/lib/settings/settings-context";
import type { Language } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

type Action = { label: string; href: string };
type AssistantTab = "home" | "messages" | "help";
type Message = {
  id: string;
  role: "assistant" | "user" | "operator" | "system";
  content: string;
  action?: Action;
};
type Conversation = {
  id: string;
  title: string;
  mode: string;
  support_tickets?: Array<{
    id: string;
    status: string;
    assigned_operator_profile_id: string | null;
  }>;
};
type StoredConversation = {
  id: string;
  mode: string;
  support_tickets?: Conversation["support_tickets"];
  assistant_messages?: Array<{
    id: string;
    author_type: "client" | "assistant" | "operator" | "system";
    body: string;
    created_at: string;
  }>;
};
type AssistantApiReply = {
  message?: string;
  action?: Action;
  conversationId?: string;
  handoffOffer?: boolean;
  persistent?: boolean;
  error?: string;
};

const clerkEnabled = isClerkFrontendConfigured();

const assistantCopy = {
  ro: {
    title: "SkySend help",
    subtitleAi: "Centrul tău de ajutor",
    subtitleHuman: "Conversație cu suportul",
    heroTitle: "Cum te putem ajuta?",
    heroText: "Vorbește cu asistentul sau citește răspunsurile rapide.",
    welcome:
      "Salut! Sunt asistentul AI SkySend. Te pot ajuta cu procesul de comandă, tracking, colete, cont și puncte de întâlnire. Dacă situația are nevoie de suport uman, îți cer confirmarea înainte să transform conversația în tichet.",
    signedOut:
      "Pentru mesaje cu asistentul trebuie să fii autentificat. Momentan poți răsfoi FAQ-ul din meniul Ajutor.",
    quickPrompts: [
      "Explică-mi procesul de a da o comandă",
      "Cum funcționează găsirea punctelor de întâlnire?",
    ],
    homePlaceholder: "Începe o conversație...",
    signedOutPlaceholder: "Autentifică-te ca să trimiți mesaje",
    messagePlaceholder: "Scrie mesajul...",
    operatorPlaceholder: "Scrie operatorului...",
    home: "Acasă",
    messages: "Mesaje",
    help: "Ajutor",
    messageTitle: "Mesaje",
    messageSubtitle: "Istoricul conversațiilor AI",
    newConversation: "Conversație nouă",
    noConversations: "Nu ai conversații salvate încă.",
    savedRequired:
      "Autentifică-te pentru conversații salvate. Fără cont poți consulta doar FAQ-ul din meniul Ajutor.",
    retention: "Conversațiile se șterg după 90 de zile de la creare.",
    conversationTitle: "Conversație SkySend",
    ai: "Asistent AI",
    human: "Suport uman",
    ticketWaiting: "în așteptarea unui operator",
    ticketAssigned: "operator asignat",
    preparing: "Se pregătește răspunsul...",
    sendError:
      "Mesajul nu a putut fi trimis. Încearcă din nou sau descrie problema mai clar.",
    notSaved:
      "Conversația a primit răspuns, dar nu a putut fi salvată pe cont. Reautentifică-te sau reîncarcă pagina și încearcă din nou.",
    needMessageFirst:
      "Trimite mai întâi un mesaj pentru ca operatorul să poată prelua conversația cu istoric.",
    handoffSent:
      "Solicitarea a fost trimisă. Un operator SkySend va prelua conversația.",
    handoffQuestion:
      "Vrei să transformăm această conversație într-un tichet pentru un operator SkySend?",
    handoffConfirm: "Da, creează tichet",
    handoffCancel: "Nu acum",
    faqSubtitle: "FAQ SkySend",
    openPage: "Deschide pagina",
    close: "Închide",
    back: "Înapoi la conversații",
    send: "Trimite",
    openAssistant: "Deschide asistentul",
    closeAssistant: "Închide asistentul",
    faqFallback: [
      {
        title: "Unde este disponibil SkySend?",
        text: "SkySend este activ momentan doar în zona de serviciu Pitești.",
        href: "/#coverage",
      },
      {
        title: "Pot livra în afara Piteștiului?",
        text: "Nu. Ridicarea și livrarea trebuie să treacă verificarea de acoperire activă.",
        href: "/#coverage",
      },
      {
        title: "Ce văd destinatarii?",
        text: "Destinatarii văd starea livrării, ETA și instrucțiunile de predare, nu detalii private de plată sau cont.",
        href: "/tracking",
      },
      {
        title: "Cum funcționează plata?",
        text: "Comanda afișează prețul înainte de lansare, iar datele cardului sunt gestionate de Stripe.",
        href: "/pricing",
      },
      {
        title: "Ce se întâmplă dacă livrarea nu poate continua?",
        text: "Comanda afișează o stare clară, astfel încât clientul sau operatorul poate reîncerca, reprograma sau urmări cazul.",
        href: "/faq",
      },
    ],
  },
  en: {
    title: "SkySend help",
    subtitleAi: "Your help center",
    subtitleHuman: "Support conversation",
    heroTitle: "How can we help?",
    heroText: "Talk to the assistant or read quick answers.",
    welcome:
      "Hi! I am the SkySend AI assistant. I can help with orders, tracking, parcels, account questions and meeting points. If the case needs human support, I will ask before turning this conversation into a ticket.",
    signedOut:
      "You need to be signed in to message the assistant. For now, you can browse the FAQ in Help.",
    quickPrompts: [
      "Explain the process of placing an order",
      "How does finding meeting points work?",
    ],
    homePlaceholder: "Start a conversation...",
    signedOutPlaceholder: "Sign in to send messages",
    messagePlaceholder: "Write a message...",
    operatorPlaceholder: "Write to the operator...",
    home: "Home",
    messages: "Messages",
    help: "Help",
    messageTitle: "Messages",
    messageSubtitle: "Saved AI conversation history",
    newConversation: "New conversation",
    noConversations: "You do not have saved conversations yet.",
    savedRequired:
      "Sign in for saved conversations. Without an account, you can only browse the FAQ in Help.",
    retention: "Conversations are deleted 90 days after they are created.",
    conversationTitle: "SkySend conversation",
    ai: "AI assistant",
    human: "Human support",
    ticketWaiting: "waiting for an operator",
    ticketAssigned: "operator assigned",
    preparing: "Preparing the answer...",
    sendError:
      "The message could not be sent. Try again or describe the problem more clearly.",
    notSaved:
      "The conversation received an answer, but it could not be saved to your account. Sign in again or reload the page and try once more.",
    needMessageFirst:
      "Send a message first so the operator can receive the conversation history.",
    handoffSent:
      "The request was sent. A SkySend operator will continue the conversation.",
    handoffQuestion:
      "Do you want to turn this conversation into a ticket for a SkySend operator?",
    handoffConfirm: "Yes, create ticket",
    handoffCancel: "Not now",
    faqSubtitle: "SkySend FAQ",
    openPage: "Open page",
    close: "Close",
    back: "Back to conversations",
    send: "Send",
    openAssistant: "Open assistant",
    closeAssistant: "Close assistant",
    faqFallback: [
      {
        title: "Where is SkySend available?",
        text: "SkySend is currently active only in the Pitești service area.",
        href: "/#coverage",
      },
      {
        title: "Can I deliver outside Pitești?",
        text: "No. Pickup and delivery must pass the active coverage check.",
        href: "/#coverage",
      },
      {
        title: "What do recipients see?",
        text: "Recipients see delivery status, ETA and handoff instructions, not private payment or account details.",
        href: "/tracking",
      },
      {
        title: "How does payment work?",
        text: "The order shows the price before launch, and card details are handled by Stripe.",
        href: "/pricing",
      },
      {
        title: "What happens if delivery cannot continue?",
        text: "The order shows a clear status so the customer or operator can retry, reschedule or follow the case.",
        href: "/faq",
      },
    ],
  },
} as const;

function copyFor(language: Language) {
  return assistantCopy[language];
}

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function createWelcome(copy: ReturnType<typeof copyFor>): Message {
  return { id: "welcome", role: "assistant", content: copy.welcome };
}

function toMessages(
  conversation: StoredConversation,
  copy: ReturnType<typeof copyFor>,
): Message[] {
  const rows = conversation.assistant_messages ?? [];
  if (!rows.length) return [createWelcome(copy)];

  return [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((item) => ({
      id: item.id,
      role: item.author_type === "client" ? "user" : item.author_type,
      content: item.body,
    }));
}

export function SkySendAssistant() {
  if (clerkEnabled) {
    return <SkySendAssistantWithClerk />;
  }

  return <SkySendAssistantPanel authLoaded signedIn={false} />;
}

function SkySendAssistantWithClerk() {
  const { isLoaded, isSignedIn } = useUser();
  return (
    <SkySendAssistantPanel
      authLoaded={isLoaded}
      signedIn={Boolean(isSignedIn)}
    />
  );
}

function SkySendAssistantPanel({
  authLoaded,
  signedIn,
}: {
  authLoaded: boolean;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const { language } = useSettings();
  const copy = copyFor(language);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AssistantTab>("home");
  const [showingConversation, setShowingConversation] = useState(false);
  const [handoffPromptOpen, setHandoffPromptOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState("ai_active");
  const [ticket, setTicket] = useState<{
    id: string;
    status: string;
    assigned_operator_profile_id?: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [
    createWelcome(copy),
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canChat = authLoaded && signedIn;
  const humanActive = mode !== "ai_active";

  const refreshRecent = async () => {
    if (!canChat) {
      setConversations([]);
      return;
    }

    const response = await fetch("/api/assistant/conversations");
    if (response.ok) {
      const payload = await response.json();
      setConversations(payload.conversations ?? []);
    }
  };

  const resetConversation = () => {
    setConversationId(null);
    setMode("ai_active");
    setTicket(null);
    setMessages([createWelcome(copy)]);
    setHandoffPromptOpen(false);
    setInput("");
  };

  const openConversationList = () => {
    resetConversation();
    setActiveTab("messages");
    setShowingConversation(false);
    void refreshRecent();
  };

  const loadConversation = async (nextId: string) => {
    const response = await fetch(
      `/api/assistant/conversations/${encodeURIComponent(nextId)}`,
    );
    if (!response.ok) return;

    const payload = (await response.json()) as {
      conversation: StoredConversation;
    };
    const next = payload.conversation;
    setConversationId(next.id);
    setMode(next.mode);
    setTicket(next.support_tickets?.[0] ?? null);
    setMessages(toMessages(next, copy));
    setHandoffPromptOpen(false);
    setActiveTab("messages");
    setShowingConversation(true);
  };

  useEffect(() => {
    if (open) void refreshRecent();
  }, [open, canChat]);

  useEffect(() => {
    setMessages((current) =>
      current.length === 1 && current[0]?.id === "welcome"
        ? [createWelcome(copy)]
        : current,
    );
  }, [language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, showingConversation, handoffPromptOpen]);

  async function send(value: string) {
    const body = value.trim();
    if (!body || sending) return;

    if (!canChat) {
      setActiveTab("home");
      setMessages((current) => [
        ...current,
        { id: createId(), role: "system", content: copy.signedOut },
      ]);
      return;
    }

    setInput("");
    setActiveTab("messages");
    setShowingConversation(true);
    setHandoffPromptOpen(false);
    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", content: body },
    ]);
    setSending(true);

    try {
      if (mode === "ai_active") {
        const response = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: body,
            language,
            ...(conversationId ? { conversationId } : {}),
          }),
        });
        const reply = (await response.json()) as AssistantApiReply;
        if (!response.ok) throw new Error(reply.error);
        if (reply.conversationId) {
          setConversationId(reply.conversationId);
          await refreshRecent();
        }

        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content: reply.message ?? copy.sendError,
            action: reply.action,
          },
        ]);
        if (reply.persistent === false) {
          setMessages((current) => [
            ...current,
            { id: createId(), role: "system", content: copy.notSaved },
          ]);
        }

        if (reply.handoffOffer) {
          setHandoffPromptOpen(true);
        }
      } else if (conversationId) {
        const response = await fetch(
          `/api/assistant/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
          },
        );
        if (!response.ok) throw new Error("support_message_failed");
        await loadConversation(conversationId);
        void refreshRecent();
      }
    } catch {
      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: copy.sendError },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function requestHuman() {
    if (!conversationId) {
      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: copy.needMessageFirst },
      ]);
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch(
        `/api/assistant/conversations/${conversationId}/handoff`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setTicket(payload.ticket);
      setMode("human_requested");
      setHandoffPromptOpen(false);
      setMessages((current) => [
        ...current,
        { id: createId(), role: "system", content: copy.handoffSent },
      ]);
      void refreshRecent();
    } finally {
      setConfirming(false);
    }
  }

  if (pathname !== "/") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.section
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skysend-assistant-title"
            className="absolute bottom-16 right-0 flex h-[min(43rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[30rem] flex-col overflow-hidden rounded-[1.65rem] border border-cyan-300/20 bg-[#071116] text-white shadow-[0_32px_90px_-32px_rgba(0,0,0,.95)] sm:bottom-[4.7rem]"
          >
            <header className="relative min-h-52 bg-[#061923] px-6 py-6 text-white">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-[0_0_28px_rgba(32,231,213,.18)]">
                    <Image
                      src="/icons/icon-192.png"
                      alt=""
                      width={192}
                      height={192}
                      className="size-full object-contain"
                    />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="skysend-assistant-title"
                      className="truncate font-semibold tracking-tight"
                    >
                      {copy.title}
                    </h2>
                    <p className="text-xs text-cyan-100/70">
                      {humanActive ? copy.subtitleHuman : copy.subtitleAi}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-cyan-50/80 hover:bg-white/10"
                  aria-label={copy.close}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="absolute bottom-7 left-6 right-6">
                <p className="max-w-xs text-3xl font-semibold leading-tight">
                  {copy.heroTitle}
                </p>
                <p className="mt-2 text-sm text-cyan-100/70">
                  {copy.heroText}
                </p>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-hidden bg-[#071116]">
              {activeTab === "home" ? (
                <HomePanel
                  canChat={canChat}
                  copy={copy}
                  input={input}
                  sending={sending}
                  onInputChange={setInput}
                  onSend={send}
                />
              ) : null}

              {activeTab === "messages" ? (
                showingConversation ? (
                  <ConversationPanel
                    canChat={canChat}
                    confirming={confirming}
                    copy={copy}
                    handoffPromptOpen={handoffPromptOpen}
                    humanActive={humanActive}
                    input={input}
                    messages={messages}
                    scrollRef={scrollRef}
                    sending={sending}
                    ticket={ticket}
                    onBack={openConversationList}
                    onCancelHandoff={() => setHandoffPromptOpen(false)}
                    onInputChange={setInput}
                    onRequestHuman={requestHuman}
                    onSend={send}
                  />
                ) : (
                  <ConversationListPanel
                    canChat={canChat}
                    conversations={conversations}
                    copy={copy}
                    onLoadConversation={loadConversation}
                    onNewConversation={() => {
                      resetConversation();
                      setShowingConversation(true);
                    }}
                  />
                )
              ) : null}

              {activeTab === "help" ? (
                <HelpPanel copy={copy} language={language} />
              ) : null}
            </main>

            <footer className="grid grid-cols-3 border-t border-cyan-300/10 bg-[#08151c] px-5 py-3 text-center text-xs text-cyan-50/55">
              <TabButton
                active={activeTab === "home"}
                icon={<Sparkles className="size-4" />}
                label={copy.home}
                onClick={() => setActiveTab("home")}
              />
              <TabButton
                active={activeTab === "messages"}
                icon={<MessageSquare className="size-4" />}
                label={copy.messages}
                onClick={openConversationList}
              />
              <TabButton
                active={activeTab === "help"}
                icon={<CircleHelp className="size-4" />}
                label={copy.help}
                onClick={() => setActiveTab("help")}
              />
            </footer>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-12 place-items-center rounded-full bg-[#20e7d5] text-[#05070a] shadow-[0_12px_34px_-12px_rgba(32,231,213,.9)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/50"
        aria-label={open ? copy.closeAssistant : copy.openAssistant}
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>
    </div>
  );
}

function HomePanel({
  canChat,
  copy,
  input,
  sending,
  onInputChange,
  onSend,
}: {
  canChat: boolean;
  copy: ReturnType<typeof copyFor>;
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSend: (value: string) => void | Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-5">
      <div className="mt-5 grid gap-3">
        <MessageBubble message={createWelcome(copy)} />

        {!canChat ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            {copy.signedOut}
          </div>
        ) : null}

        <div className="grid gap-2">
          {copy.quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={!canChat || sending}
              onClick={() => void onSend(prompt)}
              className="flex min-h-12 items-center justify-between rounded-2xl border border-cyan-300/14 bg-white/[0.06] px-4 py-3 text-left text-sm font-medium text-cyan-50 shadow-sm transition hover:border-cyan-300/45 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{prompt}</span>
              <SendHorizontal className="size-4 shrink-0 text-[#20e7d5]" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-5">
        <ChatBar
          disabled={!canChat || sending}
          input={input}
          placeholder={
            canChat ? copy.homePlaceholder : copy.signedOutPlaceholder
          }
          sendLabel={copy.send}
          onInputChange={onInputChange}
          onSend={onSend}
        />
      </div>
    </div>
  );
}

function ConversationListPanel({
  canChat,
  conversations,
  copy,
  onLoadConversation,
  onNewConversation,
}: {
  canChat: boolean;
  conversations: Conversation[];
  copy: ReturnType<typeof copyFor>;
  onLoadConversation: (id: string) => void | Promise<void>;
  onNewConversation: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-50">
            {copy.messageTitle}
          </p>
          <p className="text-xs text-cyan-50/50">{copy.messageSubtitle}</p>
        </div>
        <Clock3 className="size-4 text-cyan-200/50" />
      </div>

      {!canChat ? (
        <div className="rounded-2xl border border-cyan-300/14 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-cyan-50/75 shadow-sm">
          {copy.savedRequired}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onNewConversation}
            className="mb-3 rounded-2xl bg-[#20e7d5] px-4 py-3 text-left text-sm font-semibold text-[#05070a] shadow-sm"
          >
            {copy.newConversation}
          </button>

          <div className="grid gap-2">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void onLoadConversation(conversation.id)}
                  className="rounded-2xl border border-cyan-300/14 bg-white/[0.06] px-4 py-3 text-left shadow-sm transition hover:border-cyan-300/45"
                >
                  <span className="block truncate text-sm font-medium text-cyan-50">
                    {conversation.title}
                  </span>
                  <span className="mt-1 block text-xs text-cyan-50/50">
                    {conversation.mode === "ai_active" ? copy.ai : copy.human}
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-white/[0.04] px-4 py-6 text-center text-sm text-cyan-50/50">
                {copy.noConversations}
              </div>
            )}
          </div>
        </>
      )}

      <p className="mt-auto pt-5 text-center text-[11px] leading-5 text-cyan-50/40">
        {copy.retention}
      </p>
    </div>
  );
}

function ConversationPanel({
  canChat,
  confirming,
  copy,
  handoffPromptOpen,
  humanActive,
  input,
  messages,
  scrollRef,
  sending,
  ticket,
  onBack,
  onCancelHandoff,
  onInputChange,
  onRequestHuman,
  onSend,
}: {
  canChat: boolean;
  confirming: boolean;
  copy: ReturnType<typeof copyFor>;
  handoffPromptOpen: boolean;
  humanActive: boolean;
  input: string;
  messages: Message[];
  scrollRef: RefObject<HTMLDivElement | null>;
  sending: boolean;
  ticket: {
    id: string;
    status: string;
    assigned_operator_profile_id?: string | null;
  } | null;
  onBack: () => void;
  onCancelHandoff: () => void;
  onInputChange: (value: string) => void;
  onRequestHuman: () => void | Promise<void>;
  onSend: (value: string) => void | Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-cyan-300/10 bg-[#08151c] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid size-8 place-items-center rounded-full text-cyan-50/70 hover:bg-white/10"
          aria-label={copy.back}
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-cyan-50">
            {copy.conversationTitle}
          </p>
          <p className="text-xs text-cyan-50/50">
            {humanActive ? copy.human : copy.ai}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {sending ? (
            <div className="flex w-fit items-center gap-2 rounded-2xl border border-cyan-300/12 bg-white/[0.08] px-3 py-2 text-sm text-cyan-50/65 shadow-sm">
              <LoaderCircle className="size-4 animate-spin" />
              {copy.preparing}
            </div>
          ) : null}
          {handoffPromptOpen && !humanActive ? (
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-50 shadow-sm">
              <p className="leading-6">{copy.handoffQuestion}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canChat || confirming}
                  onClick={() => void onRequestHuman()}
                  className="rounded-full bg-[#20e7d5] px-3 py-1.5 text-xs font-semibold text-[#05070a] disabled:opacity-50"
                >
                  {confirming ? copy.preparing : copy.handoffConfirm}
                </button>
                <button
                  type="button"
                  disabled={confirming}
                  onClick={onCancelHandoff}
                  className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-50/75 hover:bg-white/10"
                >
                  {copy.handoffCancel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {ticket ? (
        <div className="border-t border-cyan-300/10 bg-[#08151c] px-5 py-2 text-xs text-cyan-50/65">
          <span className="font-semibold">Status: {ticket.status}</span>
          {ticket.assigned_operator_profile_id
            ? ` · ${copy.ticketAssigned}`
            : ` · ${copy.ticketWaiting}`}
        </div>
      ) : null}

      <div className="border-t border-cyan-300/10 bg-[#08151c] px-4 py-3">
        <ChatBar
          disabled={!canChat || sending}
          input={input}
          placeholder={humanActive ? copy.operatorPlaceholder : copy.messagePlaceholder}
          sendLabel={copy.send}
          onInputChange={onInputChange}
          onSend={onSend}
        />
      </div>
    </div>
  );
}

function HelpPanel({
  copy,
  language,
}: {
  copy: ReturnType<typeof copyFor>;
  language: Language;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeAssistantText(search);
  const items = assistantFaq.filter((item) => {
    if (!normalizedSearch) return true;
    return normalizeAssistantText(
      `${item.title} ${item.aliases.join(" ")} ${item.keywords.join(" ")} ${item.body}`,
    ).includes(normalizedSearch);
  });

  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-cyan-50">{copy.help}</p>
        <p className="text-xs text-cyan-50/50">{copy.faqSubtitle}</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={language === "en" ? "Search the FAQ" : "Caută în FAQ"}
        className="mb-4 h-10 w-full rounded-xl border border-cyan-300/16 bg-[#0b2028] px-3 text-sm text-cyan-50 outline-none placeholder:text-cyan-50/35 focus:border-cyan-300/45"
      />

      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-cyan-300/14 bg-white/[0.06] px-4 py-3 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-cyan-50">
              {item.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-cyan-50/65">
              {item.body}
            </p>
            {item.href ? (
              <Link
                href={item.href}
                className="mt-2 inline-flex text-xs font-semibold text-[#20e7d5]"
              >
                {copy.openPage}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function ChatBar({
  disabled,
  input,
  placeholder,
  sendLabel,
  onInputChange,
  onSend,
}: {
  disabled: boolean;
  input: string;
  placeholder: string;
  sendLabel: string;
  onInputChange: (value: string) => void;
  onSend: (value: string) => void | Promise<void>;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-300/16 bg-[#0b2028] px-3 shadow-sm">
      <input
        value={input}
        disabled={disabled}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onSend(input);
          }
        }}
        maxLength={700}
        placeholder={placeholder}
        className="h-12 min-w-0 flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-50/35 disabled:cursor-not-allowed"
      />
      <button
        type="button"
        onClick={() => void onSend(input)}
        disabled={disabled || !input.trim()}
        className="grid size-8 place-items-center rounded-full bg-[#20e7d5] text-[#05070a] disabled:bg-cyan-50/20 disabled:text-cyan-50/40"
        aria-label={sendLabel}
      >
        <SendHorizontal className="size-4" />
      </button>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div
      className={cn(
        "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
        message.role === "user"
          ? "ml-auto rounded-br-md bg-[#20e7d5] text-[#05070a]"
          : message.role === "system"
            ? "mx-auto border border-cyan-300/20 bg-cyan-300/10 text-center text-xs text-cyan-50"
            : "rounded-bl-md border border-cyan-300/12 bg-white/[0.08] text-cyan-50 shadow-sm",
      )}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
      {message.action ? (
        <Link
          href={message.action.href === "/coverage" ? "/#coverage" : message.action.href}
          className="mt-2 inline-flex text-xs font-semibold text-[#20e7d5] underline"
        >
          {message.action.label}
        </Link>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid justify-items-center gap-1 transition-colors",
        active ? "text-[#20e7d5]" : "text-cyan-50/55 hover:text-cyan-50",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
