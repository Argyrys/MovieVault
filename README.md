# MovieVault

A Netflix-inspired streaming platform for movies and TV series — black & gold design, TMDB-powered catalog, curated home rows, and multi-server playback.

> This product uses the TMDB API but is not endorsed or certified by TMDB. Stream playback is provided by third-party embed providers. Only deploy with content you have the rights to distribute.

## Features

- **Netflix-style UI** — animated intro on every page load, full-bleed hero, horizontal title rows, hover cards, skeletons
- **Catalog** — browse with type/genre/year/sort filters + pagination, live search with navbar suggestions
- **Title detail** — backdrop, metadata, cast, trailer modal, similar/recommended rows
- **Watch page** — server switcher, season/episode navigation, embed players (iframes) and direct players (`hls.js` with MP4 fallback), playback position resume for direct streams
- **Streaming backend** — provider registry with DB toggles, 30-min stream cache, per-provider timeout (8s), circuit breaker, and an SSRF-guarded stream proxy (HLS manifest rewrite + byte-range passthrough)
- **Admin & downloads** — deferred (see Roadmap)

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, React Router, plain CSS design system |
| Backend | Node.js + Express (helmet, CORS, rate-limit) |
| Database | PostgreSQL in Docker (`docker-compose.yml`) |
| Metadata | TMDB API with in-memory cache + disk-cached image proxy |
| Streaming | Third-party embed providers + `hls.js` direct playback |

## Quick start

Prerequisites: Node.js 18+, Docker Desktop.

```bash
# 1. Install dependencies (root, server, client)
npm run setup

# 2. Configure environment
#    edit server/.env — at minimum set TMDB_API_KEY
#    (free key: https://www.themoviedb.org/settings/api)
#    see server/.env.example for all keys

# 3. Start PostgreSQL
docker compose up -d

# 4. Create schema + seed data (35 genres, 7 home rows, 5 providers, admin user)
npm run migrate
npm run seed

# 5. Run both servers (API :5000, client :5173)
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | API + client together (concurrently) |
| `npm run server` / `npm run client` | Run one side |
| `npm run migrate` | Apply DB migrations |
| `npm run seed` | Seed genres, home rows, providers, admin |
| `npm run build` | Production client build (`client/dist`) |
| `npm start` | Start API in production mode |

## Ports & services

- `:5000` — Express API (`/api/*`, health at `/api/health`)
- `:5173` — Vite dev server (proxies `/api` to the server)
- `:5432` — PostgreSQL container `movievault-postgres` (user/pass/db: `movievault`)

## Project structure

```
MovieVault/
├── docker-compose.yml      # PostgreSQL
├── server/
│   ├── .env.example        # all config keys
│   └── src/
│       ├── db/             # pool, migrate, seed, migrations/
│       ├── routes/         # health, catalog, stream, image, admin
│       ├── services/       # tmdb, serialize, proxyutil, providers/
│       └── app.js, index.js
└── client/
    └── src/
        ├── components/     # Navbar, HeroBanner, TitleRow/Card, players, IntroSplash…
        ├── pages/          # Home, Browse, Search, TitleDetail, Watch, Admin
        ├── lib/            # api client, formatters
        └── styles/         # global.css, variables.css (black/gold tokens)
```

## Configuration notes

- **Providers** live in the `providers` table (`enabled`, `priority`). Toggle them with SQL or the future admin panel. Currently enabled: VidLink, VidFast, AutoEmbed (embed players). VixSrc (direct HLS) and VidSrc are disabled pending the download feature / network reachability.
- **Home rows** are DB-driven (`home_rows` + `row_items`); titles marked `featured` become the hero.
- **Admin auth**: JWT-based, seeded account `admin@movievault.local` (password in `server/.env` → `ADMIN_PASSWORD`). The admin UI is deferred; API routes will land with Phase 6.
- **Stream proxy**: `/api/stream/proxy?s=<base64url>` only allows public `https` hosts (SSRF guard) and rewrites HLS manifests so segment fetches stay same-origin.

## Deferred roadmap

1. Admin panel (JWT login, row curation UI, provider toggles)
2. Download feature (direct-stream extraction, `download_stats`, VixSrc re-enable)
3. Polish extras: route-level code splitting, OG meta tags, PWA manifest
