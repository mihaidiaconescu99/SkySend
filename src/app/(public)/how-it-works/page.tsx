import HowItWorksContent from "./how-it-works-content";
import { createLocalizedMetadata } from "@/lib/settings/metadata";

export async function generateMetadata() {
  return createLocalizedMetadata({
    ro: {
      title: "Cum funcționează SkySend",
      description:
        "Ghid clar pentru ridicare, puncte de întâlnire, compartimentul dronei, PIN și urmărirea destinatarului pentru livrările SkySend în Pitești.",
    },
    en: {
      title: "How SkySend works",
      description:
        "Clear guide to pickup, drone meeting points, the drone locker, PIN entry and recipient tracking for SkySend deliveries in Pitești.",
    },
  });
}

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}