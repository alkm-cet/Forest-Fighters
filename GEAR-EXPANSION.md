# GEAR-EXPANSION.md

## System Overview

Gear flows through three tables:

```
gear_definitions  ──→  player_gear  ──→  equipped on champions
      ↑                    ↑
gear_loot_tables    (optional dungeon-specific drop pools)
```

- **`gear_definitions`** — master list of all item templates (id, stats, tier, class restriction)
- **`player_gear`** — instances owned by a player (rarity, level, which champion it's on)
- **`gear_loot_tables`** — optional per-dungeon item pools with weights; if empty for a dungeon, system falls back to tier-based random selection

Items drop from **adventure** and **event** dungeons only (never harvest). The `rollGearDrop` function in `backend/src/routes/gear.js` handles the full drop logic.

---

## Tier Budgets

| Tier | Base stat sum | Increment sum | Drops from |
|---|---|---|---|
| T1 | 5–7 | 2–3 | Stages 1–15 (dungeon_level = 1) |
| T2 | 9–11 | 3–5 | Stages 16–20 (dungeon_level = 2) |
| T3 | 14–18 | 5–9 | Stages 21–30 (dungeon_level = 3) |

**Rarity multipliers** (applied at display/equip time, not stored):
- Common: 1.0×
- Rare: 1.35×
- Epic: 1.75×

**50% cap rule**: gear bonuses shown on a champion are capped at 50% of that champion's base stat for each of ATK/DEF/CHANCE. This prevents gear from trivialising base-stat progression.

---

## Full Item Reference (36 items)

### Warrior Weapons

| id | Name | Tier | ATK base/inc | DEF base/inc | CHANCE base/inc | Emoji |
|---|---|---|---|---|---|---|
| `iron_sword` | Iron Sword | 1 | 5 / 2 | — | — | ⚔️ |
| `war_hammer` | War Hammer | 1 | 7 / 3 | — | — | 🔨 |
| `shield_sword` | Shield Sword | 1 | 3 / 1 | 3 / 1 | — | 🛡️ |
| `steel_axe` | Steel Axe | 2 | 8 / 3 | 2 / 1 | — | 🪓 |
| `great_axe` | Great Axe | 2 | 11 / 4 | — | — | ⚒️ |
| `tower_shield` | Tower Shield | 2 | 5 / 2 | 5 / 2 | — | 🔰 |
| `battle_blade` | Battle Blade | 3 | 12 / 5 | 4 / 2 | — | 🗡️ |
| `blood_cleaver` | Blood Cleaver | 3 | 16 / 6 | — | — | ⚔️ |
| `fortress_blade` | Fortress Blade | 3 | 8 / 3 | 7 / 3 | — | 🗡️ |

### Mage Weapons

| id | Name | Tier | ATK base/inc | DEF base/inc | CHANCE base/inc | Emoji |
|---|---|---|---|---|---|---|
| `oak_staff` | Oak Staff | 1 | 5 / 2 | — | 3 / 1 | 🪄 |
| `ember_wand` | Ember Wand | 1 | 7 / 3 | — | — | 🔥 |
| `moon_focus` | Moon Focus | 1 | 2 / 1 | — | 5 / 2 | 🌕 |
| `crystal_staff` | Crystal Staff | 2 | 8 / 3 | — | 5 / 2 | 🔮 |
| `flame_staff` | Flame Staff | 2 | 11 / 4 | — | — | 🌋 |
| `void_lens` | Void Lens | 2 | 4 / 1 | — | 7 / 3 | 🔭 |
| `arcane_orb` | Arcane Orb | 3 | 12 / 5 | — | 8 / 3 | 🌟 |
| `inferno_orb` | Inferno Orb | 3 | 16 / 6 | — | — | 🔮 |
| `eclipse_staff` | Eclipse Staff | 3 | 6 / 2 | — | 10 / 4 | 🌑 |

### Archer Weapons

| id | Name | Tier | ATK base/inc | DEF base/inc | CHANCE base/inc | Emoji |
|---|---|---|---|---|---|---|
| `pine_bow` | Pine Bow | 1 | 5 / 2 | — | 3 / 1 | 🏹 |
| `sharp_arrow` | Sharp Arrow | 1 | 7 / 3 | — | — | 🏹 |
| `swift_bow` | Swift Bow | 1 | 2 / 1 | — | 5 / 2 | 💨 |
| `hunter_bow` | Hunter Bow | 2 | 8 / 3 | — | 5 / 2 | 🎯 |
| `storm_bow` | Storm Bow | 2 | 11 / 4 | — | — | ⛈️ |
| `phantom_quiver` | Phantom Quiver | 2 | 4 / 1 | — | 7 / 3 | 👻 |
| `shadow_bow` | Shadow Bow | 3 | 12 / 5 | — | 8 / 3 | 🌙 |
| `death_arrow` | Death Arrow | 3 | 16 / 6 | — | — | ☠️ |
| `ghost_bow` | Ghost Bow | 3 | 6 / 2 | — | 10 / 4 | 👁️ |

### Universal Charms

| id | Name | Tier | ATK base/inc | DEF base/inc | CHANCE base/inc | Emoji |
|---|---|---|---|---|---|---|
| `forest_charm` | Forest Charm | 1 | — | 4 / 2 | — | 🍀 |
| `bone_charm` | Bone Charm | 1 | — | 2 / 1 | 2 / 1 | 🦴 |
| `ember_charm` | Ember Charm | 1 | 3 / 1 | — | — | 🌿 |
| `silver_charm` | Silver Charm | 2 | — | 7 / 3 | 3 / 1 | 🪙 |
| `storm_charm` | Storm Charm | 2 | — | 4 / 2 | 4 / 2 | ⚡ |
| `war_charm` | War Charm | 2 | 5 / 2 | — | — | 🪬 |
| `dragon_charm` | Dragon Charm | 3 | — | 10 / 4 | 6 / 2 | 🐉 |
| `void_charm` | Void Charm | 3 | — | 6 / 2 | 6 / 3 | 🌌 |
| `titan_charm` | Titan Charm | 3 | 8 / 3 | — | — | 🗿 |

---

## How to Add a New Item

1. Choose a unique snake_case `id` (e.g. `frost_blade`)
2. Decide `tier` (1/2/3) and `class_restriction` (`'Warrior'`/`'Mage'`/`'Archer'`/`null`)
3. Set stats following the tier budget above; leave unused stats at 0
4. Add the row to the `gearDefs` array in `backend/src/seed.js`
5. Run `node src/seed.js` — idempotent, safe to re-run at any time

**Optional art:** drop a `.webp` image in `frontend/assets/items/` and add a `require()` entry to the `GEAR_IMAGES` object in `frontend/components/GearDrawer.tsx`. If no image is present the item's emoji is shown automatically — no crash.

**No type changes needed** — `GearDefinition` in `frontend/types/index.ts` is generic.

---

## How to Assign Items to a Dungeon (Loot Table)

Find the dungeon's UUID:
```sql
SELECT id, name FROM dungeons WHERE dungeon_type = 'adventure' ORDER BY stage_number;
```

Add entries:
```sql
-- Pin ghost_bow to Moonlit Forest (stage 16) at 2× weight
INSERT INTO gear_loot_tables (dungeon_id, definition_id, weight)
VALUES ('<dungeon_uuid>', 'ghost_bow', 2);

-- Add storm_charm at normal weight alongside it
INSERT INTO gear_loot_tables (dungeon_id, definition_id, weight)
VALUES ('<dungeon_uuid>', 'storm_charm', 1);
```

**Weight semantics**: weight 2 means ghost_bow is twice as likely as any weight-1 item in the same pool. Players can still get any item in the pool — weight just adjusts probability.

To update a weight:
```sql
UPDATE gear_loot_tables SET weight = 3
WHERE dungeon_id = '<uuid>' AND definition_id = 'ghost_bow';
```

To remove an entry (reverts that slot to tier-random fallback if all entries removed):
```sql
DELETE FROM gear_loot_tables
WHERE dungeon_id = '<uuid>' AND definition_id = 'ghost_bow';
```

---

## Default Fallback Behaviour

If a dungeon has **no rows** in `gear_loot_tables`, `rollGearDrop` falls back to:
```sql
-- Weapon:
SELECT id FROM gear_definitions
WHERE gear_type = 'weapon' AND class_restriction = $champClass AND tier = $tier
-- Charm:
SELECT id FROM gear_definitions
WHERE gear_type = 'charm' AND class_restriction IS NULL AND tier = $tier
```
All matching items have equal probability. This is the default for every dungeon that has no loot table entries.

**Important**: the loot table only controls *which item* drops. Drop chance and rarity are always governed by the dungeon's `dungeon_level` and `is_boss_stage` flags — those are not affected by loot table entries.

---

## Thematic Assignment Suggestions

| Stage | Dungeon | Suggested loot table item | Reason |
|---|---|---|---|
| 12 | Shadow Realm | `ghost_bow` w=2, `phantom_quiver` w=2 | Shadow/ghost theme |
| 16 | Moonlit Forest | `moon_focus` w=2, `swift_bow` w=2 | Night/moon theme |
| 17 | Storm Peak | `storm_bow` w=2, `storm_charm` w=2 | Storm theme |
| 20 | Demon Warlord's Keep | `blood_cleaver` w=2, `inferno_orb` w=2 | Boss — aggressive items |
| 24 | The Abyss | `void_charm` w=2, `void_lens` w=2 | Void theme |
| 28 | Eternal Flame | `flame_staff` w=2, `ember_charm` w=2 | Fire theme |
| 30 | The Elder Dragon | `titan_charm` w=2, `death_arrow` w=2 | Final boss — max-tier |

---

## Re-allocating When New Dungeons Are Added

No code changes are needed. The flow is:

1. Add the new dungeon row to `dungeons` table (via `migrate.js` or direct SQL)
2. Run `SELECT id FROM dungeons WHERE name = '<new dungeon>'` to get the UUID
3. `INSERT INTO gear_loot_tables` rows for the items you want that dungeon to feature
4. If you want to **move** an item from an old dungeon, `DELETE` the old entry first
5. If you want the new dungeon to just pull from the tier pool, skip steps 2–4 entirely

The fallback guarantees that any dungeon without loot table entries always has a valid item pool. You never have to touch `rollGearDrop` or any application code to change drop allocations.

---

## Maintenance Notes

- **Rarity is not in the loot table** — rarity is always determined by dungeon difficulty (`dungeon_level`, `is_boss_stage`). You cannot make a dungeon drop only epic items via the loot table.
- **To exclude an item from all drops**, remove it from `gear_definitions` (cascades to `gear_loot_tables`). Existing `player_gear` rows keep their `definition_id` FK pointing to the now-deleted definition — add `ON DELETE SET NULL` to that FK or keep the definition with a `disabled` flag if needed.
- **Stage 1** always drops BOTH a T1 class weapon and a T1 charm at 100% (hardcoded tutorial path). The loot table is not consulted for stage 1.
- **Weighted random degenerates to uniform random** when all weights are 1 — this is correct and expected.
