# Cozy Battle — Project Reference for Claude

## What This Project Is

A mobile cozy strategy / idle battle game built with:
- **Frontend**: React Native (Expo)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Neon — serverless, free tier)

It is a monorepo. Two folders at root level:
- `backend/` — Express API server
- `frontend/` — Expo React Native app

---

## Monorepo Structure

```
cozy-battle/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── index.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env
├── CLAUDE.md
└── README.md
```

---

## Running the Project

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev       # starts Express with nodemon on port 3000

# Terminal 2 — frontend
cd frontend
npm install
npm start         # starts Expo
```

---

## Backend — Tech Stack

| Package | Purpose |
|---|---|
| express | HTTP server / routing |
| pg | PostgreSQL client |
| @neondatabase/serverless | Neon-optimized PG driver (handles cold starts) |
| jsonwebtoken | JWT auth tokens |
| bcrypt | Password hashing |
| node-cron | Idle farmer ticks, mission completion jobs |
| dotenv | Environment variables |
| nodemon | Dev auto-restart (devDependency) |
| cors | Allow frontend to call API |

**Backend `.env` variables needed:**
```
DATABASE_URL=         # Neon connection string (pooler URL, not direct)
JWT_SECRET=           # Random long secret string
PORT=3000
```

---

## Frontend — Tech Stack

| Package | Purpose |
|---|---|
| expo | App framework |
| expo-router | File-based navigation |
| axios | HTTP requests to backend |
| @react-native-async-storage/async-storage | Store JWT token locally |
| expo-secure-store | Secure JWT storage (preferred over AsyncStorage for tokens) |

**Frontend `.env` variables needed:**
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Database — Neon PostgreSQL

Use the **pooler connection string** from Neon (not the direct URL). This handles auto-suspend cold starts gracefully.

### Schema

```sql
-- Players (auth)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Resources
CREATE TABLE player_resources (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  strawberry INT DEFAULT 0,   -- used to revive champions
  pinecone INT DEFAULT 0,     -- used for champion upgrades
  blueberry INT DEFAULT 0,    -- used for temporary combat boosts
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id)
);

-- Champions
CREATE TABLE champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  class VARCHAR(50) NOT NULL,      -- Warrior, Mage, Archer
  level INT DEFAULT 1,
  attack INT DEFAULT 10,
  defense INT DEFAULT 10,
  chance INT DEFAULT 10,           -- crit / dodge chance
  is_deployed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Farmers (idle resource production)
CREATE TABLE farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,   -- strawberry, pinecone, blueberry
  production_rate INT DEFAULT 5,        -- units per tick
  level INT DEFAULT 1,
  last_collected_at TIMESTAMP DEFAULT NOW()
);

-- Missions / Dungeons
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  champion_id UUID REFERENCES champions(id),
  dungeon_name VARCHAR(100) NOT NULL,
  duration_minutes INT NOT NULL,        -- 5, 15, or 30
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  reward_claimed BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active'   -- active, completed, claimed
);

-- PvP Battles (async, simulated)
CREATE TABLE pvp_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID REFERENCES players(id),
  defender_id UUID REFERENCES players(id),
  attacker_champion_id UUID REFERENCES champions(id),
  defender_champion_id UUID REFERENCES champions(id),
  winner_id UUID REFERENCES players(id),
  battle_log JSONB,
  fought_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes

### Auth
| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Register new player |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Get current player (auth required) |

### Resources
| Method | Route | Description |
|---|---|---|
| GET | /api/resources | Get player's current resources |

### Champions
| Method | Route | Description |
|---|---|---|
| GET | /api/champions | Get all player champions |
| POST | /api/champions/:id/upgrade | Upgrade a champion (costs pinecones) |

### Farmers
| Method | Route | Description |
|---|---|---|
| GET | /api/farmers | Get all farmers with pending resources |
| POST | /api/farmers/:id/collect | Collect accumulated resources |
| POST | /api/farmers/:id/upgrade | Upgrade farmer production rate |

### Missions / Dungeons
| Method | Route | Description |
|---|---|---|
| GET | /api/dungeons | List available dungeons |
| POST | /api/missions | Send champion to dungeon |
| GET | /api/missions | Get player's active/completed missions |
| POST | /api/missions/:id/claim | Claim mission rewards |

### PvP
| Method | Route | Description |
|---|---|---|
| POST | /api/pvp/battle | Start a PvP battle (async, simulated) |
| GET | /api/pvp/history | Get battle history |

---

## Battle System

PvP is fully asynchronous — no sockets, no real-time. When a player starts a battle:
1. Server picks a random opponent from the player pool
2. Battle is simulated immediately as a pure function
3. Result is saved to `pvp_battles` table
4. Result is returned in the same HTTP response

### Battle Simulation Logic

```js
function simulateBattle(attacker, defender) {
  let attackerHP = 100;
  let defenderHP = 100;
  const log = [];

  for (let round = 0; round < 10; round++) {
    // Attacker hits defender
    const isCrit = Math.random() * 100 < attacker.chance;
    const rawDamage = attacker.attack - (defender.defense * 0.5);
    const damage = Math.max(1, isCrit ? rawDamage * 1.5 : rawDamage);
    defenderHP -= damage;
    log.push({ round, actor: 'attacker', damage, isCrit });
    if (defenderHP <= 0) break;

    // Defender hits back
    const defCrit = Math.random() * 100 < defender.chance;
    const defRaw = defender.attack - (attacker.defense * 0.5);
    const defDamage = Math.max(1, defCrit ? defRaw * 1.5 : defRaw);
    attackerHP -= defDamage;
    log.push({ round, actor: 'defender', damage: defDamage, isCrit: defCrit });
    if (attackerHP <= 0) break;
  }

  const winner = defenderHP <= 0 ? 'attacker' : attackerHP <= 0 ? 'defender' : 'attacker'; // attacker wins ties
  return { winner, log, attackerHP, defenderHP };
}
```

---

## Idle System — Farmer Ticks

Farmers run on a `node-cron` job every 10 minutes. Each tick:
1. For each active farmer, calculate time since `last_collected_at`
2. Accumulate resources based on `production_rate`
3. Cap accumulated resources at a max (e.g. 4 hours worth) to prevent overflow
4. Resources sit in DB until player collects them via the API

---

## Frontend Screens

### Navigation Structure (Expo Router)
```
app/
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
├── (game)/
│   ├── index.tsx        ← Main screen (battlefield + champion cards)
│   ├── champions.tsx    ← Champion gallery / collection
│   └── dungeons.tsx     ← Dungeon selection screen
└── _layout.tsx
```

### Main Screen Layout
- **Top header**: shows Strawberry / Pinecone / Blueberry counts with icons
- **Center**: simple battlefield lane (visual, decorative — characters auto-fight)
- **Bottom**: 3 champion cards (icon, level)
- **Bottom drawer**: slides up when champion card is tapped, shows stats + PVP / DUNGEON buttons
- **Farmer access**: tap farmer characters on the battlefield to open their drawer

### Visual Theme
- Cozy fantasy forest
- Soft, bright colors
- Rounded cards
- Cartoon-style small characters
- Relaxed atmosphere — not intense or competitive

### Inspiration
- Rush Royale
- The Battle Cats

---

## Game Design — Core Rules

### Champions
- Each player has 6–10 champions maximum
- Classes: Warrior, Mage, Archer
- Stats: Attack, Defense, Chance
- Upgraded with Pinecones

### Resources
| Resource | Icon idea | Use |
|---|---|---|
| Strawberry | 🍓 | Revive fallen champions |
| Pinecone | 🌲 | Champion upgrades |
| Blueberry | 🫐 | Temporary combat boosts |

### Farmers
- Produce resources passively every ~10 minutes
- Upgradeable (increases production rate)
- Resources capped to prevent idle overflow

### Dungeons
- Time-based missions: 5 min / 15 min / 30 min
- Champion is locked during mission
- Rewards: resources + upgrade materials

### Session Design
- Target session length: 3–5 minutes
- Loop: login → collect → upgrade → mission/PvP → rewards → logout

---

## MVP Scope (Phase 1)

The first working version should include only:

1. **Auth** — register, login, JWT token stored on device
2. **Database connection** — Neon PostgreSQL connected and migrated
3. **Main screen** — visible after login with:
   - Header showing resource counts (can be 0/hardcoded for now)
   - Basic battlefield area
   - 3 champion cards at the bottom
4. **Protected routes** — unauthenticated users redirected to login

Everything else (farmers, dungeons, PvP, upgrades) comes in later phases.

---

## Environment Setup Checklist

- [ ] Neon account created, database provisioned
- [ ] `DATABASE_URL` set in `backend/.env` (use pooler URL)
- [ ] `JWT_SECRET` set in `backend/.env`
- [ ] `EXPO_PUBLIC_API_URL` set in `frontend/.env`
- [ ] Tables created in Neon (run schema SQL above)
- [ ] Backend running on port 3000
- [ ] Frontend connecting to backend successfully
