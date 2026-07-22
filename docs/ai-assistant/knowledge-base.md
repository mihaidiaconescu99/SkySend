# Baza de cunoștințe SkySend

Acest document descrie funcționarea platformei SkySend. Politicile comerciale din `policies.md` au prioritate pentru răspunsurile generale, iar starea reală din cont are prioritate pentru o comandă concretă.

## [kb.general.overview] Ce este SkySend
@kind: guide
@category: general
@aliases: despre SkySend | what is SkySend | cum funcționează platforma
@keywords: platformă, dronă, prototip, livrare urbană
@href: /how-it-works

SkySend este o platformă web pentru organizarea și simularea livrărilor urbane cu drone. Clientul poate configura traseul și coletul, plăti prin Stripe și urmări misiunea, iar operatorii și administratorii au interfețe separate pentru suport și monitorizare.

Aplicația actuală este un prototip software: misiunea, drona și lockerul sunt simulate. Harta și estimările nu reprezintă autorizații reale de zbor, aterizare sau validări fizice ale coletului.

## [kb.account.authentication] Autentificare, conturi și roluri
@kind: guide
@category: account
@aliases: autentificare Clerk | cont client | user roles | login
@keywords: Clerk, Supabase, client, operator, administrator
@href: /sign-in

Autentificarea este oferită de Clerk, iar profilul aplicației este sincronizat în Supabase. Rolurile relevante sunt client, operator și administrator. Clientul își vede propriile date, operatorii gestionează misiuni și suport, iar administratorii au acces la monitorizare și setări operaționale.

Assistant-ul folosește identitatea autentificată doar pentru a filtra comenzile și plățile care aparțin contului curent. Nu poate modifica profilul sau datele contului.

## [kb.delivery.creation] Crearea unei livrări
@kind: guide
@category: delivery
@aliases: cum dau o comandă | cum trimit un colet | create delivery | place an order
@keywords: adresă, colet, configurație, checkout, comandă
@href: /client/create-delivery

După autentificare, clientul selectează adresele de ridicare și predare, confirmă câte un punct de întâlnire, descrie și estimează coletul, alege configurația și tipul livrării, verifică prețul și continuă la plata Stripe.

Chatul poate explica pașii și poate deschide pagina potrivită, dar nu poate crea, plăti, anula sau modifica o comandă.

## [kb.delivery.addresses] Adrese și acoperire
@kind: guide
@category: delivery
@aliases: verificare adresă | zonă disponibilă | address coverage
@keywords: Pitești, Argeș, rază, Geoapify, adresă
@href: /#coverage

Zona implicită este municipiul Pitești, județul Argeș, într-o rază configurabilă care are valoarea implicită de 6 km față de hub. Ambele adrese trebuie să treacă verificarea de oraș, județ, țară și distanță.

O adresă apropiată de limită poate necesita verificare suplimentară. Valoarea curentă a razei și starea platformei sunt preluate din setările operaționale, nu dintr-un răspuns memorat.

## [kb.handoff.points] Punctele de întâlnire
@kind: guide
@category: meeting-points
@aliases: meeting points | handoff | punct de aterizare | variante alternative
@keywords: patru, 4, ridicare, predare, confirmare
@href: /how-it-works

SkySend evaluează puncte stradale sau pietonale din apropierea fiecărei adrese. Pentru misiune sunt păstrate patru variante totale la ridicare și patru la predare: punctul curent și următoarele alternative.

La sosirea dronei simulate, participantul confirmă că o vede la punctul afișat sau cere următoarea variantă. Dacă toate cele patru puncte sunt respinse, misiunea este declarată eșuată și se aplică politica de rambursare integrală.

## [kb.parcel.ai] Estimarea coletului cu AI
@kind: guide
@category: parcels
@aliases: estimare greutate AI | parcel estimator | cum estimează coletul
@keywords: OpenRouter, greutate, dimensiuni, fragilitate, clarificări
@href: /client/create-delivery

Estimatorul analizează descrierea, valorile declarate, ambalarea, cantitatea, fragilitatea, sensibilitatea termică și, opțional, imaginile. Poate folosi OpenRouter, cataloage de produse și căutare de produs; dacă serviciile externe nu sunt disponibile, există o estimare deterministă locală.

Rezultatul include interval de greutate, dimensiuni, volum, riscuri, recomandări și nivel de încredere. Întrebările obligatorii trebuie clarificate înainte de confirmare, iar datele declarate și verificarea fizică au prioritate față de estimarea AI.

## [kb.parcel.images] Imaginile coletului
@kind: guide
@category: parcels
@aliases: poze colet | upload image | fotografie pentru AI
@keywords: JPEG, PNG, WebP, HEIC, 10 MB, 24 ore
@href: /client/create-delivery

Pot fi atașate maximum două imagini JPEG, PNG, WebP, HEIC sau HEIF, fiecare de cel mult 10 MB. Imaginile sunt asociate draftului propriu, normalizate pentru analiză și expiră după 24 de ore.

Imaginile sprijină estimarea, dar nu înlocuiesc descrierea, greutatea sau dimensiunile declarate și nu constituie o verificare fizică.

## [kb.parcel.limits] Limitele coletului și configurațiile
@kind: guide
@category: parcels
@aliases: cât de mare poate fi coletul | maximum package size | greutate maximă
@keywords: 12 kg, 85 litri, 70 × 50 × 36 cm
@href: /client/create-delivery

Limita maximă a platformei este 12 kg, 85 litri și 70 × 50 × 36 cm. Nu există o dimensiune minimă. Configurațiile mai mici au propriile limite, astfel încât sistemul alege modulul compatibil cu profilul confirmat.

Un colet aflat sub limita maximă poate necesita totuși clarificări sau verificare dacă ambalarea, conținutul ori datele declarate indică un risc.

## [kb.delivery.options] Standard, Priority și Scheduled
@kind: guide
@category: delivery
@aliases: tipuri de livrare | standard priority scheduled | programare
@keywords: Standard, Prioritară, Programată, ETA
@href: /pricing

Standard este opțiunea obișnuită, Priority aplică un multiplicator de prioritate, iar Scheduled permite alegerea unei date și ore. În prototip, programarea este disponibilă începând de la aproximativ 20 de minute în viitor și în următoarele 7 zile.

ETA-ul exact este calculat în fluxul comenzii. Pagina publică afișează orientativ 25–40 de minute pentru Standard și 12–25 de minute pentru Priority.

## [kb.pricing.calculation] Calcularea prețului
@kind: guide
@category: payments
@aliases: cât costă | price calculation | tarif livrare
@keywords: taxă de bază, distanță, fragilitate, greutate, configurație
@href: /pricing

Prețul combină taxa de bază și distanța cu ajustări pentru configurația de transport, prioritate sau programare, greutate, fragilitate, protecție termică, securizare, dimensiuni și complexitatea traseului.

Assistant-ul poate explica formula și tarifele publice curente, dar prețul final este cel afișat în revizuirea comenzii înainte de plată.

## [kb.payments.stripe] Plata și datele cardului
@kind: guide
@category: payments
@aliases: Stripe card security | unde este stocat cardul | checkout
@keywords: Stripe, payment intent, payment method, CVV, card
@href: /client/payment-methods

Plățile și metodele de card sunt gestionate de Stripe. SkySend păstrează în comenzile și istoricul său identificatori tehnici precum referința PaymentIntent, Charge sau Refund, suma, moneda și statusul, nu numărul complet al cardului ori codul CVV.

Metodele salvate sunt citite din contul Stripe și sunt afișate doar prin marcă, ultimele patru cifre și expirare. Implementarea curentă folosește chei Stripe de test.

## [kb.tracking.statuses] Statusuri și tracking
@kind: guide
@category: tracking
@aliases: unde este comanda | order status | live tracking
@keywords: pending, in_progress, completed, failed, cancelled
@href: /tracking

O comandă persistată poate fi `pending`, `in_progress`, `completed`, `failed` sau `cancelled`. Misiunea oferă etape mai detaliate: pregătire, zbor spre ridicare, confirmarea poziției, încărcare, tranzit, predare, finalizare ori eșec.

Expeditorul vede detaliile private în cont. Destinatarul poate folosi un cod sau link de tracking cu permisiuni limitate, fără acces la informații de plată sau cont.

## [kb.handoff.pin-locker] PIN-uri și locker
@kind: guide
@category: handoff
@aliases: de ce am două PIN-uri | locker nu se deschide | pickup pin | delivery pin
@keywords: PIN, 4 cifre, ridicare, predare, locker
@href: /how-it-works

Misiunea generează două PIN-uri distincte de patru cifre: unul pentru expeditor la încărcare și unul pentru destinatar la predare. Separarea limitează fiecare cod la etapa și participantul potrivit.

În simularea actuală, codul este afișat în tracking, se folosește pe tastatura lockerului simulat, apoi participantul confirmă încărcarea sau ridicarea. O problemă reală de PIN ori locker necesită ticket către operator.

## [kb.handoff.timeouts] Confirmări și limite de timp
@kind: guide
@category: handoff
@aliases: cât timp am la dronă | confirmation timeout | nu sunt la meeting point
@keywords: 10 minute, confirmare, încărcare, ridicare
@href: /tracking

Politica acordă 10 minute pentru confirmarea punctului, 10 minute pentru încărcare și 10 minute pentru ridicarea coletului la destinație. Timerele operaționale sunt configurabile și au valoarea implicită de 10 minute.

La expirare, comanda este oprită automat și nu se acordă rambursare conform politicii oficiale.

## [kb.support.roles] Operatori, administratori și suport
@kind: guide
@category: support
@aliases: ce face operatorul | admin role | suport uman
@keywords: operator, administrator, ticket, misiune
@href: /client/support

Operatorii gestionează misiuni, evaluări de colete, alerte și conversații de suport. Administratorii monitorizează comenzile, incidentele, recuperările de locker, statisticile și setările operaționale.

Assistant-ul nu poate lua decizii administrative în locul lor. Când intervenția umană este justificată, cere confirmarea înainte de a crea un ticket.

## [kb.privacy.retention] Date personale și retenție
@kind: guide
@category: security
@aliases: cât păstrați datele | conversation retention | privacy
@keywords: 90 zile, 24 ore, conversații, imagini
@href: /client/settings

Conversațiile assistant-ului și ticket-urile asociate expiră după 90 de zile. Imaginile temporare folosite de Parcel AI expiră după 24 de ore. Ștergerea contului elimină ori anonimizează datele personale conform relațiilor necesare pentru istoricul operațional.

Assistant-ul nu poate consulta datele altor utilizatori și nu primește date complete de card, secrete sau configurații interne.
