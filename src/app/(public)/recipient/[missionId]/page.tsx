import { RecipientMissionTrackingView } from "@/components/recipient/recipient-mission-tracking-view";
import { createPageMetadata } from "@/lib/metadata";

type PageProps = {
  params: Promise<{ missionId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { missionId } = await params;

  return createPageMetadata(
    "Urmărire destinatar",
    `Urmărește predarea livrării SkySend pentru misiunea ${missionId}.`,
  );
}

export default async function RecipientTrackingPage({ params }: PageProps) {
  const { missionId } = await params;

  return <RecipientMissionTrackingView token={missionId} />;
}
