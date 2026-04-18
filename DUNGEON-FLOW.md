# DUNGEON-FLOW.md

## Dungeon Types

| Type | Description |
|---|---|
| `harvest` | Repeatable resource runs with cooldowns and daily limits |
| `adventure` | Story stages 1–15, one-time clears with star ratings |
| `event` | Time-limited special dungeons with reward multipliers |

---

## Harvest Dungeon Table (22 total)

### Tier 1 — Easy (no level requirement)

| Name | Enemy | ATK/DEF/CHC/HP | Duration | Primary | Secondary | Cooldown | Daily |
|---|---|---|---|---|---|---|---|
| Berry Cave | Chipmunk | 6/3/10/50 | 15m | strawberry×6 | pinecone×4 | 30m | — |
| Pine Grove | Squirrel | 8/4/10/55 | 15m | pinecone×10 | — | 30m | — |
| Blueberry Fields | Rabbit | 7/3/12/50 | 15m | blueberry×8 | — | 30m | — |
| Strawberry Garden | Chipmunk | 9/5/10/60 | 20m | strawberry×14 | — | 45m | 4 |

### Tier 2 — Medium (no level requirement)

| Name | Enemy | ATK/DEF/CHC/HP | Duration | Primary | Secondary | Cooldown | Daily |
|---|---|---|---|---|---|---|---|
| Chicken Nest | Fox | 10/6/15/65 | 20m | egg×8 | — | 60m | 3 |
| Egg Ranch | Fox | 13/8/15/75 | 20m | egg×14 | — | 60m | 3 |
| Sheep Meadow | Wolf | 14/8/12/80 | 25m | wool×8 | — | 60m | 3 |
| Wool Valley | Wolf | 16/10/12/85 | 25m | wool×14 | — | 75m | 3 |
| Milk Meadow | Bear | 18/12/14/90 | 25m | milk×10 | — | 90m | 2 |
| Berry Twin | Fox | 14/9/15/80 | 25m | strawberry×10 | blueberry×8 | 60m | 3 |
| Forest Bounty | Wolf | 20/13/18/95 | 30m | pinecone×12 | strawberry×8 | 90m | 2 |
| Cozy Ranch | Bear | 22/14/16/100 | 30m | milk×8 | wool×8 | 90m | 2 |
| Golden Farm | Bandit | 20/14/20/90 | 30m | milk×5 | egg×5 | 120m | 2 |

### Tier 3 — Hard (min_champion_level 5–8)

| Name | Enemy | ATK/DEF/CHC/HP | Duration | Primary | Secondary | Cooldown | Daily | Min Lv |
|---|---|---|---|---|---|---|---|---|
| Ancient Orchard | Troll | 26/16/20/115 | 30m | egg×22 | — | 120m | 2 | 5 |
| Cursed Barn | Skeleton | 24/15/22/105 | 30m | wool×20 | — | 120m | 2 | 5 |
| Shadow Pasture | Dark Mage | 28/12/30/105 | 35m | blueberry×16 | wool×10 | 120m | 2 | 6 |
| Dragon Dairy | Orc | 30/18/22/125 | 35m | milk×14 | egg×10 | 150m | 1 | 7 |
| Haunted Vineyard | Skeleton | 32/16/25/120 | 35m | strawberry×18 | blueberry×14 | 150m | 1 | 8 |

### Tier 4 — Very Hard (min_champion_level 9–12)

| Name | Enemy | ATK/DEF/CHC/HP | Duration | Primary | Secondary | Extra | Cooldown | Daily | Min Lv |
|---|---|---|---|---|---|---|---|---|---|
| Crystal Cave | Orc | 34/20/25/140 | 40m | pinecone×22 | blueberry×12 | — | 180m | 1 | 9 |
| Giant's Farm | Troll | 36/22/18/155 | 40m | milk×22 | — | — | 180m | 1 | 9 |
| Rainbow Harvest | Orc | 32/19/24/135 | 40m | egg×10 | wool×10 | blueberry×8, milk×8 | 180m | 1 | 10 |
| Elder's Grove | Dark Mage | 38/20/35/145 | 45m | strawberry×14 | pinecone×14 | — | 200m | 1 | 12 |

### Tier 5 — Legendary (min_champion_level 15)

| Name | Enemy | ATK/DEF/CHC/HP | Duration | Primary | Secondary | Extra | Cooldown | Daily | Min Lv |
|---|---|---|---|---|---|---|---|---|---|
| Bountiful Lands | Bandit Chief | 44/26/28/170 | 45m | strawberry×6 | pinecone×6 | blueberry×6, egg×6, wool×6, milk×6 | 240m | 1 | 15 |

---

## Adventure Dungeon Table (15 stages)

| Stage | Name | Enemy | Boss |
|---|---|---|---|
| 1 | Whispering Woods | Goblin | — |
| 2 | Mossy Ruins | Skeleton | — |
| 3 | Troll Bridge | Troll | — |
| 4 | Orcish Camp | Orc | — |
| 5 | Dark Sanctum | Dark Mage | ✓ |
| 6 | Fungal Cavern | Mushroom Golem | — |
| 7 | Bandit Hideout | Bandit Chief | — |
| 8 | Frozen Tundra | Ice Witch | — |
| 9 | Lava Fields | Fire Imp | — |
| 10 | Magma Fortress | Lava Titan | ✓ |
| 11 | Haunted Graveyard | Banshee | — |
| 12 | Shadow Realm | Shadow Knight | — |
| 13 | Ancient Tomb | Mummy Lord | — |
| 14 | Dragon Lair | Wyvern | — |
| 15 | Void Gate | Void Lich | ✓ |

Adventure dungeons unlock sequentially (must clear stage N to unlock stage N+1).

---

## Reward System

### Primary & Secondary Resources

Every dungeon has `reward_resource` + `reward_amount`. Harvest dungeons may also have `reward_resource_2` + `reward_amount_2` for a second resource type.

### extra_rewards (JSONB)

Multi-resource dungeons (Tier 4+) use the `extra_rewards` column:

```json
[{"resource": "blueberry", "amount": 8}, {"resource": "milk", "amount": 8}]
```

All resources are awarded after battle victory, capped at the player's storage cap.

### Already-Cleared Adventure Dungeons

Adventure dungeons that have been cleared (best_stars > 0) give reduced rewards on repeat runs:
- Primary resource: 1 (instead of full amount)
- Secondary resource: 1 (if any)
- Extra rewards: 1 each
- XP: 1
- Coins: 0

`[TEST]` dungeons are exempt from this reduction.

---

## Champion Level Requirement System

Harvest dungeons Tier 3+ have `min_champion_level` set. The backend validates this in `enterDungeon`:

```
if (dungeon.min_champion_level && champion.level < dungeon.min_champion_level) {
  → 400 error with required_level
}
```

The frontend `DungeonCard` shows:
- Green badge `"✓ Lv N+ açık"` when champion meets requirement
- Red badge + lock icon `"Lv N+ gerekli (senin: X)"` when locked
- Enter button disabled and dark-red when locked

---

## Cooldown & Daily Limit Mechanics

Stored in `harvest_cooldowns` table per player+dungeon.

| Field | Description |
|---|---|
| `last_run_at` | Timestamp of most recent run start |
| `runs_today` | Count of runs on `day_reset_at` |
| `day_reset_at` | Date of current daily window (resets at midnight) |

**Cooldown check:** `Date.now() - last_run_at < cooldown_minutes * 60 * 1000`

**Daily limit check:** `day_reset_at == today AND runs_today >= daily_run_limit`

If either fails, `enterDungeon` returns 400 with `remaining_seconds` or `"Daily run limit reached"`.

---

## enterDungeon Validation Flow

```
1. champion_id provided?          → 400 if not
2. Champion belongs to player?    → 404 if not
3. Champion is_deployed?          → 400 (unless orphaned — auto-fixes)
4. Dungeon exists?                → 404 if not
5. Champion has active run?       → 400 if yes
6. Level requirement met?         → 400 with required_level if not
7. Harvest: cooldown check?       → 400 with remaining_seconds
8. Harvest: daily limit check?    → 400
9. Adventure: prev stage cleared? → 400
10. Event: time window valid?     → 400
→ Create dungeon_run, deploy champion, upsert cooldown record
```

---

## claimRun Reward Flow

```
1. Run exists and belongs to player?
2. Run status = 'active'?
3. Run ends_at <= now?
4. Simulate combat (champion + gear + boosts vs enemy)
5. Determine alreadyCleared for adventure dungeons
6. Calculate effectiveAmount (full or 1 if alreadyCleared)
7. Award primary resource (LEAST cap)
8. Award secondary resource (if any)
9. Award extra_rewards loop (LEAST cap each)
10. Award coins (adventure, not alreadyCleared)
11. Award XP + level-up champion
12. Update adventure_progress (best_stars)
13. Roll gear drop (adventure + event only)
→ Return winner, rewards, stars, log, xpGained, extraRewards
```

---

## Frontend Component Mapping

| Component | Purpose |
|---|---|
| `DungeonCard.tsx` | Harvest dungeon card (cream/pill style, level gate badge) |
| `dungeon/AdventureTab.tsx` | Adventure tab with stage list + drawer sheet |
| `dungeons.tsx` | Screen container, tab switcher, data loading |
| `BattleHistoryDrawer.tsx` | Post-battle result drawer (PvE + PvP) |
| `CountdownTimer.tsx` | Reusable countdown display |
