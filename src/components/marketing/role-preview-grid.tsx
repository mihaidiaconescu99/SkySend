import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { roleConfigs } from "@/constants/roles";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RolePreviewGrid() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Badge variant="outline">Role Routing</Badge>
        <h2 className="max-w-2xl font-heading text-3xl tracking-tight sm:text-4xl">
          Separate dashboards, shared source of truth.
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Each workspace has a dedicated route and can evolve independently
          without fragmenting the project structure.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {Object.values(roleConfigs).map((role, index) => (
          <MotionReveal
            key={role.role}
            preset="section"
            delay={index * 0.15}
            margin="-80px"
            className="h-full"
          >
          <Card
            className="card-interactive h-full"
            style={{ "--role-accent": role.accent } as CSSProperties}
          >
            <CardHeader className="gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: role.accent }}
                />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {role.label}
                </span>
              </div>
              <CardTitle>{role.title}</CardTitle>
              <CardDescription className="leading-6">
                {role.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex h-full flex-col gap-6">
              <ul className="grid gap-3">
                {role.priorities.slice(0, 2).map((priority) => (
                  <li
                    key={priority}
                    className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"
                  >
                    <span
                      className="mt-2 size-1.5 rounded-full"
                      style={{ backgroundColor: role.accent }}
                    />
                    <span>{priority}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Button asChild variant="ghost" className="px-0">
                  <Link href={role.basePath} prefetch={false}>
                    Open {role.label.toLowerCase()} workspace
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          </MotionReveal>
        ))}
      </div>
    </section>
  );
}
