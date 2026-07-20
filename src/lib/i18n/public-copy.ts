import type { Language } from "@/lib/settings/types";

export type PublicCopy = {
  brand: {
    name: string;
    homeAria: string;
  };

  home: {
    story: {
      railAria: string;
      railLabels: string[];
      progress: {
        ariaLabel: string;
        labels: [string, string, string, string, string, string];
      };
      backToTopAria: string;
      hero: { title: string; message: string; scrollHint: string };
      editorial: {
        label: string;
        headline: string;
        lines: [string, string];
      };
      resilience: {
        chapterLabel: string;
        railAria: string;
        items: {
          id: "winter" | "sky" | "rain";
          label: string;
          message: string;
          secondaryMessage: string;
        }[];
      };
      explorer: {
        eyebrow: string;
        title: string;
        body: string;
        droneHotspot: string;
        lockerHotspot: string;
        back: string;
        drone: { title: string; body: string; facts: string[] };
        locker: {
          title: string;
          body: string;
          facts: string[];
          open: string;
          close: string;
        };
      };
      descent: {
        eyebrow: string;
        title: string;
        body: string;
        distance: string;
      };
      weather: {
        eyebrow: string;
        items: { label: string; title: string; body: string }[];
      };
      cta: {
        chapterLabel: string;
        message: string;
        primary: string;
        secondary: string;
        partnersTitle: string;
        partnersAria: string;
      };
    };
    hero: {
      eyebrow: string;
      title: string;
      titleAccent: string;
      subtitle: string;
      primaryCta: string;
      secondaryCta: string;
    };
    howItWorks: {
      eyebrow: string;
      title: string;
      description: string;
      steps: { title: string; body: string }[];
    };
    coverage: {
      eyebrow: string;
      title: string;
      description: string;
    };
    cta: {
      title: string;
      body: string;
      primary: string;
      secondary: string;
    };
    faq: {
      title: string;
      contactCta: string;
      items: { question: string; answer: string }[];
    };
  };

  pricing: {
    eyebrow: string;
    title: string;
    description: string;
    actions: { primary: string; secondary: string };
    signals: { label: string; value: string; hint: string }[];
    plans: {
      name: string;
      description: string;
      eta: string;
      pricing: string;
      highlight: string;
      basePriceMinor: number;
    }[];
    factors: { title: string; body: string }[];
    noteTitle: string;
    noteBody: string;
    bullets: string[];
    finalTitle: string;
    finalBody: string;
    finalPrimary: string;
    finalSecondary: string;
    scopeLabel: string;
    scopeHeading: string;
    scopeBody: string;
  };

  howItWorks: {
    story: {
      title: string;
      titleLines: [string, string, string];
      subtitle: string;
      scrollHint: string;
      backToTopAria: string;
      tutorial: {
        label: string;
        scenes: {
          title: string;
          body: string[];
        }[];
      };
      journey: {
        pickup: { title: string; body: string };
        flight: { title: string; body: string };
        dropoff: { title: string; body: string };
        revealLabel: string;
        trackOrder: string;
      };
    };
    heroEyebrow: string;
    heroTitle: string;
    heroBody: string;
    pinRuleTitle: string;
    pinRuleBody: string;
    primaryCta: string;
    secondaryCta: string;
    overview: {
      eyebrow: string;
      title: string;
      description: string;
      items: { title: string; body: string }[];
    };
    meetingPoints: {
      title: string;
      body1: string;
      body2: string;
      items: string[];
    };
    parcelProfile: {
      title: string;
      body1: string;
      body2: string;
      items: string[];
    };
    locker: {
      title: string;
      body: string;
      facts: string[];
    };
    recipient: {
      title: string;
      body: string;
      cta: string;
      steps: string[];
    };
    closing: {
      title: string;
      items: string[];
    };
    detailedFlow: {
      eyebrow: string;
      title: string;
      description: string;
      items: { title: string; body: string }[];
    };
    finalTitle: string;
    finalBody: string;
    finalPrimary: string;
    finalSecondary: string;
  };

  coverage: {
    eyebrow: string;
    title: string;
    description: string;
    summary: string;
    pillars: { title: string; body: string }[];
  };

  contact: {
    eyebrow: string;
    title: string;
    description: string;
    summary: string;
    pillars: { title: string; body: string }[];
  };

  faq: {
    eyebrow: string;
    title: string;
    description: string;
    summary: string;
    pillars: { title: string; body: string }[];
  };

  footer: {
    about: string;
    navHeading: string;
    navAria: string;
    adminLink: string;
    contactHeading: string;
    signIn: string;
    createDelivery: string;
    copyright: string;
    tagline: string;
  };
};

const ro: PublicCopy = {
  brand: { name: "SkySend", homeAria: "Acasă SkySend" },
  home: {
    story: {
      railAria: "Progresul poveștii SkySend",
      railLabels: ["Promisiune", "Sistem", "10 metri", "Ploaie", "Senin", "Ninsoare", "Start"],
      progress: {
        ariaLabel: "Progresul landing page-ului SkySend",
        labels: ["Hero", "Editorial", "Iarnă", "Cer", "Ploaie", "Final"],
      },
      backToTopAria: "Înapoi la începutul paginii",
      hero: {
        title: "SkySend",
        message: "Trimite colete rapid indiferent de trafic",
        scrollHint: "Derulează pentru a porni zborul",
      },
      editorial: {
        label: "Timpul tău, livrat",
        headline: "Livrăm mai mult decât colete. Îți redăm timpul.",
        lines: ["LIVRĂM MAI MULT DECÂT COLETE", "ÎȚI REDĂM TIMPUL"],
      },
      resilience: {
        chapterLabel: "Construit pentru orice vreme",
        railAria: "Progresul scenelor meteo",
        items: [
          {
            id: "winter",
            label: "Iarnă",
            message: "Căldura rămâne înăuntru. Frigul rămâne afară.",
            secondaryMessage: "Fiecare masă ajunge exact cum trebuie.",
          },
          {
            id: "sky",
            label: "Cer",
            message: "Construit să rămână stabil când vremea nu este.",
            secondaryMessage: "Pachetele medicale rămân protejate.",
          },
          {
            id: "rain",
            label: "Ploaie",
            message: "IP68 între coletul tău și ploaie.",
            secondaryMessage: "Uscat de la decolare la predare.",
          },
        ],
      },
      explorer: {
        eyebrow: "Sistemul SkySend",
        title: "O dronă. Un locker sigur.",
        body: "Două componente, un singur flux controlat.",
        droneHotspot: "Explorează drona",
        lockerHotspot: "Explorează lockerul",
        back: "Înapoi",
        drone: {
          title: "Rămâne deasupra.",
          body: "Drona nu trebuie să aterizeze. Troliul poziționează lockerul, iar cursa rămâne vizibilă live.",
          facts: ["Aproximativ 10 m", "Troliu controlat", "Tracking live"],
        },
        locker: {
          title: "Protecție până la deschidere.",
          body: "Lockerul coboară sigilat și se deschide numai în momentul predării.",
          facts: ["Acces cu PIN", "Etanșat la ploaie", "Rece sau cald, după colet"],
          open: "Deschide lockerul",
          close: "Închide lockerul",
        },
      },
      descent: {
        eyebrow: "Fără aterizare",
        title: "Drona rămâne sus. Lockerul vine la tine.",
        body: "O coborâre verticală, controlată, până în zona sigură de predare.",
        distance: "10 M",
      },
      weather: {
        eyebrow: "Protejat în orice vreme",
        items: [
          { label: "Ploaie", title: "Sigilat pentru drum.", body: "Apa rămâne afară. Coletul rămâne protejat." },
          { label: "Senin", title: "Temperatura potrivită.", body: "Conținutul sensibil își păstrează condițiile de transport." },
          { label: "Ninsoare", title: "Închis până la PIN.", body: "Lockerul se deschide doar când predarea este confirmată." },
        ],
      },
      cta: {
        chapterLabel: "Prima ta livrare",
        message: "De ce să aștepți zile când poate dura minute? Creează prima ta livrare și descoperă viitorul logisticii locale.",
        primary: "Creează o livrare",
        secondary: "Cum funcționează",
        partnersTitle: "Creat pentru afacerile care știu că fiecare minut contează",
        partnersAria: "Parteneri de livrare compatibili",
      },
    },
    hero: {
      eyebrow: "Livrare cu drona",
      title: "Trimite colete cu drona,",
      titleAccent: "în Pitești",
      subtitle: "Securizat. Rapid. Poți urmări de oriunde.",
      primaryCta: "Creează livrare →",
      secondaryCta: "Verifică zona",
    },
    howItWorks: {
      eyebrow: "Cum funcționează",
      title: "Trei pași de la cerere la predare.",
      description:
        "SkySend păstrează fluxul simplu: creezi un traseu valid, pregătești coletul și urmărești drona până la finalizarea livrării.",
      steps: [
        {
          title: "Setează traseul",
          body: "Alege punctul de ridicare și punctul de livrare în Pitești.",
        },
        {
          title: "Confirmă coletul",
          body: "Adaugă mărimea, detaliile de manipulare și plata.",
        },
        {
          title: "Urmărește predarea",
          body: "Urmărește ETA-ul, starea dronei și instrucțiunile compartimentului.",
        },
      ],
    },
    coverage: {
      eyebrow: "Acoperire",
      title: "Activ doar în Pitești.",
      description:
        "Fluxul de livrare verifică ambele puncte ale traseului în zona activă a orașului înainte de lansare.",
    },
    cta: {
      title: "Creează o livrare în zona activă.",
      body:
        "Dacă ambele puncte sunt în acoperirea Pitești, fluxul te ghidează prin colet, plată și urmărire live.",
      primary: "Creează livrare",
      secondary: "Cum funcționează",
    },
    faq: {
      title: "Răspunsuri rapide",
      contactCta: "Contact SkySend",
      items: [
        {
          question: "Unde funcționează SkySend?",
          answer: "În prezent, SkySend funcționează în zona activă Pitești.",
        },
        {
          question: "Ce poate bloca o comandă?",
          answer:
            "Ridicarea și livrarea trebuie să treacă verificarea de acoperire.",
        },
        {
          question: "Cine poate urmări livrarea?",
          answer:
            "Clientul vede comanda completă, iar destinatarul primește un link de urmărire dedicat.",
        },
      ],
    },
  },
  pricing: {
    eyebrow: "Tarife",
    title: "Tarife simple, afișate ca estimare live de livrare.",
    description:
      "SkySend folosește un model clar de tarifare pentru Pitești: logică de bază pentru fiecare tip de livrare și o estimare vizibilă care se poate schimba după distanță, colet, urgență și disponibilitate live.",
    actions: { primary: "Creează livrare", secondary: "Vezi acoperirea" },
    signals: [
      {
        label: "Oraș activ",
        value: "Pitești",
        hint: "Tarifele se aplică momentan doar în zona activă Pitești.",
      },
      {
        label: "Stil tarifare",
        value: "Estimare înainte",
        hint: "Interfața afișează o estimare clară înainte de confirmarea comenzii.",
      },
      {
        label: "Logică finală",
        value: "După traseu",
        hint: "Suma finală depinde de traseu, profilul coletului și contextul operațional live.",
      },
    ],
    plans: [
      {
        name: "Standard",
        description:
          "Pentru cereri normale în aceeași zi în zona activă Pitești, cu un interval echilibrat și tarifare clară.",
        eta: "25-40 min",
        pricing:
          "Începe de la {price}, apoi se ajustează ușor în funcție de distanță și manipularea coletului.",
        highlight: "Potrivită pentru livrări urbane obișnuite.",
        basePriceMinor: 2400,
      },
      {
        name: "Prioritară",
        description:
          "Pentru lansare mai rapidă când comanda trebuie să intre mai devreme în coadă și să ajungă la livrare mai repede.",
        eta: "12-25 min",
        pricing:
          "Începe de la {price}, cu o componentă de urgență mai mare și ajustare după disponibilitate.",
        highlight: "Potrivită pentru articole medicale, de birou sau sensibile la timp.",
        basePriceMinor: 3600,
      },
      {
        name: "Programată",
        description:
          "Pentru livrări planificate, când ridicarea și livrarea sunt cunoscute și intervalul poate fi rezervat.",
        eta: "Interval ales",
        pricing:
          "Începe de la {price}, apoi se ajustează după distanță și profilul coletului în intervalul rezervat.",
        highlight: "Potrivită pentru livrări previzibile zilnice sau în următorul interval.",
        basePriceMinor: 2200,
      },
    ],
    factors: [
      {
        title: "Distanță",
        body:
          "Traseele mai lungi în zona activă Pitești pot crește suma finală peste prețul de bază.",
      },
      {
        title: "Tip colet",
        body:
          "Ambalajul, mărimea și manipularea pot modifica estimarea când comanda cere altă clasă de drone sau transport mai atent.",
      },
      {
        title: "Urgență",
        body:
          "Cererile prioritare includ o componentă de urgență mai mare, deoarece pot intra mai devreme în coada de lansare.",
      },
      {
        title: "Disponibilitate operațională",
        body:
          "Starea live a flotei și capacitatea coridoarelor active pot influența estimarea finală la confirmare.",
      },
    ],
    noteTitle: "Estimările sunt operaționale, nu absolute.",
    noteBody:
      "Tarifele afișate pe această pagină sunt estimări de referință pentru serviciul curent din Pitești. Suma din fluxul de livrare poate depinde de distanță, tipul coletului, urgență și disponibilitatea operațională live la momentul confirmării.",
    bullets: [
      "Tarifarea de bază păstrează pagina clară înainte să existe o comandă.",
      "Fluxul de creare livrare întoarce o estimare specifică traseului înainte de plată.",
      "Zona curentă de serviciu rămâne concentrată pe regulile de tarifare din Pitești.",
    ],
    finalTitle: "Vezi estimarea în fluxul real de livrare.",
    finalBody:
      "Pagina de tarife explică modelul. Fluxul de comandă îl aplică pe un traseu real, cu profil de colet și urgență în zona activă Pitești.",
    finalPrimary: "Creează livrare",
    finalSecondary: "Cum funcționează",
    scopeLabel: "Domeniu tarifare",
    scopeHeading: "Model curent pentru Pitești.",
    scopeBody:
      "Structura rămâne simplă, ca tarifele să se simtă parte din produs, nu ca o broșură comercială separată.",
  },
  howItWorks: {
    story: {
      title: "RUTA CEA MAI RAPIDĂ NU ESTE ÎNTOTDEAUNA ȘOSEAUA",
      titleLines: ["RUTA CEA MAI", "RAPIDĂ NU ESTE", "ÎNTOTDEAUNA ȘOSEAUA"],
      subtitle: "Află cum câteva clickuri devin o livrare prin cer.",
      scrollHint: "Derulează pentru a continua",
      backToTopAria: "Înapoi la începutul paginii",
      tutorial: {
        label: "Tutorial creare livrare",
        scenes: [
          {
            title: "AUTENTIFICĂ-TE SAU CREEAZĂ UN CONT",
            body: [
              "Pentru a utiliza SkySend, trebuie să fii autentificat. Creează un cont sau conectează-te pentru a continua.",
            ],
          },
          {
            title: "ALEGE LOCAȚIILE",
            body: [
              "Selectează pe rând adresa de preluare și adresa de livrare, folosind marcajul de pe hartă.",
              "După confirmarea fiecărei adrese, așteaptă în timp ce SkySend identifică patru puncte de întâlnire din apropiere, unde drona poate ajunge în siguranță. Alege punctul de întâlnire preferat selectând una dintre cele patru opțiuni.",
              "După ce ambele adrese au fost confirmate, continuă la pasul următor.",
            ],
          },
          {
            title: "OFERĂ-I LUI PARCEL AI DETALII DESPRE COLETUL TĂU",
            body: [
              "Descrie coletul în detaliu, inclusiv ce trimiți, cum este ambalat și dacă există cerințe speciale de manipulare.",
              "De asemenea, poți încărca până la două fotografii. Parcel AI va estima greutatea și dimensiunile coletului.",
              "Folosește secțiunea „Detalii avansate” pentru a adăuga manual informațiile pe care le cunoști.",
              "Dacă estimarea pare corectă, continuă. În caz contrar, solicită verificarea de către un operator.",
            ],
          },
          {
            title: "CONFIGUREAZĂ LIVRAREA",
            body: [
              "Alege opțiunea de livrare care ți se potrivește cel mai bine: Standard, Prioritară sau Programată.",
              "SkySend îți va recomanda și drona cea mai potrivită pentru coletul tău, în funcție de caracteristicile estimate ale acestuia și de cerințele livrării.",
              "După ce ai verificat că toate informațiile sunt corecte, continuă la pasul următor.",
            ],
          },
          {
            title: "VERIFICĂ ȘI PLĂTEȘTE",
            body: [
              "Verifică toate detaliile livrării înainte de a confirma comanda.",
              "După ce te-ai asigurat că toate informațiile sunt corecte, efectuează plata în siguranță prin Stripe. SkySend nu stochează datele cardului tău.",
              "Selectează „Confirmă și plătește” pentru a plasa comanda.",
            ],
          },
          {
            title: "LIVRAREA TA A ÎNCEPUT",
            body: [
              "Livrarea ta este acum în desfășurare.",
              "Dacă ai selectat livrarea Standard sau Prioritară, o poți urmări din secțiunea „Livrare activă” din meniu. Deschide secțiunea „Livrare activă” pentru a accesa pagina de urmărire în timp real și pentru a urmări coletul în timp ce acesta își continuă traseul prin aer.",
            ],
          },
        ],
      },
      journey: {
        pickup: {
          title: "RIDICARE",
          body: "Drona pleacă de la SkySend Hub și ajunge la punctul de preluare. Confirmă poziția sau alege unul dintre cele patru puncte alternative; respingerea tuturor anulează comanda. După verificarea zonei, compartimentul este coborât. Deblochează-l cu PIN-ul de preluare, introdu coletul și confirmă „Colet încărcat”.",
        },
        flight: {
          title: "ZBOR",
          body: "După ce coletul este securizat, compartimentul este ridicat, iar drona își începe călătoria către punctul de întâlnire de la livrare.",
        },
        dropoff: {
          title: "LIVRARE",
          body: "Când drona ajunge la primul punct de întâlnire pentru livrare, confirmă poziția acesteia în aplicație. Drona verifică dacă zona de aterizare este sigură și coboară compartimentul la sol cu ajutorul cablului. Folosește codul PIN de livrare afișat pe pagina de urmărire pentru a debloca compartimentul și a-ți ridica coletul.",
        },
        revealLabel: "Finalizare livrare",
        trackOrder: "Urmărește comanda",
      },
    },
    heroEyebrow: "Cum funcționează",
    heroTitle: "Cum funcționează SkySend",
    heroBody:
      "De la ridicare la predare, SkySend te ghidează prin fiecare pas al unei livrări sigure cu drona în Pitești.",
    pinRuleTitle: "Regula PIN-ului compartimentului",
    pinRuleBody: "PIN-ul se folosește pe compartimentul dronei, nu pe site.",
    primaryCta: "Creează livrare",
    secondaryCta: "Verifică zona",
    overview: {
      eyebrow: "Pe scurt",
      title: "Patru decizii simple înainte de livrarea live.",
      description:
        "SkySend păstrează fluxul comenzii concentrat, dar explică și elementele diferite față de o livrare clasică.",
      items: [
        {
          title: "Setează traseul",
          body:
            "Alege punctul de ridicare și punctul de livrare în zona activă SkySend din Pitești.",
        },
        {
          title: "Pregătește coletul",
          body:
            "Adaugă mărimea, greutatea, ambalajul și detaliile de manipulare înainte de lansarea livrării.",
        },
        {
          title: "Alege drona",
          body:
            "Verifică drona recomandată, potrivirea compartimentului și timpul de lansare.",
        },
        {
          title: "Urmărește livrarea",
          body:
            "Urmărește ETA-ul, ridicarea, zborul, predarea și finalizarea livrării.",
        },
      ],
    },
    meetingPoints: {
      title: "De ce recomandă SkySend puncte de întâlnire",
      body1:
        "SkySend poate recomanda un loc apropiat în locul pinului exact, deoarece dronele au nevoie de zone accesibile și ușor de recunoscut.",
      body2:
        "Recomandările folosesc datele disponibile de hartă și traseu. Utilizatorii trebuie să respecte regulile locale și să confirme că drona este vizibilă înainte de folosirea compartimentului.",
      items: [
        "Punct lângă intrare",
        "Punct la stradă",
        "Acces din parcare",
        "Acces pietonal",
        "Intrare în parc",
      ],
    },
    parcelProfile: {
      title: "Cum estimează SkySend profilul coletului",
      body1:
        "Descrii coletul în limbaj natural, iar asistentul propune greutatea, dimensiunile, ambalajul și nivelul de fragilitate pentru potrivirea dronei.",
      body2:
        "Estimarea nu se aplică automat. Clientul verifică profilul sugerat, îl poate ajusta și îl confirmă înainte ca SkySend să folosească datele pentru configurație, ETA și cost.",
      items: [
        "Descriere în cuvintele tale",
        "Greutate estimată",
        "Dimensiuni sugerate",
        "Ambalaj și fragilitate",
        "Confirmare înainte de aplicare",
      ],
    },
    locker: {
      title: "Cum funcționează compartimentul dronei",
      body:
        "PIN-ul se folosește pe compartimentul dronei, nu pe site. SkySend afișează codul când este necesar, iar utilizatorul îl introduce direct pe tastatura fizică.",
      facts: [
        "Drona transportă un compartiment securizat suspendat.",
        "Compartimentul poate coborî când drona ajunge la punctul de întâlnire.",
        "SkySend afișează PIN-ul doar când este necesar.",
        "PIN-ul se introduce pe tastatura fizică a compartimentului dronei, nu pe site.",
        "Expeditorul folosește PIN-ul pentru încărcarea coletului.",
        "Destinatarul folosește PIN-ul pentru ridicarea coletului.",
        "„Colet încărcat” și „Colet ridicat” sunt confirmări din aplicație după finalizarea acțiunii fizice.",
      ],
    },
    recipient: {
      title: "Destinatarul vede doar ce are nevoie.",
      body:
        "Expeditorul poate trimite un link de urmărire dedicat, astfel încât destinatarul să se pregătească pentru predare fără detalii private despre client.",
      cta: "Deschide pagina de urmărire",
      steps: [
        "Expeditorul trimite destinatarului linkul de urmărire.",
        "Destinatarul vede ETA-ul, etapa curentă și instrucțiunile de predare fără cont complet de client.",
        "Detaliile private despre client, cont și plată rămân ascunse.",
        "La predare, destinatarul confirmă că drona este vizibilă înainte de folosirea compartimentului.",
        "Când primește instrucțiunea, destinatarul introduce PIN-ul pe tastatura fizică și confirmă „Colet ridicat”.",
      ],
    },
    closing: {
      title: "Ghidat, nu lăsat pe presupuneri automate.",
      items: [
        "Aplicația recomandă puncte de întâlnire ca ridicarea și predarea să fie mai ușor de înțeles.",
        "Expeditorul și destinatarul confirmă că drona este vizibilă înainte de folosirea compartimentului.",
        "SkySend nu promite că orice pin exact de pe hartă este un loc potrivit de întâlnire.",
        "Utilizatorii trebuie să respecte regulile locale și să evite zonele nesigure în timp ce așteaptă drona.",
      ],
    },
    detailedFlow: {
      eyebrow: "Flux detaliat",
      title: "De la cerere la livrare finalizată.",
      description:
        "Fluxul complet arată ce se întâmplă în aplicație și ce se întâmplă fizic la compartimentul dronei.",
      items: [
        {
          title: "Setează ridicarea și livrarea",
          body:
            "Introdu adresele sau alege puncte pe hartă. SkySend verifică dacă ambele puncte sunt în zona activă Pitești.",
        },
        {
          title: "Alege punctul de întâlnire cu drona",
          body:
            "SkySend recomandă un punct apropiat și ușor de recunoscut, precum o intrare, o zonă la stradă sau un acces din parcare.",
        },
        {
          title: "Descrie coletul",
          body:
            "Adaugă greutatea, dimensiunea, ambalajul și fragilitatea. Asistentul de colet poate estima detaliile, iar tu le poți edita manual.",
        },
        {
          title: "Alege drona și lansează livrarea",
          body:
            "SkySend recomandă o dronă compatibilă pe baza coletului, traseului și timpului estimat. Poți alege și o altă opțiune compatibilă.",
        },
        {
          title: "Verifică și plătește",
          body:
            "Verifică traseul, coletul, drona, ETA-ul, totalul estimat și detaliile livrării înainte de confirmarea plății.",
        },
        {
          title: "Urmărește drona live",
          body:
            "După confirmare, livrarea apare în spațiul client cu stare în timp real, ETA și pași următori clari.",
        },
        {
          title: "Întâlnește drona la ridicare",
          body:
            "Drona pleacă din centrul operațional SkySend Pitești către punctul de ridicare. Expeditorul confirmă că vede drona.",
        },
        {
          title: "Folosește PIN-ul compartimentului",
          body:
            "Aplicația afișează PIN-ul la momentul potrivit. Expeditorul introduce codul pe tastatura compartimentului fizic al dronei.",
        },
        {
          title: "Încarcă coletul",
          body:
            "Compartimentul se deschide sau coboară pentru încărcare. Expeditorul pune coletul înăuntru și confirmă „Colet încărcat” în aplicație.",
        },
        {
          title: "Destinatarul primește coletul",
          body:
            "Destinatarul deschide linkul de urmărire, vede ETA-ul, confirmă drona la predare, folosește PIN-ul pe tastatura fizică și ridică coletul.",
        },
        {
          title: "Livrare finalizată",
          body:
            "SkySend marchează coletul ca livrat și păstrează comanda în istoricul clientului.",
        },
      ],
    },
    finalTitle: "Creează o livrare în zona activă.",
    finalBody:
      "Începe cu acoperirea, confirmă punctele de întâlnire cu drona, apoi urmează fluxul ghidat de livrare.",
    finalPrimary: "Creează livrare",
    finalSecondary: "Vezi tarifele",
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
        body:
          "Zona inițială acoperă municipiul Pitești și împrejurimi, cu rază de serviciu configurabilă din panoul operațional.",
      },
      {
        title: "Status în timp real",
        body:
          "Verificările de eligibilitate la creare livrare folosesc aceeași sursă de date ca harta publică.",
      },
      {
        title: "Plan de extindere",
        body:
          "Următoarele orașe și ajustările de rază vor fi anunțate pe pagina de tarife și prin emailurile de operațiuni.",
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
        body:
          "Folosit pentru întrebări de tarifare, configurarea contului și suport pentru zona activă de serviciu.",
      },
      {
        title: "Întrebări operaționale",
        body:
          "Folosite pentru coordonare tehnică, pregătirea orașului și verificări de potrivire operațională.",
      },
      {
        title: "Rutare suport",
        body:
          "Folosit pentru ajutor de cont, escaladări și suport de serviciu.",
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
        body:
          "Acoperă fluxul de început, configurarea contului și disponibilitatea zonei de serviciu.",
      },
      {
        title: "Întrebări despre modelul de serviciu",
        body:
          "Acoperă constrângerile livrării, limitele zonei active și separarea rolurilor în platformă.",
      },
      {
        title: "Întrebări despre încredere operațională",
        body:
          "Acoperă escaladările, monitorizarea, conformitatea și fiabilitatea serviciului.",
      },
    ],
  },
  footer: {
    about:
      "SkySend operează o platformă de livrare cu drona pentru Pitești, cu acoperire clară, urmărire live și predări controlate.",
    navHeading: "Navigație",
    navAria: "Navigație subsol",
    adminLink: "Administrare",
    contactHeading: "Contact",
    signIn: "Autentificare",
    createDelivery: "Creează livrare",
    copyright: "Copyright 2026 SkySend. Livrare live cu drona în Pitești.",
    tagline:
      "Construit pentru operațiuni clare, trasee lizibile și predări verificate.",
  },
};

const en: PublicCopy = {
  brand: { name: "SkySend", homeAria: "SkySend home" },
  home: {
    story: {
      railAria: "SkySend story progress",
      railLabels: ["Promise", "System", "10 metres", "Rain", "Clear", "Snow", "Start"],
      progress: {
        ariaLabel: "SkySend landing page progress",
        labels: ["Hero", "Editorial", "Winter", "Sky", "Rain", "Final"],
      },
      backToTopAria: "Back to the top of the page",
      hero: {
        title: "SkySend",
        message: "Send parcels fast, regardless of traffic.",
        scrollHint: "Scroll to start the flight",
      },
      editorial: {
        label: "Your time, delivered",
        headline: "Delivering more than packages. We deliver time back to you.",
        lines: ["DELIVERING MORE THAN PACKAGES", "WE DELIVER TIME BACK TO YOU"],
      },
      resilience: {
        chapterLabel: "Built for every forecast",
        railAria: "Weather scene progress",
        items: [
          {
            id: "winter",
            label: "Winter",
            message: "The heat stays in. The cold stays out.",
            secondaryMessage: "Every meal arrives just right.",
          },
          {
            id: "sky",
            label: "Sky",
            message: "Built to stay steady when conditions aren’t.",
            secondaryMessage: "Medical packages stay protected.",
          },
          {
            id: "rain",
            label: "Rain",
            message: "IP68 between your parcel and the rain.",
            secondaryMessage: "Dry from takeoff to handoff.",
          },
        ],
      },
      explorer: {
        eyebrow: "The SkySend system",
        title: "One drone. One secure locker.",
        body: "Two components, one controlled flow.",
        droneHotspot: "Explore the drone",
        lockerHotspot: "Explore the locker",
        back: "Go back",
        drone: {
          title: "It stays above.",
          body: "The drone does not need to land. The winch positions the locker while the journey stays visible live.",
          facts: ["About 10 m", "Controlled winch", "Live tracking"],
        },
        locker: {
          title: "Protected until it opens.",
          body: "The locker descends sealed and opens only at handoff.",
          facts: ["PIN access", "Sealed against rain", "Kept cool or warm"],
          open: "Open the locker",
          close: "Close the locker",
        },
      },
      descent: {
        eyebrow: "No landing",
        title: "The drone stays high. The locker comes to you.",
        body: "A controlled vertical descent into the safe handoff zone.",
        distance: "10 M",
      },
      weather: {
        eyebrow: "Protected in any weather",
        items: [
          { label: "Rain", title: "Sealed for the journey.", body: "Water stays out. The parcel stays protected." },
          { label: "Clear", title: "The right temperature.", body: "Sensitive contents keep their transport conditions." },
          { label: "Snow", title: "Closed until the PIN.", body: "The locker opens only when handoff is confirmed." },
        ],
      },
      cta: {
        chapterLabel: "Your first delivery",
        message: "Why wait days when it can take minutes? Create your first delivery and experience the future of local logistics.",
        primary: "Create a delivery",
        secondary: "How it works",
        partnersTitle: "Built for the businesses that know every minute matters",
        partnersAria: "Compatible delivery partners",
      },
    },
    hero: {
      eyebrow: "Drone delivery",
      title: "Send parcels by drone,",
      titleAccent: "in Pitești",
      subtitle: "Secure. Fast. Track from anywhere.",
      primaryCta: "Create delivery →",
      secondaryCta: "Check the area",
    },
    howItWorks: {
      eyebrow: "How it works",
      title: "Three steps from request to handoff.",
      description:
        "SkySend keeps the flow simple: build a valid route, prepare the parcel and follow the drone through to delivery.",
      steps: [
        {
          title: "Set the route",
          body: "Choose a pickup point and a delivery point in Pitești.",
        },
        {
          title: "Confirm the parcel",
          body: "Add the size, handling details and payment.",
        },
        {
          title: "Follow the handoff",
          body: "Track the ETA, drone state and locker instructions.",
        },
      ],
    },
    coverage: {
      eyebrow: "Coverage",
      title: "Active only in Pitești.",
      description:
        "The delivery flow checks both ends of the route against the active city area before launching.",
    },
    cta: {
      title: "Create a delivery in the active area.",
      body:
        "If both points sit inside Pitești coverage, the flow guides you through parcel, payment and live tracking.",
      primary: "Create delivery",
      secondary: "How it works",
    },
    faq: {
      title: "Quick answers",
      contactCta: "Contact SkySend",
      items: [
        {
          question: "Where does SkySend operate?",
          answer: "SkySend currently operates in the active Pitești area.",
        },
        {
          question: "What can block an order?",
          answer:
            "Pickup and delivery must pass the coverage check.",
        },
        {
          question: "Who can track the delivery?",
          answer:
            "The customer sees the full order, and the recipient receives a dedicated tracking link.",
        },
      ],
    },
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Simple pricing, shown as a live delivery estimate.",
    description:
      "SkySend uses a clear pricing model for Pitești: a base logic for each delivery type and a visible estimate that adjusts with distance, parcel, urgency and live availability.",
    actions: { primary: "Create delivery", secondary: "Check coverage" },
    signals: [
      {
        label: "Active city",
        value: "Pitești",
        hint: "Pricing currently applies only in the Pitești active area.",
      },
      {
        label: "Pricing style",
        value: "Estimate first",
        hint: "The interface displays a clear estimate before order confirmation.",
      },
      {
        label: "Final logic",
        value: "Route based",
        hint:
          "The final amount depends on the route, the parcel profile and the live operational context.",
      },
    ],
    plans: [
      {
        name: "Standard",
        description:
          "For same-day requests in the Pitești active area, with a balanced time window and clear pricing.",
        eta: "25-40 min",
        pricing:
          "Starts at {price}, then adjusts slightly with distance and parcel handling.",
        highlight: "Best for regular urban deliveries.",
        basePriceMinor: 2400,
      },
      {
        name: "Priority",
        description:
          "For faster launch when the order needs to enter the queue earlier and reach delivery sooner.",
        eta: "12-25 min",
        pricing:
          "Starts at {price}, with a higher urgency component and an adjustment based on availability.",
        highlight: "Best for medical, office or time-sensitive items.",
        basePriceMinor: 3600,
      },
      {
        name: "Scheduled",
        description:
          "For planned deliveries, when pickup and drop-off are known and the window can be reserved.",
        eta: "Chosen window",
        pricing:
          "Starts at {price}, then adjusts with distance and the parcel profile inside the reserved window.",
        highlight: "Best for predictable daily deliveries or the next window.",
        basePriceMinor: 2200,
      },
    ],
    factors: [
      {
        title: "Distance",
        body:
          "Longer routes in the Pitești active area can push the final amount above the base price.",
      },
      {
        title: "Parcel type",
        body:
          "Packaging, size and handling can shift the estimate when the order requires a different drone class or a more careful transport.",
      },
      {
        title: "Urgency",
        body:
          "Priority requests include a higher urgency component, since they can join the launch queue earlier.",
      },
      {
        title: "Operational availability",
        body:
          "Live fleet state and active corridor capacity can influence the final estimate at confirmation.",
      },
    ],
    noteTitle: "Estimates are operational, not absolute.",
    noteBody:
      "Pricing shown on this page is a reference estimate for the current Pitești service. The amount in the delivery flow can depend on distance, parcel type, urgency and live operational availability at the moment of confirmation.",
    bullets: [
      "Base pricing keeps the page clear before an order exists.",
      "The delivery flow returns a route-specific estimate before payment.",
      "The current service area stays focused on the Pitești pricing rules.",
    ],
    finalTitle: "See the estimate in the real delivery flow.",
    finalBody:
      "The pricing page explains the model. The order flow applies it to a real route, with a parcel profile and urgency in the Pitești active area.",
    finalPrimary: "Create delivery",
    finalSecondary: "How it works",
    scopeLabel: "Pricing scope",
    scopeHeading: "Current model for Pitești.",
    scopeBody:
      "The structure stays simple, so the pricing feels like part of the product, not a separate commercial brochure.",
  },
  howItWorks: {
    story: {
      title: "THE FASTEST ROUTE ISN’T ALWAYS THE ROAD",
      titleLines: ["THE FASTEST", "ROUTE ISN’T", "ALWAYS THE ROAD"],
      subtitle: "Learn how a few clicks become a delivery through the sky",
      scrollHint: "Scroll to continue",
      backToTopAria: "Back to the top of the page",
      tutorial: {
        label: "Delivery creation tutorial",
        scenes: [
          {
            title: "SIGN IN OR CREATE AN ACCOUNT",
            body: ["To use SkySend, you need to be signed in. Create an account or log in to continue."],
          },
          {
            title: "CHOOSE YOUR LOCATIONS",
            body: [
              "Select your pickup and delivery addresses one at a time using the pinpoint on the map.",
              "After confirming each address, wait while SkySend finds four nearby meeting points where the drone can safely arrive. Choose your preferred meeting point by selecting one of the four options.",
              "Once both addresses have been confirmed, continue to the next step.",
            ],
          },
          {
            title: "TELL PARCEL AI ABOUT YOUR PACKAGE",
            body: [
              "Describe your package in detail, including what you are sending, how it is packaged, and any special handling requirements.",
              "You can also upload up to two photos. Parcel AI will estimate the package’s weight and dimensions.",
              "Use Advanced Details to add known information manually.",
              "If the estimate looks accurate, continue. Otherwise, request an operator review.",
            ],
          },
          {
            title: "CONFIGURE YOUR DELIVERY",
            body: [
              "Choose the delivery option that works best for you: Standard, Priority, or Scheduled delivery.",
              "SkySend will also recommend the most suitable drone for your package based on its estimated characteristics and delivery requirements.",
              "Once everything looks right, continue to the next step.",
            ],
          },
          {
            title: "REVIEW AND PAY",
            body: [
              "Review every detail of your delivery before confirming your order.",
              "When everything is correct, complete your payment securely through Stripe. SkySend does not store your card details.",
              "Select “Confirm & Pay” to place your order.",
            ],
          },
          {
            title: "YOUR DELIVERY HAS BEGUN",
            body: [
              "Your delivery is now in progress.",
              "If you selected Standard or Priority delivery, you can follow it from the Active Delivery section in the menu. Open Active Delivery to access your live tracking page and follow your package as it makes its way through the sky.",
            ],
          },
        ],
      },
      journey: {
        pickup: {
          title: "PICK UP",
          body: "The drone departs from the SkySend Hub and reaches your pickup point. Confirm its position or choose one of four alternative points; rejecting them all cancels the order. After checking the area, the locker is lowered. Unlock it with the pickup PIN, place the package inside, and confirm “Package Loaded.”",
        },
        flight: {
          title: "FLIGHT",
          body: "Once your package is secured, the locker rises and the drone begins its journey to the drop-off meeting point.",
        },
        dropoff: {
          title: "DROP OFF",
          body: "Once the drone reaches the first delivery meeting point, confirm its position in the app. The drone verifies a safe landing zone and lowers the locker to the ground by cable. Use the delivery PIN shown on the tracking page to unlock the locker and retrieve your package.",
        },
        revealLabel: "Delivery complete",
        trackOrder: "Track your order",
      },
    },
    heroEyebrow: "How it works",
    heroTitle: "How SkySend works",
    heroBody:
      "From pickup to drop-off, SkySend walks you through every step of a safe drone delivery in Pitești.",
    pinRuleTitle: "Locker PIN rule",
    pinRuleBody: "The PIN is used on the drone locker, not on the site.",
    primaryCta: "Create delivery",
    secondaryCta: "Check the area",
    overview: {
      eyebrow: "At a glance",
      title: "Four simple decisions before the live delivery.",
      description:
        "SkySend keeps the order flow focused, while also explaining what differs from a classic delivery.",
      items: [
        {
          title: "Set the route",
          body:
            "Choose a pickup point and a delivery point in the SkySend active area in Pitești.",
        },
        {
          title: "Prepare the parcel",
          body:
            "Add size, weight, packaging and handling details before launching the delivery.",
        },
        {
          title: "Pick the drone",
          body:
            "Review the recommended drone, the locker fit and the launch time.",
        },
        {
          title: "Follow the delivery",
          body:
            "Watch the ETA, the pickup, the flight, the drop-off and the completion.",
        },
      ],
    },
    meetingPoints: {
      title: "Why SkySend suggests meeting points",
      body1:
        "SkySend can suggest a nearby spot instead of an exact pin, because drones need accessible and easy-to-spot areas.",
      body2:
        "Recommendations use the available map and route data. Users must follow local rules and confirm the drone is visible before using the locker.",
      items: [
        "Spot near an entrance",
        "Spot at the street",
        "Parking access",
        "Pedestrian access",
        "Park entrance",
      ],
    },
    parcelProfile: {
      title: "How SkySend estimates the parcel profile",
      body1:
        "Describe the parcel in natural language and the assistant proposes weight, dimensions, packaging and a fragility level to match the drone.",
      body2:
        "The estimate is never applied automatically. The customer reviews the suggested profile, can tweak it and confirms it before SkySend uses the data for configuration, ETA and cost.",
      items: [
        "Describe in your own words",
        "Estimated weight",
        "Suggested dimensions",
        "Packaging and fragility",
        "Confirm before applying",
      ],
    },
    locker: {
      title: "How the drone locker works",
      body:
        "The PIN is used on the drone locker, not on the site. SkySend shows the code when needed and the user enters it directly on the physical keypad.",
      facts: [
        "The drone carries a secured suspended locker.",
        "The locker can lower once the drone reaches the meeting point.",
        "SkySend shows the PIN only when it is needed.",
        "The PIN is entered on the physical keypad of the drone locker, not on the site.",
        "The sender uses the PIN to load the parcel.",
        "The recipient uses the PIN to pick up the parcel.",
        "“Parcel loaded” and “Parcel picked up” are confirmations inside the app after the physical action is done.",
      ],
    },
    recipient: {
      title: "The recipient only sees what they need.",
      body:
        "The sender can share a dedicated tracking link, so the recipient can prepare for the drop-off without any private details about the customer.",
      cta: "Open the tracking page",
      steps: [
        "The sender sends the tracking link to the recipient.",
        "The recipient sees the ETA, the current step and the drop-off instructions without a full customer account.",
        "Private customer, account and payment details stay hidden.",
        "At drop-off the recipient confirms the drone is visible before using the locker.",
        "When prompted, the recipient enters the PIN on the physical keypad and confirms “Parcel picked up”.",
      ],
    },
    closing: {
      title: "Guided, never left to automated guesses.",
      items: [
        "The app suggests meeting points so pickup and drop-off stay easy to understand.",
        "Sender and recipient confirm the drone is visible before using the locker.",
        "SkySend does not promise that any exact pin on the map is a good meeting spot.",
        "Users must follow local rules and avoid unsafe zones while they wait for the drone.",
      ],
    },
    detailedFlow: {
      eyebrow: "Detailed flow",
      title: "From request to completed delivery.",
      description:
        "The full flow shows what happens inside the app and what happens physically at the drone locker.",
      items: [
        {
          title: "Set pickup and drop-off",
          body:
            "Enter addresses or pick points on the map. SkySend checks that both points sit inside the active Pitești area.",
        },
        {
          title: "Choose the drone meeting point",
          body:
            "SkySend suggests a nearby easy-to-spot spot, such as an entrance, a street area or a parking access.",
        },
        {
          title: "Describe the parcel",
          body:
            "Add weight, dimensions, packaging and fragility. The parcel assistant can estimate details and you can edit them manually.",
        },
        {
          title: "Pick the drone and launch the delivery",
          body:
            "SkySend recommends a compatible drone based on the parcel, the route and the estimated time. You can also pick another compatible option.",
        },
        {
          title: "Review and pay",
          body:
            "Review the route, parcel, drone, ETA, estimated total and delivery details before confirming payment.",
        },
        {
          title: "Watch the drone live",
          body:
            "After confirmation the delivery shows up in the customer area with live status, ETA and clear next steps.",
        },
        {
          title: "Meet the drone at pickup",
          body:
            "The drone leaves the SkySend Pitești operational center toward the pickup point. The sender confirms they can see the drone.",
        },
        {
          title: "Use the locker PIN",
          body:
            "The app shows the PIN at the right moment. The sender enters the code on the physical keypad of the drone locker.",
        },
        {
          title: "Load the parcel",
          body:
            "The locker opens or lowers for loading. The sender puts the parcel inside and confirms “Parcel loaded” in the app.",
        },
        {
          title: "Recipient receives the parcel",
          body:
            "The recipient opens the tracking link, sees the ETA, confirms the drone at drop-off, uses the PIN on the physical keypad and lifts the parcel out.",
        },
        {
          title: "Delivery completed",
          body:
            "SkySend marks the parcel as delivered and keeps the order in the customer history.",
        },
      ],
    },
    finalTitle: "Create a delivery in the active area.",
    finalBody:
      "Start with coverage, confirm the drone meeting points, then follow the guided delivery flow.",
    finalPrimary: "Create delivery",
    finalSecondary: "See pricing",
  },
  coverage: {
    eyebrow: "Coverage",
    title: "Coming soon — the detailed active area map.",
    description:
      "The dedicated coverage page is in preparation for Stage 6. Until then the section on the home page gives a quick look at the active perimeter in Pitești.",
    summary:
      "See the current shape of the service area and the key stats straight from the landing page.",
    pillars: [
      {
        title: "Active perimeter",
        body:
          "The initial area covers Pitești municipality and surroundings, with a configurable service radius from the operational panel.",
      },
      {
        title: "Real-time status",
        body:
          "Eligibility checks at delivery creation use the same data source as the public map.",
      },
      {
        title: "Expansion plan",
        body:
          "The next cities and radius adjustments will be announced on the pricing page and through operational emails.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "A direct line to the SkySend team.",
    description:
      "Contact stays available for operational support, billing questions and clarifications about the live service area.",
    summary:
      "This page first backs up the live product experience, with the contact area as the support route.",
    pillars: [
      {
        title: "Commercial contact",
        body:
          "Used for pricing questions, account setup and support for the active service area.",
      },
      {
        title: "Operational questions",
        body:
          "Used for technical coordination, city preparation and operational fit checks.",
      },
      {
        title: "Support routing",
        body:
          "Used for account help, escalations and service support.",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Answers with operational clarity.",
    description:
      "Frequently asked questions stay short and practical, focused on using the service, coverage limits and operational clarity.",
    summary:
      "The goal is to answer real questions quickly, without turning the product entry into a wall of documentation.",
    pillars: [
      {
        title: "Onboarding questions",
        body:
          "Covers the start flow, account setup and service area availability.",
      },
      {
        title: "Service model questions",
        body:
          "Covers delivery constraints, active area limits and role separation on the platform.",
      },
      {
        title: "Operational trust questions",
        body:
          "Covers escalations, monitoring, compliance and service reliability.",
      },
    ],
  },
  footer: {
    about:
      "SkySend operates a drone delivery platform for Pitești, with clear coverage, live tracking and verified handoffs.",
    navHeading: "Navigation",
    navAria: "Footer navigation",
    adminLink: "Admin",
    contactHeading: "Contact",
    signIn: "Sign in",
    createDelivery: "Create delivery",
    copyright: "Copyright 2026 SkySend. Live drone delivery in Pitești.",
    tagline: "Built for clear operations, readable routes and verified handoffs.",
  },
};

export const publicCopies: Record<Language, PublicCopy> = { ro, en };

export function getPublicCopy(language: Language): PublicCopy {
  return publicCopies[language] ?? publicCopies.ro;
}
