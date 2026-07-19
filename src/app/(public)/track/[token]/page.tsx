import { RecipientMissionTrackingView } from "@/components/recipient/recipient-mission-tracking-view";
import { createPageMetadata } from "@/lib/metadata";

type PageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata() {
  return createPageMetadata(
    "Urmărire livrare",
    "Urmărește o livrare SkySend din linkul public al destinatarului.",
  );
}

export default async function PublicTrackingPage({ params }: PageProps) {
  const { token } = await params;

  return <RecipientMissionTrackingView token={token} />;
}
