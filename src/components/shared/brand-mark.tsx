import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <span
        aria-hidden="true"
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-visible",
          compact ? "size-24" : "size-28",
        )}
      >
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={192}
          height={192}
          priority
          className="size-full object-contain"
        />
      </span>

      <span className={cn("grid min-w-0 gap-0.5", compact && "gap-0")}>
        <span className="truncate font-heading text-xl font-semibold tracking-tight">
          SkySend
        </span>
        {!compact ? (
          <span className="text-sm text-muted-foreground">
            Logistică urbană premium cu drona
          </span>
        ) : null}
      </span>
    </div>
  );
}
