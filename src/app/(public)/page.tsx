import HomeContent from "./home-content";
import { createLocalizedMetadata } from "@/lib/settings/metadata";

export async function generateMetadata() {
  return createLocalizedMetadata({
    ro: {
      title: "Livrare cu drona în Pitești",
      description:
        "SkySend creează, validează și urmărește livrări cu drona în zona activă Pitești.",
    },
    en: {
      title: "Drone delivery in Pitești",
      description:
        "SkySend creates, validates and tracks drone deliveries in the active Pitești area.",
    },
  });
}

export default function Home() {
  return <HomeContent />;
}