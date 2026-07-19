export type AssistantKnowledgeChunk = {
  id: string;
  title: string;
  text: string;
  href?: string;
};

export const assistantKnowledge: readonly AssistantKnowledgeChunk[] = [
  {
    id: "delivery-flow",
    title: "Crearea unei livrări",
    href: "/client/create-delivery",
    text: "O livrare se creează după autentificare: alegi adresele și punctele de handoff, descrii și confirmi coletul, alegi standard, prioritar sau programat, verifici estimarea și continui către checkout Stripe. Chatul nu creează livrări și nu face checkout.",
  },
  {
    id: "coverage",
    title: "Acoperire",
    href: "/#coverage",
    text: "Zona activă implicită este Pitești, Argeș, România, într-o rază de 6 km de hub. O adresă trebuie să fie în zonă și să corespundă orașului, județului și țării configurate. Adresele de la limită pot necesita verificare suplimentară.",
  },
  {
    id: "parcel",
    title: "Eligibilitatea coletului",
    href: "/client/create-delivery",
    text: "Evaluatorul de colet folosește descrierea, ambalarea, greutatea, dimensiunile, fragilitatea și sensibilitatea termică. Configurațiile de dronă au limite diferite; limita maximă actuală este 12 kg, 85 L și 70 × 50 × 36 cm. Confirmarea fizică la ridicare are prioritate.",
  },
  {
    id: "handoff-locker",
    title: "Puncte de handoff și locker",
    href: "/how-it-works",
    text: "SkySend propune puncte de întâlnire în apropierea adreselor. Ele sunt recomandări operaționale, nu o garanție de aterizare reală. În simulare, lockerul poate coborî la ridicare și predare; poziția și PIN-ul se confirmă atunci când sunt solicitate.",
  },
  {
    id: "tracking",
    title: "Urmărirea comenzii",
    href: "/tracking",
    text: "Trackingul poate arăta comandă primită, verificare, dronă alocată, ridicare, tranzit, așteptarea destinatarului, livrată sau recuperare. Detaliile private sunt în Client → Comenzi, iar destinatarul poate folosi codul sau linkul public de urmărire.",
  },
  {
    id: "payments",
    title: "Plăți",
    href: "/client/payment-methods",
    text: "Plățile sunt procesate prin Stripe, iar datele complete de card nu sunt păstrate de SkySend. Pentru un preț, timp estimat, plată sau rambursare, folosește fluxul real al comenzii, deoarece acesta folosește adresele, punctele de handoff și profilul confirmat al coletului.",
  },
  {
    id: "safety",
    title: "Siguranță și excepții",
    href: "/faq",
    text: "Nu bloca zona de handoff și nu încărca un colet care diferă de profilul confirmat. O predare care nu poate fi încheiată poate necesita suport, recuperarea lockerului sau returnarea la hub. Evaluarea finală a excepțiilor aparține fluxului operatorului.",
  },
  {
    id: "environment",
    title: "Impact de mediu",
    href: "/how-it-works",
    text: "SkySend afișează estimări pentru CO2e evitat, distanță rutieră evitată și energie folosită. Sunt comparații orientative cu un scenariu rutier urban, nu emisii măsurate sau certificate.",
  },
  {
    id: "dashboards",
    title: "Dashboard-uri",
    href: "/client",
    text: "Clientul gestionează livrări, comenzi, locații salvate, plăți, notificări și setări. Operatorii urmăresc misiuni și alerte. Administratorii monitorizează comenzi, recuperări de lockere, mesaje, statistici și setări operaționale.",
  },
] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase("ro-RO")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function terms(value: string) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((term) => term.length >= 3),
  );
}

export function retrieveAssistantKnowledge(query: string, limit = 4) {
  const queryTerms = terms(query);

  return assistantKnowledge
    .map((chunk) => {
      const chunkTerms = terms(`${chunk.title} ${chunk.text}`);
      const score = [...queryTerms].reduce(
        (total, term) => total + (chunkTerms.has(term) ? 1 : 0),
        0,
      );

      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}
