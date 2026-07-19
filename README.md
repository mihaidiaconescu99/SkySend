SkySend

---

## Ghid operațional și de produs

Această secțiune documentează comportamentul implementat în aplicație. SkySend este un prototip de livrare urbană cu drone: interfețele, urmărirea și operațiunile simulează o misiune, iar validarea finală fizică a unei zone, a coletului sau a unei drone nu este făcută de aplicație.

### Roluri, conturi și acces

- Autentificarea este oferită de Clerk. După autentificare, profilul este sincronizat în Supabase și primește unul dintre rolurile `client`, `operator`, `admin` sau `suport`.
- Zona `/client` necesită rolul de client, iar `/operator` necesită rolul de operator. Administratorii și suportul pot accesa spațiul administrativ, cu controale suplimentare în pagină.
- Un client își vede numai propriile comenzi, adrese, metode de plată și notificări. Rutele API verifică utilizatorul autentificat și proprietatea comenzii.
- Urmărirea publică folosește un cod de tracking sau un token destinat destinatarului. Aceasta este diferită de vizualizarea privată din tabul **Comenzi**.

### Parcursul complet al unei livrări

1. Clientul se autentifică și deschide **Creează livrare**.
2. Alege adresele de ridicare și de livrare pe hartă sau din căutarea de adrese. Pentru fiecare adresă, SkySend propune puncte de întâlnire/handoff potrivite pentru operațiunea simulată.
3. Descrie coletul. Estimatorul poate cere clarificări și propune greutate, dimensiuni, nivel de fragilitate, ambalare, riscuri și o clasă de dronă. Valorile declarate trebuie verificate înainte de confirmare.
4. Clientul confirmă profilul coletului, apoi alege livrare standard, prioritară sau programată. Pentru o livrare programată selectează data și ora.
5. Ecranul de revizuire folosește adresele, punctele de handoff, profilul coletului și configurația de transport pentru a calcula estimarea. Clientul continuă către checkout Stripe și alege o metodă de plată.
6. După salvare/plată, comanda apare în dashboard și poate fi urmărită. Starea operațională evoluează de la recepție și verificare, spre pregătire, ridicare, tranzit, predare și închidere sau recuperare.

Aplicația nu permite crearea unei livrări direct din chat și nici plata direct din chat. Pentru un preț sau timp estimat corect, folosește fluxul **Creează livrare**: acesta aplică adresa, coletul, punctele de handoff și configurația reală.

### Acoperire și puncte de handoff

- Zona activă configurată implicit este Pitești, județul Argeș, România, cu o rază de 6 km față de centrul operațional. Adresele trebuie să fie în zonă și să corespundă orașului, județului și țării configurate.
- O adresă aproape de limită poate fi marcată pentru verificare suplimentară. O adresă din afara zonei nu poate fi confirmată pentru serviciul curent.
- În timpul alegerii adresei, SkySend caută puncte de întâlnire din apropiere. Acestea sunt recomandări operaționale, nu o garanție că o dronă poate ateriza în teren. Utilizatorul confirmă punctul selectat înainte de expediere.

### Colete, restricții și drone

- Estimatorul acceptă descrieri în limbaj natural și poate folosi detalii precum ambalarea, greutatea declarată, dimensiunile, cantitatea, sensibilitatea termică și fragilitatea.
- Clasele de dronă/configurațiile au limite diferite de greutate, volum și dimensiuni. Cea mai mare configurație curentă acceptă maximum 12 kg, 85 L și 70 × 50 × 36 cm; un colet poate fi totuși blocat sau trimis spre verificare dacă ambalarea, fragilitatea, lichidele sau datele lipsă indică risc.
- Greutatea declarată și volumele explicite sunt informații importante pentru estimare. Lichidele sunt evaluate ținând cont de volum și recipient; o greutate fizic imposibilă este semnalată pentru clarificare.
- Marcajele de risc, ambalarea recomandată și clasa de dronă sunt recomandări. Confirmarea fizică a greutății și a securizării coletului are prioritate la ridicare.

### Lockere, siguranță și misiune

În simularea operațională, compartimentul/lockerul dronei poate coborî la ridicare și la predare. Clientul confirmă poziția, folosește PIN-ul când este solicitat, încarcă sau ridică coletul și lockerul este securizat înainte ca misiunea să continue. Dacă predarea nu poate fi finalizată, sistemul poate opri misiunea, solicita suport, iniția recuperarea lockerului sau returnarea la hub.

Nu bloca zona de handoff, nu încărca un colet care nu corespunde profilului confirmat și nu considera harta o autorizare de zbor sau aterizare reală. Pentru un incident de locker, plată sau predare, consultă detaliile comenzii și notificările; administratorii și operatorii au fluxuri dedicate de recuperare și soluționare.

### Comenzi, urmărire și stări

În baza de date, o comandă poate fi `pending`, `in_progress`, `completed`, `failed` sau `cancelled`. În interfața operațională acestea sunt prezentate în termeni ușor de citit, de exemplu „în așteptare”, „în zbor” sau „livrare finalizată”. Nu toate ecranele folosesc aceleași etichete, dar ele reprezintă aceeași progresie.

Fluxul de tracking poate afișa: comandă primită, verificare acoperire/colet, dronă alocată, ridicare în așteptare, tranzit, așteptarea destinatarului, livrată sau o stare de oprire/recuperare. Detaliile unei comenzi autentificate sunt disponibile în **Client → Comenzi**; pentru un cod public, folosește pagina **Urmărește comanda**.

### Plăți și facturare

Plățile sunt procesate prin Stripe. SkySend păstrează doar referințe către metodele de plată Stripe și înregistrările operaționale, nu datele complete ale cardului. Statusurile uzuale includ în așteptare, plătită, eșuată și rambursată. Pentru o plată eșuată sau o rambursare, deschide comanda sau istoricul de plăți; chatul poate explica următorul pas, dar nu procesează plăți.

### Dashboard-uri

- **Client:** creează livrări, consultă livrarea activă, comenzile, locațiile salvate, metodele de plată, istoricul, notificările și setările.
- **Operator:** urmărește misiunile, pregătirea dronelor/pad-urilor și alertele operaționale. Evaluarea finală a coletelor și a excepțiilor se face în acest flux, nu prin chat.
- **Administrator:** monitorizează comenzile, comenzile eșuate, recuperările de lockere, mesajele de contact, statisticile și setările operaționale. Unele controale administrative din prototip sunt păstrate local în browser; acestea nu reprezintă încă o consolă operațională multi-utilizator în timp real.

### Impact de mediu

SkySend afișează estimări de CO2e evitat, distanță rutieră evitată și energie folosită. Acestea compară livrarea cu un scenariu urban rutier conservator și sunt orientative, nu declarații de emisii măsurate sau certificate.

### Întrebări frecvente

**Pot afla prețul sau timpul de livrare în chat?** Nu cu precizie. Creează o livrare pentru ca SkySend să folosească adresele, punctele de handoff, coletul și configurația reală.

**Poate chatul să creeze sau să plătească o comandă?** Nu. Chatul te direcționează către pagina corectă, iar checkout-ul rămâne în fluxul securizat Stripe.

**Poate fi livrat orice colet?** Nu automat. Limitele de transport, dimensiunile, volumul, greutatea, ambalarea, fragilitatea și datele insuficiente pot necesita clarificare, alegerea unei alte configurații sau verificare operațională.

**Ce fac dacă nu pot găsi comanda?** Autentifică-te în contul care a creat-o și deschide **Comenzi**. Pentru urmărirea destinatarului, folosește codul sau linkul public primit.

**Ce fac dacă adresa pare în afara zonei?** Verifică adresa exactă în fluxul de creare a livrării sau pe pagina de acoperire. Serviciul actual este limitat la zona activă din Pitești.

SkySend este o platformă web care explorează posibilitatea livrării coletelor cu ajutorul dronelor în mediul urban. Aplicația acoperă întregul proces de livrare, de la plasarea unei comenzi până la urmărirea acesteia, oferind în același timp interfețe dedicate pentru clienți, operatori și administratori.

Proiectul este dezvoltat folosind Next.js, React, TypeScript, Supabase, Clerk, Stripe, MapLibre, Overpass și Geoapify.

⸻

Funcționalități

* autentificare și gestionarea utilizatorilor pe roluri;
* creare și urmărire comenzi;
* selectarea adreselor de ridicare și livrare pe hartă;
* estimarea caracteristicilor coletului cu ajutorul inteligenței artificiale;
* mai multe opțiuni de livrare (standard, prioritară și programată);
* generarea unui link de partajare a accesului la livrarea unei comenzi in desfasurare;
* plăți online prin Stripe;
* salvarea datelor de la cardurile folosite anterior securizata pentru plati viitoare folosind pointer la cardul de pe stripe fara a salva date personale pe site;
* panou dedicat clienților pentru gestionarea comenzilor;
* panou de administrare pentru monitorizarea platformei;
* design responsive, adaptat atât pentru desktop, cât și pentru dispozitive mobile.

⸻

Tehnologii utilizate

Categorie	    Tehnologie
Framework	    Next.js
Frontend	    React, TypeScript
Stilizare	    Tailwind CSS
Autentificare	Clerk
Bază de date	Supabase
Plăți	        Stripe
Hărți	        MapLibre, Geoapify, Overpass
Inteligență     Artificială	OpenRouter
Testare	        Vitest

⸻

Structura proiectului

src/
 ├── app/
 ├── components/
 ├── hooks/
 ├── lib/
 ├── styles/
 └── types/
public/
docs/
scripts/
supabase/

Codul este organizat pe module separate pentru partea publică a aplicației, zona destinată clienților, panoul de administrare, interfața operatorilor și rutele API.

⸻

*PROCESUL DE CREARE A UNEI LIVRARI*

*Pentru a intra pe aplicatia de livrari trebuie sa fi conectat la un cont
1.Dupa ce ai intrat pe platforma selectezi fie de pe harta fie prin adresă punctul de ridicare a coletului si punctul de livrare, iar site ul va gasi minimum 3 zone pentru fiecare unde drona poate ateriza cat mai aproape de locatia selectata de utilizator si il va alege pe cel mai apropiat, acesta se poate schimba apasand pe unul din celelalte puncte de intalnire;

2.Dupa ce ai confirmat punctele urmeaza sa introduci intr un box cea mai complexa descriere pe care o poti face despre ce vrei sa trimiti, dupa care verifica si apasa pe estimeaza AI verifici daca AI ul are vreo intrebare pentru tine si daca nu, apesi pe confirma estimarea;

3.După ce ai confirmat estimarea coletului, verifici datele generate: greutate, dimensiuni, fragilitate și recomandările pentru transport. Dacă ceva nu este corect, modifici descrierea sau completezi răspunsurile cerute de AI;

4.Apoi alegi tipul livrării: standard, prioritară sau programată. Dacă alegi livrare programată, selectezi data și ora la care vrei să fie făcută livrarea;

5.După aceea ajungi la verificarea finală, unde controlezi toate datele comenzii: punctul de ridicare, punctul de livrare, zonele unde poate ateriza drona, detaliile coletului, tipul livrării și prețul estimat.Dacă totul este corect, continui către plată, alegi metoda de plată și finalizezi comanda;

După plată, livrarea este salvată în contul tău și o poți urmări în pagina de comenzi sau în secțiunea de livrare activă până când coletul ajunge la destinație.
⸻

Despre proiect

SkySend a fost realizat ca un proiect demonstrativ care urmărește integrarea mai multor tehnologii moderne într-o singură aplicație. Platforma combină servicii de hărți, autentificare, procesarea plăților și estimarea coletelor cu ajutorul inteligenței artificiale pentru a simula funcționarea unui sistem de livrare cu drone. Deși reprezintă un prototip, aplicația este construită folosind o arhitectură apropiată de cea întâlnită în proiectele reale.
Livrarea propriu-zisă este simulată, dar este afișată în aplicație ca o livrare reală, pentru a reproduce cât mai bine experiența unui utilizator. Logica site-ului este însă limitată de faptul că procesul de livrare este fictiv și nu există o dronă reală, senzori reali sau verificări fizice directe. De exemplu, aplicația nu poate confirma cu certitudine dacă o dronă poate ateriza într-un anumit loc și nu poate cântări greutatea reală a coletului. Din acest motiv, estimările, punctele de aterizare și constrângerile operaționale trebuie privite ca rezultate ale unei simulări, nu ca validări reale de teren.

⸻

Licență

Domeniul site-ului este gândit pentru a reprezenta clar identitatea SkySend acesta fiind cumparat oficial pe o perioada de un an: https://skysend.website/
