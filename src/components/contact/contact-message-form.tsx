"use client";

import { useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ContactMessageCategory } from "@/types/admin-contact";

const contactMessageCategoryOptions: Array<[ContactMessageCategory, string]> = [
  ["support", "Suport"],
  ["commercial", "Comercial"],
  ["billing", "Facturare"],
  ["technical", "Tehnic"],
  ["other", "Altceva"],
];

type FormState = {
  email: string;
  subject: string;
  category: ContactMessageCategory;
  message: string;
};

const initialFormState: FormState = {
  email: "",
  subject: "",
  category: "support",
  message: "",
};

function getErrorMessage(reason: string) {
  switch (reason) {
    case "invalid_email":
      return "Adresa de email introdusă nu este validă.";
    case "missing_subject":
      return "Completează subiectul mesajului.";
    case "missing_category":
      return "Alege o categorie pentru mesaj.";
    case "missing_message":
      return "Scrie mesajul înainte de trimitere.";
    case "invalid_body":
    case "validation_failed":
      return "Datele introduse nu sunt valide. Verifică formularul și reîncearcă.";
    case "db_insert_failed":
    case "server_error":
    default:
      return "Mesajul nu a putut fi salvat în baza de date. Încearcă din nou.";
  }
}

export function ContactMessageForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const lastSubmissionRef = useRef<{ signature: string; submittedAt: number } | null>(
    null,
  );

  function updateField<Field extends keyof FormState>(
    field: Field,
    value: FormState[Field],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const submissionSignature = JSON.stringify({
      email: form.email.trim().toLowerCase(),
      subject: form.subject.trim(),
      category: form.category,
      message: form.message.trim(),
    });
    const lastSubmission = lastSubmissionRef.current;

    if (
      lastSubmission?.signature === submissionSignature &&
      Date.now() - lastSubmission.submittedAt < 5000
    ) {
      setFeedback({
        tone: "success",
        message: "Mesajul a fost deja salvat recent.",
      });
      setIsSubmitting(false);
      return;
    }

    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (!email) {
      setFeedback({ tone: "error", message: getErrorMessage("invalid_email") });
      setIsSubmitting(false);
      return;
    }
    if (!subject) {
      setFeedback({ tone: "error", message: getErrorMessage("missing_subject") });
      setIsSubmitting(false);
      return;
    }
    if (!message) {
      setFeedback({ tone: "error", message: getErrorMessage("missing_message") });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          subject,
          category: form.category,
          message,
        }),
      });

      if (!response.ok) {
        const body: { error?: string } | null = await response
          .json()
          .catch(() => null);
        setFeedback({
          tone: "error",
          message: getErrorMessage(body?.error ?? "server_error"),
        });
        setIsSubmitting(false);
        return;
      }

      setFeedback({
        tone: "success",
        message:
          "Mesajul a fost trimis echipei SkySend. Vei primi răspunsul pe email.",
      });
      lastSubmissionRef.current = {
        signature: submissionSignature,
        submittedAt: Date.now(),
      };
      setForm(initialFormState);
    } catch (err) {
      console.error("[contact-message-form] submit failed:", err);
      setFeedback({
        tone: "error",
        message: getErrorMessage("server_error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Email
          </span>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="nume@companie.ro"
            autoComplete="email"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Categorie
          </span>
          <select
            value={form.category}
            onChange={(event) =>
              updateField("category", event.target.value as ContactMessageCategory)
            }
            className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
          >
            {contactMessageCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Subiect
        </span>
        <Input
          type="text"
          value={form.subject}
          onChange={(event) => updateField("subject", event.target.value)}
          placeholder="Pe scurt, despre ce este mesajul?"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Mesaj
        </span>
        <textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          placeholder="Spune-ne cu ce ai nevoie de ajutor."
          required
          className="min-h-36 rounded-[var(--ui-radius-card)] border border-input bg-muted px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/90 focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
        />
      </label>

      {feedback ? (
        <div
          role="status"
          className={cn(
            "rounded-[calc(var(--radius)+0.35rem)] border p-4 text-sm leading-6",
            feedback.tone === "success"
              ? "border-success/35 bg-success/10 text-foreground"
              : "border-destructive/35 bg-destructive/10 text-destructive",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
          <Send className="size-4" />
          {isSubmitting ? "Se salveaza..." : "Trimite mesajul"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Răspunsul echipei va veni pe adresa de email completată mai sus.
        </p>
      </div>
    </form>
  );
}
