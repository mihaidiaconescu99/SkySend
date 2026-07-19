import type { CSSProperties } from "react";
import {
  brandColorTokens,
  componentGuidelines,
  semanticColorTokens,
  spacingTokens,
  typographyTokens,
} from "@/constants/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function TokenSwatch({
  label,
  token,
  value,
  usage,
}: {
  label: string;
  token: string;
  value: string;
  usage: string;
}) {
  const cssVariableName = token.split(" / ")[0];

  return (
    <article className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4 shadow-[var(--elevation-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-medium tracking-tight">
            {label}
          </h3>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {token}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="size-10 rounded-2xl border border-border/80"
          style={{ backgroundColor: `var(${cssVariableName})` } as CSSProperties}
        />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{usage}</p>
    </article>
  );
}

export function DesignSystemPreview() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Badge variant="outline">Design System</Badge>
        <div className="max-w-3xl space-y-3">
          <h2 className="type-h2">Minimal tokens, clear rhythm, premium restraint.</h2>
          <p className="type-subtitle">
            The SkySend visual system favors calm contrast, deliberate spacing,
            and mature surfaces over decorative effects. Tokens are centralized
            and designed to scale into product dashboards without visual noise.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[var(--ui-radius-panel)]">
          <CardHeader className="gap-3">
            <Badge variant="outline">Color System</Badge>
            <CardTitle>Brand and semantic palette</CardTitle>
            <CardDescription>
              Primary brand tones stay desaturated and stable. Semantic colors
              communicate state without shouting.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              {brandColorTokens.map((token) => (
                <TokenSwatch
                  key={token.token}
                  label={token.name}
                  token={token.token}
                  value={token.value}
                  usage={token.usage}
                />
              ))}
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              {semanticColorTokens.map((token) => (
                <TokenSwatch
                  key={token.token}
                  label={token.name}
                  token={token.token}
                  value={token.value}
                  usage={token.usage}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--ui-radius-panel)]">
          <CardHeader className="gap-3">
            <Badge variant="outline">Typography</Badge>
            <CardTitle>Readable hierarchy, compact rules</CardTitle>
            <CardDescription>
              Headings are crisp and slightly futuristic. Supporting text stays
              quieter and more generous.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="type-display">Aerial delivery, refined.</p>
              <p className="type-h1">Operational clarity at city scale.</p>
              <p className="type-h2">Built for premium logistics interfaces.</p>
              <p className="type-h3">Structured systems, minimal friction.</p>
              <p className="type-subtitle">
                Subtitle copy guides context without overpowering the headline.
              </p>
              <p className="type-body">
                Body text uses a calm rhythm for dashboards, forms, and long UI
                explanations where clarity matters more than decoration.
              </p>
              <p className="type-caption">Caption / Metadata / Context</p>
            </div>

            <Separator />

            <div className="grid gap-3">
              {typographyTokens.map((token) => (
                <div
                  key={token.token}
                  className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{token.name}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {token.token}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {token.value}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {token.usage}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader className="gap-3">
            <Badge variant="outline">Spacing Scale</Badge>
            <CardTitle>Deliberate breathing room</CardTitle>
            <CardDescription>
              The scale prioritizes comfortable cards and quiet layouts over
              cramped density.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {spacingTokens.map((token) => (
              <div
                key={token.token}
                className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{token.name}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {token.token}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{token.value}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `calc(${token.value} * 5)` }}
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {token.usage}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <Badge variant="outline">Component Styles</Badge>
            <CardTitle>Cards, badges, buttons, inputs</CardTitle>
            <CardDescription>
              Core primitives stay restrained and performance-friendly, with
              solid fills and light depth.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4">
                <p className="type-caption">Badges</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">Default</Badge>
                  <Badge variant="secondary">Muted</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Critical</Badge>
                </div>
              </div>

              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4">
                <p className="type-caption">Buttons</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </div>
            </div>

            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4">
              <p className="type-caption">Input Example</p>
              <div className="mt-4 grid gap-3">
                <Input type="text" placeholder="Referință colet sau ID pad aterizare" />
                <Input type="email" placeholder="operations@skysend.example" />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <p className="type-caption">Card Rule</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {componentGuidelines.cards}
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <p className="type-caption">Badge Rule</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {componentGuidelines.badges}
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <p className="type-caption">Button Rule</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {componentGuidelines.buttons}
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <p className="type-caption">Input Rule</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {componentGuidelines.inputs}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
