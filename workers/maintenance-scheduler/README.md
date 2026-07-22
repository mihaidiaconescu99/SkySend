# SkySend maintenance scheduler

Acest Worker înlocuiește cron-urile Vercel care trebuie să ruleze la minut:

- expirarea acțiunilor de misiune;
- reconcilierea refundurilor.

Imaginile Parcel AI sunt șterse imediat când clientul le elimină, părăsește pasul coletului sau finalizează comanda. Politica lifecycle R2 rămâne protecția finală; cron-ul zilnic Vercel continuă să curețe atașamentele generale.

## Publicare

Din acest director, autentifică-te în contul Cloudflare care conține bucketul R2, apoi setează aceleași valori folosite deja de aplicația Vercel:

```powershell
npx wrangler login
npx wrangler secret put SKYSEND_ORIGIN
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

La `SKYSEND_ORIGIN` introdu domeniul public al aplicației, fără slash final, de exemplu `https://skysend.vercel.app`. La `CRON_SECRET` introdu exact aceeași valoare configurată în Vercel. Nu salva aceste valori în fișier.

Workerul rulează la fiecare minut și apelează intern endpointurile Vercel protejate. După publicarea workerului, cron trigger-ul poate avea nevoie de câteva minute până se propagă.
