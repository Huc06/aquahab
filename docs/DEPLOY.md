# Deploy on Railway

One Railway project, three services. Only the web service is public.

```
Telegram ──https──▶ web (Next.js, public domain) ──/api/*, /telegram/webhook──▶ server (private) ──▶ Postgres (private)
browser  ──https──▶ web
```

The web app proxies `/api/*` and `/telegram/webhook` to the crew server over Railway's private network, so the
server needs no public domain. Memories live on Walrus; Postgres holds the server's ledger (rooms, briefs,
debriefs, the board, the Telegram pairing).

## 1. Create the project (Hulk, owner)

1. **New project → Deploy from GitHub repo** → `Huc06/aquahab`. Name the service **`server`**, and in
   Settings set **Root Directory** to `server`.
2. **+ New → GitHub repo** → the same repo again. Name it **`web`**, Root Directory `web`.
3. **+ New → Database → PostgreSQL**. Keep the name **`Postgres`**.
4. Project **Settings → Members**: invite `yukitran03` (John), who enters the server's secrets.

The names matter: the web service reaches the server at `server.railway.internal`.

## 2. `server` service

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build | Railpack detects pnpm (`packageManager`) and Node (`engines`). No build command. |
| Start command | `pnpm start` (the default from `package.json`) |
| Healthcheck path | `/healthz` (no Walrus, Tatum or database call) |
| Replicas | **1**. The scheduler and the Telegram webhook run in this process; two replicas would send two briefs. |
| Public domain | none |
| Watch paths (optional) | `/server/**`, so a web-only commit does not redeploy the server |

Variables. John enters the values from his `server/.env.local`; they never go in the repo, an issue or a chat.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (turns on the guards: no mock, no `AUTH=off`, `DATABASE_URL` required) |
| `PORT` | `8787` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (a reference to the Postgres service) |
| `MEMWAL_SERVER_URL` | `https://relayer.memory.walrus.xyz` |
| `MEMWAL_ACCOUNT_ID`, `AQUAHAB_OWNER_ADDRESS` | from `.env.local` |
| `MEMWAL_KEY_ONE`, `_RESEARCHER`, `_BUILDER`, `_LOFI`, `_HIPPO`, `_KEEPER` | from `.env.local` (the six crew keys) |
| `TATUM_API_KEY` | Hulk's Tatum mainnet key (the Tatum ID on the form) |
| `APP_SECRET` | from `.env.local`. **Never change it**: it signs sessions and private-room aliases. |
| `CEO_API_TOKEN`, `CRON_SECRET` | from `.env.local` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_PAIR_CODE`, `TELEGRAM_WEBHOOK_SECRET` | from `.env.local` |
| `TELEGRAM_MODE` | `webhook` |
| `APP_URL` | `https://<the web service's public domain>` |
| `CEO_TIMEZONE` | `Asia/Ho_Chi_Minh` |
| `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | once the LLM is chosen (`server/.env.example`) |

Never set on Railway: `MEMORY_MODE`, `AUTH`, `SCHEDULER=off`, `TELEGRAM_WEBHOOK_URL` (not needed), or the owner
key (`.env.owner.local` stays offline; it is only for `pnpm account`).

## 3. `web` service

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Build / start | `pnpm build` / `pnpm start` (Railpack defaults for Next.js; `next start` listens on Railway's `PORT`) |
| Healthcheck path | `/` |
| Public domain | **Settings → Networking → Generate Domain**. This URL is `APP_URL` on the server. |
| Watch paths (optional) | `/web/**` |

Variables:

| Variable | Value |
|---|---|
| `API_ORIGIN` | `http://server.railway.internal:8787` |

`API_ORIGIN` is read when the web app is built (Next.js rewrites), so redeploy `web` after changing it. Do not
set `NODE_ENV` on `web`: Next.js sets it, and the build needs the dev dependencies.

## 4. Cut-over from the laptop (John, once)

1. **Stop the laptop server.** Telegram delivers updates to one consumer only.
2. Railway → Postgres → **Connect** → copy the public connection URL.
3. Copy the ledger, so the rooms keep their day count and the day-one brief, the board and the pairing survive:
   ```bash
   cd server
   DATABASE_URL='<public Postgres URL>' pnpm db:copy      # safe to re-run
   ```
4. Deploy `server`, then `web`. The server log shows
   `[telegram] webhook set to https://<web>/telegram/webhook`.
5. Run the smoke test below.

From then on nobody polls the production bot. Local development uses `TELEGRAM_MODE=off`, or a separate dev bot
from @BotFather with its own token and pair code.

## 5. Smoke test

- `https://<web>/api/health`: `mode: mainnet`, relayer `ok`, Tatum `ok`.
- Telegram: `/menu` answers. `/web` opens the office as CEO.
- `/brief` returns a brief with receipts. A capture such as `n: <a real next step>` reaches `stored` with a blob id.
- Office: Rooms, Memory (verified on Sui) and Board show the same data as before the cut-over.

## Notes

- **Neon works too.** A `DATABASE_URL` on `*.neon.tech` uses Neon's HTTP driver; any other Postgres uses
  node-postgres.
- **Long requests.** The web proxy allows 300 s per request (`experimental.proxyTimeout`), so a brief or a debrief
  is not cut at Next's default 30 s. `/api/events` streams reconnect with `Last-Event-ID` after that.
- **Telegram webhook.** The server answers Telegram at once and handles the update after, and it drops an update
  Telegram resends, so a slow brief is not handled twice.
