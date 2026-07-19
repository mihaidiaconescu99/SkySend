import { StatusBadge } from "@/components/shared/status-badge";
import type {
  ParcelEstimateTraceSnapshot,
} from "@/types/operator-parcel-evaluation";
import type {
  ParcelIntelligenceConfidenceLevel,
} from "@/types/parcel-intelligence";

type ParcelEstimateTracePanelProps = {
  estimateTrace: ParcelEstimateTraceSnapshot | null | undefined;
};

const confidenceTone: Record<
  ParcelIntelligenceConfidenceLevel,
  "success" | "neutral" | "warning"
> = {
  high: "success",
  medium: "neutral",
  low: "warning",
};

const confidenceLabels: Record<ParcelIntelligenceConfidenceLevel, string> = {
  high: "Ridicată",
  medium: "Medie",
  low: "Scăzută",
};

export function ParcelEstimateTracePanel({
  estimateTrace,
}: ParcelEstimateTracePanelProps) {
  if (!estimateTrace) {
    return null;
  }

  const lookupTrace = estimateTrace.lookupTrace;
  const hasResults = lookupTrace.results.length > 0;
  const skipped = lookupTrace.skipped;

  return (
    <section
      aria-label="Surse verificare produs"
      className="grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/70 bg-muted/30 px-3.5 py-3.5 sm:px-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium text-foreground">Surse verificare produs</h4>
        <StatusBadge
          label={
            skipped
              ? `Fără surse web${
                  lookupTrace.reason ? ` — ${lookupTrace.reason}` : ""
                }`
              : `${lookupTrace.results.length} surse web`
          }
          tone={skipped ? "neutral" : "success"}
        />
        {estimateTrace.confidence ? (
          <StatusBadge
            label={`Încredere ${confidenceLabels[estimateTrace.confidence] ?? estimateTrace.confidence}`}
            tone={confidenceTone[estimateTrace.confidence] ?? "neutral"}
          />
        ) : null}
        {lookupTrace.usedInPrompt ? (
          <StatusBadge label="Folosite în estimare AI" tone="info" />
        ) : null}
        <StatusBadge
          label={`Sursă AI: ${estimateTrace.source}`}
          tone="neutral"
        />
      </header>

      {!skipped && lookupTrace.queries.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Query-uri căutate:{" "}
          <code className="font-mono text-foreground">
            {lookupTrace.queries.join(", ")}
          </code>
        </p>
      ) : null}

      {hasResults ? (
        <ul className="grid min-w-0 gap-2">
          {lookupTrace.results.map((result) => (
            <li
              key={result.url}
              className="grid min-w-0 gap-1 rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm"
            >
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary break-words underline-offset-2 hover:underline"
              >
                {result.title}
              </a>
              {result.snippet ? (
                <p className="text-xs leading-5 text-muted-foreground break-words">
                  {result.snippet}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {estimateTrace.detectedItemsEvidence.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evidență per produs detectat
          </p>
          <ul className="flex flex-wrap gap-2">
            {estimateTrace.detectedItemsEvidence.map((item) => {
              const confidence = item.evidenceConfidence;
              return (
                <li
                  key={item.label}
                  className="grid min-w-0 gap-1 rounded-2xl border border-border/60 bg-background/80 px-3 py-2"
                >
                  <p className="font-medium text-foreground">{item.label}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {confidence ? (
                      <StatusBadge
                        label={`Evidență ${confidenceLabels[confidence] ?? confidence}`}
                        tone={confidenceTone[confidence] ?? "neutral"}
                      />
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {item.sourceUrls.length} surse
                    </span>
                  </div>
                  {item.sourceUrls.length > 0 ? (
                    <ul className="grid gap-0.5">
                      {item.sourceUrls.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline-offset-2 hover:underline break-all"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {estimateTrace.detectedItemsEvidence.length === 0 && !hasResults ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Estimarea s-a bazat doar pe profilul semantic local.
        </p>
      ) : null}
    </section>
  );
}