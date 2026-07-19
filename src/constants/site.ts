export { roleConfigs } from "@/constants/roles";

export const siteConfig = {
  name: "SkySend",
  shortName: "SkySend",
  description:
    "Platformă premium de logistică urbană cu drona pentru livrare rapidă, vizibilitate asupra flotei și operațiuni la scară de oraș.",
  url: "https://skysend.ro",
  themeColor: "#0f9bd7",
  backgroundColor: "#f4f7fb",
  supportEmail: "ops@skysend.ro",
} as const;

export const platformMetrics = [
  {
    label: "Latență lansare",
    value: "< 90 sec",
    hint: "Pregătit pentru rutare automată și alocarea lansărilor.",
  },
  {
    label: "Mod acoperire",
    value: "Doar Pitești",
    hint: "Zona curentă de serviciu este limitată la municipiul Pitești.",
  },
  {
    label: "Spații pe roluri",
    value: "3 panouri",
    hint: "Spațiile client, admin și operator folosesc același nucleu tipizat.",
  },
] as const;

export const platformCapabilities = [
  "Rutarea pe roluri este izolată în puncte dedicate de intrare în panou.",
  "Metadata PWA susține o experiență mobilă concentrată pe livrare.",
  "Tokenurile de design, constantele și tipurile păstrează interfața coerentă.",
  "Disponibilitatea serviciului este momentan restricționată la municipiul Pitești.",
] as const;
