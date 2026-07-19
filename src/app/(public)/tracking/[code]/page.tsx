import { RecipientMissionTrackingView } from "@/components/recipient/recipient-mission-tracking-view";
import { createPageMetadata } from "@/lib/metadata";

type PageProps = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata() {
  return createPageMetadata(
    "Urmărire livrare",
    "Urmărește o livrare SkySend cu un cod public de urmărire.",
  );
}

export default async function PublicTrackingCodePage({ params }: PageProps) {
  const { code } = await params;

  return <RecipientMissionTrackingView token={code} />;
}
