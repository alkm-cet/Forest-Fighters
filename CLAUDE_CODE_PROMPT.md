# Claude Code Prompt — Cozy Battle MVP

## Context

Read CLAUDE.md fully before starting. It contains the full project reference including schema, routes, tech stack, and MVP scope.

This is a monorepo with two folders:
- `backend/` — Node.js + Express API
- `frontend/` — React Native with Expo

Both folders already exist. Your job is to set them up from scratch for the MVP.

---

## Your Task

Set up the MVP. This means:

1. Install all dependencies in both `backend/` and `frontend/`
2. Set up the backend with working auth and database connection
3. Set up the frontend with a login screen and a basic main screen
4. Make sure everything connects end-to-end

Follow the steps below in order.

---

## Step 1 — Backend Setup

Work inside the `backend/` folder.

### 1.1 — Install dependencies

```bash
cd backend
npm init -y
npm install express pg @neondatabase/serverless jsonwebtoken bcrypt cors dotenv
npm install --save-dev nodemon
```

### 1.2 — Create folder structure

Create these folders and files:
```
backend/
├── src/
│   ├── routes/
│   │   └── auth.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── db.js
│   └── index.js
├── .env.example
└── package.json
```

### 1.3 — package.json scripts

Add to `backend/package.json`:
```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

### 1.4 — `src/db.js`

Set up the Neon database connection using `@neondatabase/serverless`. Export a `query` function that the rest of the app uses. Use `DATABASE_URL` from environment variables.

### 1.5 — `src/index.js`

Set up Express:
- Load dotenv
- Use cors (allow all origins in dev)
- Use express.json()
- Mount `/api/auth` routes
- Add a `GET /health` route that returns `{ status: 'ok' }`
- Listen on `process.env.PORT || 3000`

### 1.6 — Auth routes (`src/routes/auth.js`)

Create three routes:
- `POST /api/auth/register` — creates a new player
- `POST /api/auth/login` — returns a JWT
- `GET /api/auth/me` — returns current player (requires auth middleware)

### 1.7 — Auth controller (`src/controllers/authController.js`)

**register:**
- Accept `username`, `email`, `password`
- Hash password with bcrypt (salt rounds: 10)
- Insert into `players` table
- Also insert a row into `player_resources` for this player (all zeroes)
- Return `{ message: 'registered' }` on success

**login:**
- Accept `email`, `password`
- Look up player by email
- Compare password with bcrypt
- If valid, sign a JWT with `{ playerId: player.id }` and return it
- JWT should expire in 7 days

**me:**
- Read player ID from `req.player.id` (set by auth middleware)
- Return player data (exclude password_hash)

### 1.8 — Auth middleware (`src/middleware/auth.js`)

- Read `Authorization: Bearer <token>` header
- Verify JWT with `JWT_SECRET`
- Attach `{ id }` to `req.player`
- Return 401 if token missing or invalid

### 1.9 — `.env.example`

Create a `.env.example` file (not `.env`) with:
```
DATABASE_URL=your_neon_pooler_connection_string
JWT_SECRET=your_long_random_secret
PORT=3000
```

Tell the user: "Copy `.env.example` to `.env` and fill in your Neon connection string and JWT secret before running."

---

## Step 2 — Database Migration

Create a file `backend/src/migrate.js` that runs the SQL schema from CLAUDE.md when executed directly with `node src/migrate.js`.

It should:
- Connect to the database
- Run all CREATE TABLE IF NOT EXISTS statements
- Log success or errors
- Exit after completion

Include all tables from CLAUDE.md: `players`, `player_resources`, `champions`, `farmers`, `missions`, `pvp_battles`.

Tell the user to run `node src/migrate.js` after filling in their `.env` to create the tables.

---

## Step 3 — Frontend Setup

Work inside the `frontend/` folder.

### 3.1 — Initialize Expo

```bash
cd frontend
npx create-expo-app . --template blank-typescript
```

If the folder already has files, scaffold manually instead.

### 3.2 — Install dependencies

```bash
npm install axios expo-secure-store @react-native-async-storage/async-storage
npx expo install expo-router react-native-safe-area-context react-native-screens
```

### 3.3 — Folder structure

Create this structure inside `frontend/`:
```
app/
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (game)/
│   ├── _layout.tsx
│   └── index.tsx      ← Main screen
├── _layout.tsx
└── index.tsx          ← Redirect to login or game based on auth
components/
├── ResourceHeader.tsx
├── ChampionCard.tsx
└── ChampionDrawer.tsx
lib/
├── api.ts             ← axios instance with base URL + auth header
└── auth.ts            ← save/load/delete token from SecureStore
```

### 3.4 — `lib/api.ts`

Create an axios instance with:
- `baseURL` from `process.env.EXPO_PUBLIC_API_URL`
- A request interceptor that reads the JWT from SecureStore and adds `Authorization: Bearer <token>` header

### 3.5 — `lib/auth.ts`

Three functions:
- `saveToken(token: string)` — saves to SecureStore
- `getToken()` — retrieves from SecureStore
- `deleteToken()` — removes from SecureStore

### 3.6 — Auth screens

**`app/(auth)/login.tsx`:**
- Email and password inputs
- Login button that calls `POST /api/auth/login`
- On success: save token, navigate to `/(game)/`
- Show error message on failure
- Link to register screen

**`app/(auth)/register.tsx`:**
- Username, email, password inputs
- Register button that calls `POST /api/auth/register`
- On success: navigate to login
- Show error message on failure

Keep these screens simple and clean. No fancy design needed yet — just working forms.

### 3.7 — Main screen (`app/(game)/index.tsx`)

After login, the player lands here. Build this layout:

**Top header:**
- Show three resource counts: Strawberry, Pinecone, Blueberry
- Fetch from `GET /api/resources` on mount
- Show 0 as default while loading

**Center area:**
- A simple colored rectangle or box representing the battlefield
- Text: "Battlefield" or leave it as a placeholder view
- This is visual scaffolding for now — no logic needed

**Bottom area:**
- Three champion cards in a row
- Each card shows a colored box with the champion name and level
- Fetch from `GET /api/champions` on mount
- If no champions exist yet, show placeholder cards

**Top-right:**
- A "Logout" button that deletes the token and navigates to `/(auth)/login`

### 3.8 — Root layout and auth guard

**`app/_layout.tsx`:**
- Check if token exists on app load
- If yes: redirect to `/(game)/`
- If no: redirect to `/(auth)/login`

### 3.9 — `.env.example`

Create `frontend/.env.example`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Step 4 — Seed Data (Optional but helpful)

Create `backend/src/seed.js` that:
- Creates a test player: email `test@test.com`, password `password123`
- Adds 3 champions for this player (one Warrior, one Mage, one Archer) with default stats
- Adds 1 farmer per resource type
- Adds starting resources (10 of each)

Tell the user they can run `node src/seed.js` to get test data.

---

## Step 5 — Verify Everything Works

After setting up, verify:

1. `cd backend && npm run dev` starts without errors
2. `GET http://localhost:3000/health` returns `{ status: 'ok' }`
3. `POST /api/auth/register` with test data returns success
4. `POST /api/auth/login` returns a JWT token
5. `GET /api/auth/me` with that token returns player data
6. `cd frontend && npm start` launches Expo without errors

If any step fails, fix it before moving on.

---

## Important Notes

- Never commit `.env` files. Only commit `.env.example`.
- Use `@neondatabase/serverless` for the DB connection, not bare `pg`, because Neon suspends and the serverless driver handles reconnection better.
- The frontend stores the JWT in `expo-secure-store`, not AsyncStorage, because tokens are sensitive.
- All API routes except `/api/auth/register` and `/api/auth/login` require the auth middleware.
- Keep the main screen simple — it just needs to load and show data. No animations or complex UI for MVP.
- If you hit a Neon connection error, make sure you are using the **pooler** URL from Neon dashboard, not the direct connection URL.

---

## What MVP Does NOT Include Yet

Do not implement these in this pass:
- Farmer idle ticks (node-cron jobs)
- Mission/dungeon sending logic
- PvP battle simulation
- Champion upgrades
- Resource spending
- Bottom drawer animations

These come in Phase 2. Just get auth + database + main screen working first.
