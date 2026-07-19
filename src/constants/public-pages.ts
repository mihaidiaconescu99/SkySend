export type PublicPageContent = {
  title: string;
  description: string;
  eyebrow: string;
  summary: string;
  pillars: {
    title: string;
    body: string;
  }[];
};

export const publicPageContent = {
  howItWorks: {
    eyebrow: "Cum funcționează",
    title: "Un parcurs operațional clar, de la cerere la predare.",
    description:
      "SkySend păstrează fluxul direct: creezi livrarea, confirmi zona activă, lansezi misiunea și urmărești comanda până la predare.",
    summary:
      "Această pagină explică fluxul curent de livrare în termeni operaționali practici.",
    pillars: [
      {
        title: "Creare comandă",
        body: "Fluxul pornește cu ridicare, livrare, profilul coletului și verificarea în zona activă Pitești.",
      },
      {
        title: "Validare lansare",
        body: "Traseul, disponibilitatea coridorului și potrivirea flotei sunt verificate înainte de lansarea misiunii.",
      },
      {
        title: "Confirmare livrare",
        body: "Clienții pot urmări ETA-ul, starea live și confirmarea finală fără pași suplimentari.",
      },
    ],
  },
  pricing: {
    eyebrow: "Tarife",
    title: "Tarifele rămân clare și ușor de comparat.",
    description:
      "Pagina de tarife păstrează serviciul ușor de înțeles pentru operațiunile curente din Pitești și pentru conturi comerciale mai mari.",
    summary:
      "Zona de tarifare păstrează fiecare estimare clară înainte de plată.",
    pillars: [
      {
        title: "Planuri pentru orașul activ",
        body: "Acoperă livrările din orașul curent, volumele operaționale standard și nivelurile active de serviciu.",
      },
      {
        title: "Contracte pentru volum",
        body: "Potrivite pentru volume mai mari, operațiuni cu mai multe puncte și nevoi extinse de serviciu.",
      },
      {
        title: "Condiții pentru organizații",
        body: "Folosite pentru implementări cu cerințe ridicate de conformitate, fluxuri personalizate și niveluri negociate de serviciu.",
      },
    ],
  },
  faq: {
    eyebrow: "Întrebări frecvente",
    title: "Răspunsuri cu claritate operațională.",
    description:
      "Întrebările frecvente rămân scurte și practice, concentrate pe utilizarea serviciului, limitele de acoperire și claritatea operațională.",
    summary:
      "Scopul este să răspundă rapid la întrebări reale, fără să transforme intrarea în produs într-un perete de documentație.",
    pillars: [
      {
        title: "Întrebări de activare",
        body: "Acoperă fluxul de început, configurarea contului și disponibilitatea zonei de serviciu.",
      },
      {
        title: "Întrebări despre modelul de serviciu",
        body: "Acoperă constrângerile livrării, limitele zonei active și separarea rolurilor în platformă.",
      },
      {
        title: "Întrebări despre încredere operațională",
        body: "Acoperă escaladările, monitorizarea, conformitatea și fiabilitatea serviciului.",
      },
    ],
  },
  coverage: {
    eyebrow: "Acoperire",
    title: "În curând — harta detaliată a zonei active.",
    description:
      "Pagina dedicată zonei de acoperire este în pregătire pentru Etapa 6. Până atunci, secțiunea de pe pagina principală oferă o privire rapidă asupra perimetrului activ din Pitești.",
    summary:
      "Vezi conturul actual al zonei de serviciu și statisticile cheie direct de pe landing page.",
    pillars: [
      {
        title: "Perimetru activ",
        body: "Zona inițială acoperă municipiul Pitești și împrejurimi, cu rază de serviciu configurabilă din panoul operațional.",
      },
      {
        title: "Status în timp real",
        body: "Verificările de eligibilitate la creare livrare folosesc aceeași sursă de date ca harta publică.",
      },
      {
        title: "Plan de extindere",
        body: "Următoarele orașe și ajustările de rază vor fi anunțate pe pagina de tarife și prin emailurile de operațiuni.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "O cale directă către echipa SkySend.",
    description:
      "Contactul rămâne disponibil pentru suport operațional, întrebări de facturare și clarificări despre zona live de serviciu.",
    summary:
      "Această pagină susține mai întâi experiența produsului live, cu zona de contact ca rută de suport.",
    pillars: [
      {
        title: "Contact comercial",
        body: "Folosit pentru întrebări de tarifare, configurarea contului și suport pentru zona activă de serviciu.",
      },
      {
        title: "Întrebări operaționale",
        body: "Folosite pentru coordonare tehnică, pregătirea orașului și verificări de potrivire operațională.",
      },
      {
        title: "Rutare suport",
        body: "Folosită pentru ajutor de cont, escaladări și suport de serviciu.",
      },
    ],
  },
} satisfies Record<string, PublicPageContent>;
