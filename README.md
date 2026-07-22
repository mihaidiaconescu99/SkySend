# SkySend

SkySend este o aplicație web demonstrativă pentru configurarea și simularea livrărilor urbane cu drone. Include fluxuri separate pentru clienți, operatori și administratori, estimarea coletului cu AI, hărți, tracking și checkout Stripe.

> SkySend este un prototip software. Dronele, lockerul și misiunile sunt simulate, iar harta, punctele de întâlnire și estimările nu reprezintă autorizații sau validări fizice reale.

## Tehnologii

- Next.js, React, TypeScript și Tailwind CSS
- Clerk pentru autentificare și roluri
- Supabase pentru persistență
- Stripe în mod test pentru plăți
- MapLibre, Geoapify și Overpass pentru hărți și geocodare
- OpenRouter pentru funcțiile AI
- Vitest pentru testare

## Dezvoltare locală

Instalează dependențele și pornește serverul de dezvoltare:

```bash
npm install
npm run dev
```

Comenzile principale de verificare sunt:

```bash
npm run knowledge:check
npm test
npm run typecheck
npm run lint
npm run build
```

## Documentația AI Assistant

Documentația canonică pentru produs, FAQ și politici se află în:

- [`docs/ai-assistant/knowledge-base.md`](docs/ai-assistant/knowledge-base.md)
- [`docs/ai-assistant/faq.md`](docs/ai-assistant/faq.md)
- [`docs/ai-assistant/policies.md`](docs/ai-assistant/policies.md)

Aceste fișiere alimentează AI Assistant-ul, tabul Ajutor și pagina publică FAQ. După orice modificare editorială rulează:

```bash
npm run knowledge:generate
```

Artefactul `src/generated/assistant-knowledge.json` este generat determinist și nu trebuie editat manual. `npm run knowledge:check` detectează indexul neactualizat și erorile structurale din documentație.

## Structură

```text
src/       aplicație, componente, biblioteci și tipuri
docs/      documentație editorială
scripts/   generatoare și utilitare
supabase/  migrații și configurație pentru baza de date
public/    resurse statice
```

## Licență și domeniu

Proiectul este demonstrativ. Domeniul public asociat este [skysend.website](https://skysend.website/).
