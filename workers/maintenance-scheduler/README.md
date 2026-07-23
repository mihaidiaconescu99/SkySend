# SkySend maintenance scheduler

Workerul rulează la fiecare minut și apelează un singur endpoint agregator protejat, `/api/cron/maintenance`. Agregatorul execută:

- expirarea acțiunilor de misiune;
- reconcilierea refundurilor;
- comunicările programate;
- verificarea meteo idempotentă, o singură dată pe oră;
- hold/reluare pentru misiunile aflate în preflight;
- generarea și retry-ul documentelor PDF.

Cronul zilnic Vercel pentru atașamentele temporare rămâne separat. Documentele din prefixul privat R2 `billing/` nu primesc expirare.

## Publicare

Din acest director:

```powershell
npx wrangler login
npx wrangler secret put SKYSEND_ORIGIN
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

`SKYSEND_ORIGIN` este domeniul public fără slash final, iar `CRON_SECRET` trebuie să fie identic cu valoarea din Vercel. Nu salva secretele în fișier.
