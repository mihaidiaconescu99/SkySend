import type { ReactNode } from "react";
import { PublicLayout } from "@/components/layout/public-layout";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <PublicLayout>{children}</PublicLayout>;
}
