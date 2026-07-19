# Parcel AI: configurare catalog și retenție R2

## Catalog gratuit

Open Food Facts nu necesită cheie API. Setează doar `OPEN_FOOD_FACTS_USER_AGENT` cu numele aplicației și o adresă de contact.

Pentru Open Icecat, creează un cont gratuit la https://icecat.com/content-subscription/ și copiază datele de acces primite în `ICECAT_USERNAME` și `ICECAT_PASSWORD`. Dacă lipsesc, SkySend omite Icecat și continuă cu Open Food Facts, Tavily și estimarea AI.

## OpenRouter vision gratuit

`OPENROUTER_PARCEL_VISION_MODEL=openrouter/free` este valoarea implicită. Nu este necesară o cheie suplimentară față de `OPENROUTER_API_KEY`. La fiecare perioadă de cache, SkySend verifică Models API; dacă routerul nu mai declară suport pentru imagini, selectează doar un fallback gratuit compatibil sau păstrează estimarea locală.

## R2: expirare imagini Parcel AI

Configurează regula lifecycle pentru prefixul `parcel-ai/` și expirare după 1 zi. Poți folosi scriptul de mai jos; acesta păstrează regulile lifecycle existente și actualizează doar regula Parcel AI:

```powershell
node --env-file=.env.local scripts/configure-parcel-ai-r2-lifecycle.mjs
```

Sunt necesare variabilele R2 existente (`CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`). R2 poate elimina fizic obiectul după momentul de expirare; SkySend oprește accesul aplicației exact la 24 de ore și cron-ul curăță metadatele.
