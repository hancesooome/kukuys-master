<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite" alt="SQLite" />
</p>

<h1 align="center">Kukuys Master</h1>
<p align="center">
  <strong>A Dota 2 Team Manager & Gacha Experience</strong>
</p>
<p align="center">
  <a href="https://github.com/hancesooome/kukuys-master">View on GitHub</a>
</p>
<p align="center">
  Build your roster, grind the bootcamp, enter tournaments, and lead Team Kukuys to glory.
</p>

---

## ✨ Overview

**Kukuys Master** is a polished, single-player game that blends team management with gacha-style recruitment. Manage your Dota 2 roster, train players, enter double-elimination tournaments, and watch Team Kukuys compete with simulated commentary and Challonge-style brackets.

### Core Features

| Feature | Description |
|---------|-------------|
| **Bootcamp** | Manage players, assign grinding and sleep sessions to improve stats (mechanics, drafting, mental strength, trashtalk) |
| **Roster** | Build your starting 5 and optimize lineups with radar stats |
| **Shop** | Recruit players via gacha (Common → Mythic tiers) and recycle extras for coins |
| **Match** | Enter double-elimination tournaments with Upper/Lower brackets and Grand Final |
| **Commentary** | Live-style commentary for Kukuys matches with map-by-map results |
| **Rates** | Transparent drop rates and player pool per tier |

---

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion (Framer Motion), Lucide Icons
- **Backend:** Express, better-sqlite3
- **Data:** Liquipedia Dota 2 API (player photos, teams)
- **AI:** Google Gemini API (optional)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+  
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/hancesooome/kukuys-master.git
cd kukuys-master

# Install dependencies
npm install

# Copy environment template (optional)
cp .env.example .env.local
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

### Deploying (Vercel frontend + Railway backend)

Vercel only serves the **static frontend**. The Express API and SQLite backend must run elsewhere.

#### Step 1: Deploy backend to Railway

1. Go to [railway.app](https://railway.app) and sign in (GitHub).
2. **New Project** → **Deploy from GitHub repo** → select your `kukuys-master` repo.
3. Railway will detect Node. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** (leave default)
4. Under **Settings** → **Networking** → **Generate Domain** — you’ll get a URL like `https://kukuys-master-production-xxxx.up.railway.app`.
5. Copy that URL. You’ll need it for Vercel.
6. (Optional) Add env vars under **Variables** — e.g. `NODE_ENV=production`. Supabase vars can be added here if you use them on the backend.
7. **Note:** On Railway’s free tier, the SQLite database is ephemeral — data resets on redeploy. For persistent data, use Railway volumes (paid) or migrate to Supabase/Postgres later.

#### Step 2: Point Vercel frontend to Railway

1. In your **Vercel** project → **Settings** → **Environment Variables**
2. Add: **Name** `VITE_API_URL`, **Value** your Railway URL (e.g. `https://kukuys-master-production-xxxx.up.railway.app`), **no trailing slash**.
3. **Redeploy** the Vercel project so the new env var is used.
4. Open your Vercel URL — the app should load and call the Railway API.

---

## 📁 Project Structure

```
kukuys-master/
├── src/
│   └── App.tsx          # Main React app (bootcamp, roster, shop, match, rates)
├── server.ts            # Express API, SQLite, Liquipedia, tournament logic
├── kukuy_master.db      # SQLite database (created on first run)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🎮 Game Flow

1. **Recruit** players in the Shop (200 coins per pull).
2. **Add** 5 players to your Roster from your collection.
3. **Grind** and **Sleep** in Bootcamp to improve stats and energy.
4. **Enter** a tournament when your roster is ready.
5. **Watch** matches reveal with commentary for Team Kukuys games; click **Start game** to begin.
6. **Win** the Grand Final to earn Kukuys coins and become champion.

---

## 📜 Liquipedia

Player photos and team data come from [Liquipedia Dota 2](https://liquipedia.net/dota2/). The app follows their [API terms](https://liquipedia.net/api-terms-of-use):

- **Rate limits:** 1 request / 2 seconds (general), 1 / 30 seconds for `action=parse`
- **User-Agent:** Requests identify as `KukuysMaster/1.0`
- **Caching:** 24-hour cache to reduce API usage

If you see "Your IP address has been temporarily blocked", wait for the block to expire. The app stays within allowed limits under normal use.

---

## 📄 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite + Express) |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run lint` | TypeScript type-check |

---

## 📜 License

MIT

---

<p align="center">
  <strong>Developed by Hance Dagondon</strong>
</p>
