# PvP System — Flow & Design

## Overview

Asynchronous PvP. Combat is simulated instantly on the server, but the result is revealed after a 5-minute delay. Players are notified in real-time via WebSocket when they are attacked.

---

## Trophy & League System

| League | Trophy Range |
|--------|-------------|
| Bronz  | 10 – 24     |
| Gümüş  | 25 – 49     |
| Altin  | 50 – 99     |
| Platin | 100 – 199   |
| Elmas  | 200+        |

- Every player starts at **10 trophies**
- Win: **+12 trophies**
- Lose: **-10 trophies**
- Floor: **10 trophies** (can never go below)

---

## Defender Mechanic

- Every player must designate one of their champions as their **defender**
- The defender is the champion that fights when the player is attacked by someone else
- A champion that just defended **cannot be selected as defender again** until a different champion defends (prevents same champion defending twice in a row → `last_defender` flag)
- A champion that is currently in a dungeon run (`is_deployed = true`) cannot be selected as defender
- The defender champion is locked for dungeon and PvP actions while they are the active defender

---

## Matchmaking

- Attacker selects a champion from their drawer → taps PVP button → goes to PvP screen
- System finds an opponent from the player pool with trophies within **±30** of attacker's trophies
- Opponent must have a `defender_champion_id` set
- Opponent must **not** have an active defense shield (`defense_shield_until > NOW()` → skip)
- If no real match in ±30 range → widen to ±60
- If still no real match → fall back to **bot player pool**

---

## PvP Eligibility

- A player can enter PvP only if they have **at least one champion at level 3 or higher**
- `players.pvp_unlocked = TRUE` is set automatically when any champion reaches level 3
- Players with `pvp_unlocked = FALSE` cannot attack, set a defender, or appear in matchmaking
- The "Set Defender" button in ChampionDrawer is disabled and shows "PvP Lv3 Gerekli" when locked

---

## Bot Player Pool

- A set of seeded bot players with champions, trophies, and a defender_champion_id
- Bots exist in the DB as normal players, flagged with `is_bot = TRUE`
- Used only as a fallback when no real player match is found
- Bots do not use WebSocket and do not attack back
- Bot resources ARE deducted when they lose (seeded resources decrease over time)

---

## Battle Flow

```
1. Attacker opens ChampionDrawer → taps PVP button
2. Navigate to pvp.tsx (fade-in animation)
3. pvp.tsx shows:
   - Attacker's champion strip (top)
   - Defender selection grid (player's own champions — to set who defends them)
   - "Saldir!" button (triggers the attack)

4. Tap "Saldir!" → POST /api/pvp/attack { champion_id }
   Server:
   a. Finds a random eligible opponent (real or bot)
   b. Runs simulateCombat(attackerChamp, defenderChamp) immediately
   c. Determines winner, computes trophy deltas (+12/-10), resource transfer (10% with caps)
   d. Updates trophies and resources IMMEDIATELY in DB
   e. Marks defender champion with last_defender = true
   f. Sets defense_shield_until = NOW() + 15 min on defender's player row
   g. Saves pvp_battle row with status='pending', result_available_at = NOW() + 5min
   h. If real player: emits WebSocket event to defender: pvp:attacked

5. Response to attacker: { battleId, resultAvailableAt, opponentName, opponentChampionName }
   pvp.tsx shows: "Savas basladi! vs OpponentName" + countdown timer to resultAvailableAt

6. Defender's device (real-time, if real player):
   WebSocket → show banner: "Saldiri Altindasin! — AttackerName"
   Banner auto-dismisses after 4 seconds

7. After 5 minutes (countdown hits 0):
   pvp.tsx: "Sonuclari Gor" button appears
   OR main screen: "Savas Sonucu Hazir!" banner (on focus, polling)

8. Tap result → GET /api/pvp/battles → show Victory/Defeat card:
   - Winner badge
   - Trophy change (+12 / -10)
   - Resources gained or lost (per resource)
   - Expandable combat log (round-by-round)
   - Revenge button (if player lost and target has no active shield)
```

---

## Resource Transfer (10% with caps)

When a battle resolves, resources are stolen from the **loser** and given to the **winner**:

```
if loserResource <= 1 → no transfer for that resource
stealAmount = floor(loserResource * 0.10)
if stealAmount < 1 → stealAmount = 1
stealAmount = min(stealAmount, 15)                        ← cap per resource
finalTransfer = min(stealAmount, winnerRemainingStorage)  ← respect winner's cap
```

Applied to all three resources: strawberry, pinecone, blueberry.

| Loser Resource | Steal            |
|---------------|------------------|
| 0             | 0 (none)         |
| 1             | 0 (protected)    |
| 2             | 1 (minimum)      |
| 10            | 1 (minimum)      |
| 30            | 3                |
| 200           | 15 (capped)      |

If loser has 0 or exactly 1 of a resource → no transfer for that resource (only trophy transfer).
If loser is a bot → resources ARE deducted from bot (seeded bot resources decrease naturally).

---

## Defense Shield (Anti-Bullying Protection)

After a player is attacked:
```
defense_shield_until = NOW() + 15 minutes
```
- While shield is active: player **cannot be targeted** in matchmaking
- Shield is per-player, stored in `players.defense_shield_until`
- Revenge attacks bypass the shield check (see below)

---

## Revenge Attack

- After viewing a lost battle in history, a **"Revenge"** button is shown
- Revenge calls `POST /api/pvp/attack` with `{ champion_id, revenge_battle_id }`
- Constraints:
  - Only allowed once per battle (`revenge_used = true` flag on pvp_battles row)
  - Target must still be reachable (no shield check bypass for bots — bots never have shields)
  - Revenge ignores the defense shield of real players (one exception)
- If revenge succeeds: `pvp_battles.revenge_used = true`

---

## Battle History

- `GET /api/pvp/history` → last 10 resolved battles for the player (as attacker or defender)
- Each entry includes:
  - Opponent name + champion name
  - Role (Attacker / Defender)
  - Victory / Defeat
  - Trophy change
  - Resources gained or lost
  - Battle timestamp
  - Revenge button (if player lost + revenge not yet used)

---

## Combat Log

Every battle stores a round-by-round log in `pvp_battles.combat_log JSONB`:

```json
[
  { "round": 1, "actor": "attacker", "damage": 5, "isCrit": false, "hpAfter": 95 },
  { "round": 1, "actor": "defender", "damage": 3, "isCrit": false, "hpAfter": 97 },
  { "round": 2, "actor": "attacker", "damage": 8, "isCrit": true,  "hpAfter": 87 }
]
```

The existing `simulateCombat()` already returns this log — it just needs to be saved to the new column.
Frontend renders this as an expandable section in the result screen.

---

## Real-Time Notifications (WebSocket / Socket.io)

| Event | Direction | Trigger | Content |
|-------|-----------|---------|---------|
| `pvp:attacked` | Server → Defender | When `POST /api/pvp/attack` is called (real player only) | `{ battleId, attackerName }` |

- Client connects to socket on app load, joins room `player:{playerId}`
- Main screen listens for `pvp:attacked` → shows slide-in banner
- On app focus: check if any pending battle has `result_available_at <= now` → show result banner

---

## UI Screens & Components

### pvp.tsx (new screen)
- Full-screen dark background
- Fade-in mount animation (Animated.Value opacity 0→1 on mount)
- **Top section**: attacker's champion strip (same style as dungeons.tsx)
- **Middle section**: Defender selection grid — player's own champions
  - Green border = currently selected as defender
  - Dimmed = `last_defender` (cooldown) or `is_deployed`
  - Tap to call `POST /api/pvp/set-defender`
- **Bottom section**: "Saldır!" CustomButton
- **Pending state**: countdown + opponent name (replaces attack button)
- **Result state**: Victory/Defeat card with trophy delta, resources, expandable combat log
- **History tab**: last 10 battles with revenge buttons

### ChampionDrawer.tsx (updated)
- New "Savunucu Yap" button: shown if champion is alive, not `last_defender`, not `is_deployed`
- If already the defender: "Savunucu ✓" (highlighted)
- If `last_defender = true`: dimmed badge "Savunucu Olamaz"
- Trophy count + league shown in drawer header area

### ChampionCard.tsx (updated)
- Small shield badge if `champion.id === defenderChampionId`

### index.tsx (updated)
- Socket connect on mount, disconnect on unmount
- `attackedBanner` state → slide-in "Saldırı Altındasın!" banner
- `resultBanner` state → "Savaş Sonucu Hazır!" tappable banner → navigate to pvp.tsx
- `onPvp` passes full champion data as route params to pvp.tsx

---

## Database Changes

### `players` table
- `trophies INT DEFAULT 10`
- `defender_champion_id UUID REFERENCES champions(id)`
- `defense_shield_until TIMESTAMPTZ` — null = no shield
- `is_bot BOOLEAN DEFAULT FALSE`
- `pvp_unlocked BOOLEAN DEFAULT FALSE` — set to TRUE when any champion reaches level 3

### `champions` table
- `last_defender BOOLEAN DEFAULT FALSE`

### `pvp_battles` table (already exists, add columns)
- `status VARCHAR(20) DEFAULT 'pending'` — pending | resolved
- `result_available_at TIMESTAMPTZ`
- `attacker_trophies_delta INT DEFAULT 0`
- `defender_trophies_delta INT DEFAULT 0`
- `transferred_strawberry INT DEFAULT 0`
- `transferred_pinecone INT DEFAULT 0`
- `transferred_blueberry INT DEFAULT 0`
- `seen_by_attacker BOOLEAN DEFAULT FALSE`
- `seen_by_defender BOOLEAN DEFAULT FALSE`
- `combat_log JSONB`
- `revenge_used BOOLEAN DEFAULT FALSE`

---

## Backend API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/pvp/attack` | Start attack with selected champion |
| GET | `/api/pvp/battles` | Get resolved battles (result_available_at <= now) |
| GET | `/api/pvp/status` | Get trophies, league, defender, pending battle |
| GET | `/api/pvp/history` | Get last 10 resolved battles |
| POST | `/api/pvp/set-defender` | Set defender champion for this player |

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `backend/src/migrate.js` | Add new columns to players, champions, pvp_battles |
| `backend/src/seed.js` | Seed bot players + bot champions |
| `backend/src/index.js` | Add socket.io, mount /api/pvp |
| `backend/src/controllers/pvpController.js` | CREATE — 5 handlers (attack, battles, status, history, set-defender) |
| `backend/src/routes/pvp.js` | CREATE |
| `frontend/types/index.ts` | Add PvpStatus, PvpBattle types; extend Champion with last_defender |
| `frontend/lib/socket.ts` | CREATE — socket.io client |
| `frontend/lib/i18n.tsx` | Add PvP translation keys |
| `frontend/app/(game)/pvp.tsx` | CREATE — full PvP screen with history tab |
| `frontend/app/(game)/index.tsx` | Socket + banners + onPvp params |
| `frontend/components/ChampionDrawer.tsx` | Defender button + pvp status |
| `frontend/components/ChampionCard.tsx` | Defender shield badge |
