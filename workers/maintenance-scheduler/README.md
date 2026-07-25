# SkySend maintenance scheduler

Workerul rulează la fiecare 5 minute și apelează endpoint-ul agregator protejat, `/api/cron/maintenance`. Agregatorul execută:

- expirarea acțiunilor de misiune;
- reconcilierea refundurilor;
- comunicările programate;
- verificarea meteo idempotentă, o singură dată pe oră;
- hold/reluare pentru misiunile aflate în preflight;
- generarea și retry-ul documentelor PDF.

La ora 03:00 UTC, același Worker apelează separat `/api/cron/purge-expired-attachments`. Nu mai există Cron Jobs configurate în Vercel. Documentele din prefixul privat R2 `billing/` nu primesc expirare.

## Publicare

Din acest director:

```powershell
npx wrangler login
npx wrangler secret put SKYSEND_ORIGIN
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

`SKYSEND_ORIGIN` este domeniul public fără slash final, iar `CRON_SECRET` trebuie să fie identic cu valoarea configurată în aplicația găzduită. Nu salva secretele în fișier.
