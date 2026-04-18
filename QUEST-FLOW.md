# QUEST-FLOW.md — Görev Sistemi Detaylı Dokümantasyonu

Oluşturulma: Nisan 2026  
Kapsam: Daily (günlük) ve Weekly (haftalık) görev sistemi — veritabanı şeması, görev tanımları, ilerleme takibi, ödüllendirme, ölçekleme ve frontend bütünleşimi.

---

## 1. Genel Bakış

Oyuncuya her gün 4 günlük, her hafta 4 haftalık görev atanır. Görevler oyuncunun mevcut trofesi (trophy) baz alınarak ölçeklenir. Tüm görevler tamamlandığında ek bir günlük bonus ödül verilir.

**Günlük döngü:**
```
Gün başlangıcı → 4 görev atanır → Oyuncu aksiyonlarla ilerler →
Tümünü tamamlar & claim eder → Bonus chest → Sıfırlama beklenir
```

**Haftalık döngü:**  
Aynı akış, Pazartesi UTC 00:00'da sıfırlanır.

---

## 2. Veritabanı Şeması

### `quest_definitions` — Görev Kataloğu

Admin tarafından seeding ile doldurulur. Oyun süreci boyunca değişmez.

```sql
CREATE TABLE quest_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(150) NOT NULL,        -- Görev adı (sayı içermez)
  description   VARCHAR(255) NOT NULL,        -- Kısa açıklama (sayı içermez)
  quest_type    VARCHAR(20)  NOT NULL,        -- 'daily' | 'weekly'
  difficulty    VARCHAR(30)  NOT NULL,        -- Aşağıda detay var
  category      VARCHAR(30)  NOT NULL,        -- pvp | dungeon | resource | animal | cooking | upgrade
  action_key    VARCHAR(50)  NOT NULL,        -- İlerlemenin tetiklendiği anahtar
  target_count  INT          NOT NULL,        -- Tier 1 baz hedef (ölçeklenmeden önce)
  reward_coins  INT          NOT NULL,        -- Sabit ödül (ölçeklenmez)
  metadata      JSONB        NOT NULL DEFAULT '{}',   -- Filtre kriterleri
  scale_factors JSONB        NOT NULL DEFAULT '{"t1":1.0,"t2":1.5,"t3":2.5}',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);
```

**`difficulty` değerleri:**
| Değer | Kullanım |
|-------|----------|
| `easy` | Günlük kolay havuz |
| `medium` | Günlük orta havuz |
| `action` | Günlük aksiyon havuzu |
| `passive` | Günlük pasif havuz (kaynak bazlı) |
| `weekly_easy` | Haftalık kolay havuz |
| `weekly_medium` | Haftalık orta havuz |
| `weekly_hard` | Haftalık zor havuz |

**`category` değerleri ve emoji gösterimi (QuestCard):**
| Kategori | Emoji | Renk |
|----------|-------|------|
| `pvp` | ⚔️ | #c0392b |
| `dungeon` | 🏰 | #8e44ad |
| `resource` | 🌿 | #27ae60 |
| `animal` | 🐾 | #e67e22 |
| `cooking` | 🍳 | #d35400 |
| `upgrade` | ⬆️ | #2980b9 |

---

### `player_quests` — Oyuncu Görev Atamaları

Her oyuncu × dönem kombinasyonu için 4 satır oluşturulur. Atama anında `target_count` ve `reward_coins` snapshot alınır.

```sql
CREATE TABLE player_quests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
  definition_id   UUID REFERENCES quest_definitions(id),
  quest_type      VARCHAR(20)  NOT NULL,      -- 'daily' | 'weekly'
  period_key      VARCHAR(20)  NOT NULL,      -- 'daily:2026-04-16' | 'weekly:2026-W16'
  progress        INT          NOT NULL DEFAULT 0,
  target_count    INT          NOT NULL,      -- Ölçeklenmiş değer (atama anında snapshot)
  reward_coins    INT          NOT NULL,      -- Sabit ödül (ölçeklenmez, snapshot)
  metadata        JSONB        NOT NULL DEFAULT '{}',  -- Filtre kriterleri snapshot
  status          VARCHAR(20)  NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | claimed
  bonus_claimed   BOOLEAN      NOT NULL DEFAULT FALSE,
  assigned_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  claimed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_player_quests_period_def
  ON player_quests (player_id, period_key, definition_id);

CREATE INDEX idx_player_quests_player_period
  ON player_quests (player_id, period_key);
```

**`status` geçişleri:**
```
in_progress  →  completed  →  claimed
     ↑ (incrementQuestProgress)   ↑ (POST /api/quests/:id/claim)
```

---

## 3. Period Key (Dönem Anahtarı)

Her görev ataması bir `period_key` ile etiketlenir. Bu anahtar dönem bazlı idempotency ve sıfırlama için kullanılır.

```javascript
// backend/src/quests.js — getPeriodKey()

// Günlük: UTC tarihi
'daily:2026-04-16'

// Haftalık: ISO haftası (Pazartesi başlangıç)
'weekly:2026-W16'
```

**Sıfırlama zamanları (UTC):**
- Günlük: Her gece yarısı 00:00 UTC
- Haftalık: Her Pazartesi 00:00 UTC

**Frontend countdown hesabı:**
```typescript
// Bir sonraki günlük sıfırlama
function getNextDailyResetMs(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime();
}

// Bir sonraki haftalık sıfırlama (Pazartesi)
function getNextWeeklyResetMs(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Pazar, 1=Pazartesi...
  const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil));
  return next.getTime();
}
```

---

## 4. Oyuncu Tier Sistemi (Zorluk Ölçekleme)

Oyuncunun trofesi mevcut PvP ligini baz alır. Tier, görev atama anında bir kez hesaplanır.

```javascript
// backend/src/quests.js — getPlayerTier()
function getPlayerTier(trophies) {
  if (trophies >= 500) return 't3';  // Platinum+
  if (trophies >= 150) return 't2';  // Gümüş + Altın
  return 't1';                        // Bronz
}
```

| Tier | Trof Aralığı | Lig |
|------|-------------|-----|
| `t1` | 0 – 149 | Bronz |
| `t2` | 150 – 499 | Gümüş + Altın |
| `t3` | 500+ | Platinum → Challenger |

**Ölçekleme formülü (sadece `target_count` ölçeklenir, `reward_coins` sabit kalır):**
```javascript
function scaleValue(base, scaleFactors, tier) {
  const factor = scaleFactors[tier] ?? 1.0;
  return Math.max(1, Math.round(base * factor));
}

// Atama anında:
const scaledTarget = scaleValue(picked.target_count, picked.scale_factors, tier);
const scaledReward = picked.reward_coins;  // Ödül ölçeklenmez
```

**Önemli notlar:**
- Ölçekleme yalnızca atama anında çalışır. Hafta ortasında tier değişirse mevcut görevler etkilenmez.
- Bir sonraki dönem sıfırlandığında yeni tier hesaplanır.
- `reward_coins` kasıtlı olarak sabit tutulur — tier ne olursa olsun aynı ödül.

---

## 5. Görev Atama Mantığı (ensureQuestsAssigned)

`GET /api/quests` her çağrıldığında tetiklenir. Idempotent.

```javascript
// backend/src/quests.js — ensureQuestsAssigned()

async function ensureQuestsAssigned(playerId, questType) {
  const periodKey = getPeriodKey(questType);

  // Hızlı kontrol: bu dönem için zaten 4 görev var mı?
  const existing = await query(
    'SELECT COUNT(*) AS cnt FROM player_quests WHERE player_id = $1 AND period_key = $2',
    [playerId, periodKey]
  );
  if (parseInt(existing[0].cnt, 10) >= 4) return;  // Atla

  // Tier hesapla
  const playerRows = await query('SELECT trophies FROM players WHERE id = $1', [playerId]);
  const tier = getPlayerTier(playerRows[0]?.trophies ?? 10);

  // Havuzdan seç ve ekle
  // INSERT ... ON CONFLICT DO NOTHING  ← eş zamanlı isteklere karşı güvenli
}
```

**Günlük atama planı (4 görev):**
| Havuz | Zorluk | Adet |
|-------|--------|------|
| Easy | `easy` | 1 |
| Medium | `medium` | 1 |
| Action | `action` | 1 |
| Passive | `passive` | 1 |

Her havuzdan rastgele 1 tanesi seçilir.

**Haftalık atama planı (4 görev):**
| Havuz | Zorluk | Adet |
|-------|--------|------|
| Weekly Easy | `weekly_easy` | 1 |
| Weekly Medium | `weekly_medium` | 1 |
| Weekly Hard | `weekly_hard` | 2 (değiştirmesiz) |

---

## 6. Görev Tanımları (Tam Liste)

### 6.1 Günlük Görevler

#### EASY Havuzu — scale_factors: `{t1:1.0, t2:1.0, t3:1.5}`
| Başlık | action_key | Baz Hedef | Ödül |
|--------|-----------|-----------|------|
| Enter a Dungeon | `dungeon_enter_adventure` | 1 | 2 🪙 |
| Collect from a Farmer | `farmer_collect` | 1 | 2 🪙 |
| Feed an Animal | `animal_feed` | 1 | 2 🪙 |
| Cook a Meal | `kitchen_cook` | 1 | 2 🪙 |
| Start a PvP Battle | `pvp_attack` | 1 | 2 🪙 |

#### MEDIUM Havuzu — scale_factors: `{t1:1.0, t2:1.5, t3:2.5}`
| Başlık | action_key | Baz Hedef | Ödül | metadata |
|--------|-----------|-----------|------|---------|
| Feed Animals | `animal_feed` | 3 | 3 🪙 | — |
| Collect from Farmers | `farmer_collect` | 3 | 3 🪙 | — |
| Complete Harvest Dungeons | `dungeon_claim_harvest` | 2 | 3 🪙 | — |
| Use a Prepared Meal | `kitchen_use` | 1 | 3 🪙 | — |
| Win a PvP Battle | `pvp_win` | 1 | 3 🪙 | — |

#### ACTION Havuzu — scale_factors: `{t1:1.0, t2:1.5, t3:2.0}`
| Başlık | action_key | Baz Hedef | Ödül |
|--------|-----------|-----------|------|
| PvP Warrior | `pvp_attack` | 1 | 5 🪙 |
| Upgrade Something | `any_upgrade` | 1 | 5 🪙 |
| Collect Animal Products | `animal_collect` | 3 | 5 🪙 |
| Complete an Adventure Dungeon | `dungeon_claim_adventure` | 1 | 5 🪙 |
| Cook Meals | `kitchen_cook` | 2 | 5 🪙 |

#### PASSIVE Havuzu — scale_factors: `{t1:1.0, t2:2.0, t3:3.5}` (Kaynak üretimi — yüksek tier oyuncu çok daha fazla üretir)
| Başlık | action_key | Baz Hedef | Ödül | metadata |
|--------|-----------|-----------|------|---------|
| Gather Pinecone | `farmer_collect` | 20 | 4 🪙 | `{"resourceType":"pinecone"}` |
| Gather Strawberry | `farmer_collect` | 20 | 4 🪙 | `{"resourceType":"strawberry"}` |
| Gather Blueberry | `farmer_collect` | 15 | 4 🪙 | `{"resourceType":"blueberry"}` |
| Collect Eggs | `animal_collect` | 10 | 4 🪙 | `{"resourceType":"egg"}` |
| Collect Wool | `animal_collect` | 10 | 4 🪙 | `{"resourceType":"wool"}` |
| Collect Milk | `animal_collect` | 10 | 4 🪙 | `{"resourceType":"milk"}` |

**Günlük toplam (t1):** 2 + 3 + 5 + 4 = **14 🪙** + 8 bonus = **22 🪙 maks**

---

### 6.2 Haftalık Görevler

#### WEEKLY_EASY Havuzu — scale_factors: `{t1:1.0, t2:1.5, t3:2.0}`
| Başlık | action_key | Baz Hedef | Ödül |
|--------|-----------|-----------|------|
| PvP Participant | `pvp_attack` | 3 | 8 🪙 |
| Kitchen Student | `kitchen_cook` | 3 | 8 🪙 |
| Dungeon Explorer | `dungeon_enter_adventure` | 3 | 8 🪙 |
| Diligent Farmer | `farmer_collect` | 5 | 8 🪙 |

#### WEEKLY_MEDIUM Havuzu — scale_factors: `{t1:1.0, t2:1.5, t3:2.5}`
| Başlık | action_key | Baz Hedef | Ödül | metadata |
|--------|-----------|-----------|------|---------|
| PvP Victor | `pvp_win` | 2 | 12 🪙 | — |
| Harvest Master | `dungeon_claim_harvest` | 5 | 12 🪙 | — |
| Animal Caretaker | `animal_collect` | 5 | 12 🪙 | — |
| Pinecone Baron | `farmer_collect` | 50 | 12 🪙 | `{"resourceType":"pinecone"}` |
| Head Chef | `kitchen_use` | 3 | 12 🪙 | — |

#### WEEKLY_HARD Havuzu (2 adet seçilir) — scale_factors: `{t1:1.0, t2:2.0, t3:3.0}`
| Başlık | action_key | Baz Hedef | Ödül | metadata |
|--------|-----------|-----------|------|---------|
| PvP Champion | `pvp_win` | 5 | 15 🪙 | — |
| Archer Duelist | `pvp_win` | 2 | 15 🪙 | `{"championClass":"Archer"}` |
| Warrior Duelist | `pvp_win` | 2 | 15 🪙 | `{"championClass":"Warrior"}` |
| Boss Slayer | `dungeon_claim_adventure` | 1 | 15 🪙 | `{"isBoss":true}` |
| Three Star Run | `dungeon_claim_adventure` | 1 | 15 🪙 | `{"minStars":3}` |
| Deep Dungeon | `dungeon_claim_harvest` | 10 | 15 🪙 | — |
| Egg Producer | `animal_collect` | 15 | 15 🪙 | `{"resourceType":"egg"}` |
| Wool Producer | `animal_collect` | 15 | 15 🪙 | `{"resourceType":"wool"}` |
| Upgrade Enthusiast | `any_upgrade` | 3 | 15 🪙 | — |

**Haftalık toplam (t1):** 8 + 12 + 15 + 15 = **50 🪙**

---

### 6.3 Tier Bazlı Hedef Örnekleri

| Görev | Baz | t1 | t2 | t3 |
|-------|-----|-----|-----|-----|
| Enter a Dungeon | 1 | 1 | 1 | 2 |
| Gather Pinecone | 20 | 20 | 40 | 70 |
| Feed Animals | 3 | 3 | 5 | 8 |
| PvP Victor | 2 | 2 | 3 | 5 |
| Deep Dungeon | 10 | 10 | 20 | 30 |

---

## 7. İlerleme Takibi (incrementQuestProgress)

`backend/src/quests.js` dosyasındaki `incrementQuestProgress` fonksiyonu fire-and-forget çalışır — hata fırlatmaz, çağıran endpoint asla etkilenmez.

```javascript
async function incrementQuestProgress(playerId, actionKey, meta = {}) {
  try {
    const dailyKey  = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const increment = (typeof meta.amount === 'number' && meta.amount > 0) ? meta.amount : 1;

    // O anki dönemin in_progress görevlerini çek
    const rows = await query(`
      SELECT pq.id, pq.progress, pq.target_count, pq.metadata
        FROM player_quests pq
        JOIN quest_definitions qd ON qd.id = pq.definition_id
       WHERE pq.player_id = $1
         AND pq.status = 'in_progress'
         AND pq.period_key IN ($2, $3)
         AND qd.action_key = $4
    `, [playerId, dailyKey, weeklyKey, actionKey]);

    for (const row of rows) {
      if (!metaMatches(row.metadata, meta)) continue;

      // SQL LEAST() tamamen atomik — eş zamanlı istekler güvenli
      await query(`
        UPDATE player_quests
           SET progress     = LEAST(progress + $1, target_count),
               status       = CASE
                                WHEN LEAST(progress + $1, target_count) >= target_count
                                THEN 'completed'
                                ELSE 'in_progress'
                              END,
               completed_at = CASE
                                WHEN LEAST(progress + $1, target_count) >= target_count
                                 AND completed_at IS NULL
                                THEN NOW()
                                ELSE completed_at
                              END
         WHERE id = $2 AND status = 'in_progress'
      `, [increment, row.id]);
    }
  } catch (err) {
    console.error('[Quest] incrementQuestProgress failed silently:', err.message);
  }
}
```

**Eş zamanlılık güvencesi:** `LEAST(progress + $1, target_count)` tamamen SQL içinde çözülür. `AND status = 'in_progress'` koşulu idempotency sağlar — görev `completed` olduktan sonra ek update'ler çalışmaz.

---

## 8. Metadata Filtresi (metaMatches)

Bir görevin ilerlemesi için hem `action_key` eşleşmeli hem de `metadata` filtresinden geçmeli.

```javascript
// backend/src/quests.js — metaMatches()
// questMeta: görev tanımının filtre kriterleri (ne gerektiriyor)
// callMeta:  çağrı anında sağlanan bağlam (ne oldu)

function metaMatches(questMeta, callMeta) {
  if (!questMeta || Object.keys(questMeta).length === 0) return true;  // Filtre yok → eşleşir
  if (questMeta.resourceType  && questMeta.resourceType  !== callMeta.resourceType)  return false;
  if (questMeta.championClass && questMeta.championClass !== callMeta.championClass) return false;
  if (questMeta.animalType    && questMeta.animalType    !== callMeta.animalType)    return false;
  if (questMeta.dungeonType   && questMeta.dungeonType   !== callMeta.dungeonType)   return false;
  if (questMeta.isBoss        && !callMeta.isBoss)                                   return false;
  if (questMeta.minStars !== undefined && (callMeta.stars ?? 0) < questMeta.minStars) return false;
  return true;
}
```

**Desteklenen filtre alanları:**

| Alan | Tip | Örnek kullanım |
|------|-----|----------------|
| `resourceType` | string | `"pinecone"`, `"strawberry"`, `"egg"`, `"wool"`, `"milk"` |
| `championClass` | string | `"Archer"`, `"Warrior"`, `"Mage"` |
| `animalType` | string | `"chicken"`, `"sheep"`, `"cow"` |
| `dungeonType` | string | `"adventure"`, `"harvest"` |
| `isBoss` | boolean | Boss dungeon'ı için |
| `minStars` | number | Minimum yıldız sayısı |

**Örnek:** `{"resourceType":"pinecone"}` metadata'lı görev sadece `resourceType:"pinecone"` ile çağrılan `farmer_collect` aksiyonunda ilerler. Metadata'sı `{}` olan `farmer_collect` görevi ise her türlü toplama için ilerler.

---

## 9. Action Key — Tetikleme Noktaları

Her `action_key` hangi backend endpoint/fonksiyonunda tetiklendiği:

### `pvp_attack` — PvP Saldırısı
```javascript
// backend/src/controllers/pvpController.js
// Her PvP saldırısı başlangıcında (kazanılsın ya da kaybedilsin)
await incrementQuestProgress(playerId, 'pvp_attack', {
  championClass: attChamp.class,
});
```

### `pvp_win` — PvP Galibiyeti
```javascript
// backend/src/controllers/pvpController.js
// Yalnızca saldıran kazanırsa
if (attackerWon) {
  await incrementQuestProgress(playerId, 'pvp_win', {
    championClass: attChamp.class,
  });
}
```

### `dungeon_enter_adventure` — Adventure Dungeon Girişi
```javascript
// backend/src/controllers/dungeonController.js — enterDungeon()
// Champion deploy edildiğinde
if (dungeon.dungeon_type === 'adventure') {
  await incrementQuestProgress(playerId, 'dungeon_enter_adventure');
}
```

### `dungeon_claim_harvest` — Harvest Dungeon Kazanma
```javascript
// backend/src/controllers/dungeonController.js — claimRun()
if (winner === 'champion' && run.dungeon_type === 'harvest') {
  await incrementQuestProgress(playerId, 'dungeon_claim_harvest');
}
```

### `dungeon_claim_adventure` — Adventure Dungeon Kazanma
```javascript
// backend/src/controllers/dungeonController.js — claimRun()
if (winner === 'champion' && run.dungeon_type === 'adventure') {
  await incrementQuestProgress(playerId, 'dungeon_claim_adventure', {
    stars:  starsEarned,
    isBoss: !!run.is_boss_stage,
  });
}
```

### `farmer_collect` — Çiftçiden Toplama
```javascript
// backend/src/routes/farmers.js — POST /:id/collect
// amount: o toplama işleminde gerçekten toplanan kaynak miktarı
await incrementQuestProgress(playerId, 'farmer_collect', {
  resourceType: farmer.resource_type,  // 'pinecone' | 'strawberry' | 'blueberry'
  amount: collectible,                  // Değişken artış — fiilen toplanan miktar
});
```

### `any_upgrade` — Herhangi Bir Yükseltme
```javascript
// backend/src/routes/farmers.js — POST /:id/upgrade
await incrementQuestProgress(playerId, 'any_upgrade');

// backend/src/routes/animals.js — POST /:id/upgrade
await incrementQuestProgress(playerId, 'any_upgrade');
```

### `animal_feed` — Hayvan Besleme
```javascript
// backend/src/routes/animals.js — POST /:id/feed
await incrementQuestProgress(playerId, 'animal_feed', {
  animalType: animal.animal_type,  // 'chicken' | 'sheep' | 'cow'
});

// backend/src/routes/animals.js — POST /:id/feed-max
// feed-max da 1 besleme sayılır (kaç birim doldurulduğundan bağımsız)
await incrementQuestProgress(playerId, 'animal_feed', {
  animalType: animal.animal_type,
});
```

### `animal_collect` — Hayvan Ürünü Toplama
```javascript
// backend/src/routes/animals.js — POST /:id/collect (tek hayvan)
await incrementQuestProgress(playerId, 'animal_collect', {
  resourceType: cfg.produceResource,  // 'egg' | 'wool' | 'milk'
  animalType:   animal.animal_type,
  amount:       pendingProduction,     // Değişken artış — toplanan miktar
});

// backend/src/routes/farms.js — POST /:farmType/collect (toplu)
await incrementQuestProgress(playerId, 'animal_collect', {
  resourceType: PRODUCE[farmType],
  animalType:   farmType,
  amount:       totalCollected,
});
```

### `kitchen_cook` — Yemek Pişirme
```javascript
// backend/src/routes/kitchen.js — POST /cook/:recipeId
await incrementQuestProgress(playerId, 'kitchen_cook');
```

### `kitchen_use` — Yemek Kullanma
```javascript
// backend/src/routes/kitchen.js — POST /use/:foodId
await incrementQuestProgress(playerId, 'kitchen_use');
```

---

## 10. Görev Talep Etme (Claim) Akışı

### `POST /api/quests/:id/claim`

```javascript
// backend/src/routes/quests.js

// 1. Görevi doğrula
const quest = await query(
  'SELECT * FROM player_quests WHERE id = $1 AND player_id = $2',
  [questId, playerId]
);
if (quest.status !== 'completed') return 400;

// 2. Claim et (idempotent — AND status='completed' guard)
await query(
  `UPDATE player_quests SET status='claimed', claimed_at=NOW()
   WHERE id=$1 AND status='completed'`,
  [questId]
);

// 3. Ödül ver
await query(
  'UPDATE players SET coins = coins + $1 WHERE id = $2 RETURNING coins',
  [quest.reward_coins, playerId]
);

// 4. Günlük görevse bonus kontrolü
let bonus = { awarded: false };
if (quest.quest_type === 'daily') {
  bonus = await maybeAwardDailyBonus(playerId, quest.period_key);
}

// Yanıt
return {
  success: true,
  coins_awarded: quest.reward_coins,
  new_coin_total: newCoins,
  bonus,
};
```

---

## 11. Günlük Tamamlama Bonusu (maybeAwardDailyBonus)

4 günlük görev tamamlanıp claim edildiğinde **bir kez** tetiklenir.

```javascript
// backend/src/quests.js — maybeAwardDailyBonus()

async function maybeAwardDailyBonus(playerId, periodKey) {
  if (!periodKey.startsWith('daily:')) return { awarded: false };

  const rows = await query(
    'SELECT status, bonus_claimed FROM player_quests WHERE player_id = $1 AND period_key = $2',
    [playerId, periodKey]
  );

  // Koşullar: tam 4 satır, hepsi 'claimed', hiçbirinde bonus_claimed = TRUE yok
  if (rows.length !== 4) return { awarded: false };
  const allClaimed   = rows.every(r => r.status === 'claimed');
  const alreadyGiven = rows.some(r => r.bonus_claimed);
  if (!allClaimed || alreadyGiven) return { awarded: false };

  // Bonus: 8 coin + 3 adet rastgele nadir kaynak
  const bonusCoins    = 8;
  const bonusResource = ['egg', 'wool', 'milk'][Math.floor(Math.random() * 3)];
  const bonusAmount   = 3;

  await query('UPDATE players SET coins = coins + $1 WHERE id = $2', [bonusCoins, playerId]);
  await query(
    `UPDATE player_resources SET ${bonusResource} = LEAST(${bonusResource} + $1, ${bonusResource}_cap) WHERE player_id = $2`,
    [bonusAmount, playerId]
  );
  // Tekrar ödül verilmemesi için işaretle
  await query(
    `UPDATE player_quests SET bonus_claimed = TRUE WHERE id = (
       SELECT id FROM player_quests WHERE player_id = $1 AND period_key = $2 LIMIT 1
     )`,
    [playerId, periodKey]
  );

  return { awarded: true, coins: bonusCoins, resource: bonusResource, amount: bonusAmount };
}
```

**Bonus miktarları:**
- +8 🪙 Coin
- +3 adet: Yumurta (`egg`) veya Yün (`wool`) veya Süt (`milk`) (rastgele)

---

## 12. API Endpoint'leri

### `GET /api/quests`

```javascript
// 1. Günlük ve haftalık görevleri ata (henüz atanmamışsa)
await ensureQuestsAssigned(playerId, 'daily');
await ensureQuestsAssigned(playerId, 'weekly');

// 2. Mevcut dönem görevlerini JOIN ile çek
// (title, description, category, action_key = quest_definitions'dan gelir)

// 3. Bonus durumunu hesapla

// Yanıt:
{
  "daily":  [ PlayerQuest... ],
  "weekly": [ PlayerQuest... ],
  "dailyBonus": {
    "claimed_count": 2,
    "total": 4,
    "bonus_coins": 8,
    "bonus_resource": "egg",
    "bonus_amount": 3,
    "already_claimed": false
  }
}
```

### `POST /api/quests/:id/claim`

```javascript
// Yanıt:
{
  "success": true,
  "coins_awarded": 5,
  "new_coin_total": 120,
  "bonus": {
    "awarded": true,
    "coins": 8,
    "resource": "wool",
    "amount": 3
  }
}
```

---

## 13. Frontend Katmanı

### Dosya Listesi

| Dosya | Rol |
|-------|-----|
| `frontend/app/(game)/quests.tsx` | Ana görev ekranı |
| `frontend/components/QuestCard.tsx` | Tek görev kartı |
| `frontend/components/QuestBonusBar.tsx` | Günlük bonus ilerleme çubuğu |
| `frontend/lib/query/questOptimistic.ts` | Optimistik güncelleme fonksiyonları |
| `frontend/lib/query/mutations.ts` | Görev claim mutation'ı + tüm aksiyonlarda quest invalidation |
| `frontend/lib/store/useFeedQueue.ts` | Hayvan besleme queue'su (quest tracking dahil) |

### Ekran Akışı (quests.tsx)

```
Header: [← Geri] [Görevler başlığı] [Coin sayacı 🪙N]
Tabs: [Daily] [Weekly]
ScrollView:
  ← QuestCard × 4
  ← QuestBonusBar (yalnızca Daily tab'da)
  ← ResetCountdown (tüm görevler claim edilmişse)
[Coin uçuş animasyonu — claim anında]
```

**Coin animasyonu:** Claim butonundan header'daki coin sayacına `ResourceCollectAnimation` ile uçar. `bonus.awarded === true` ise bonus coin'ler de toplam animasyona eklenir.

**Countdown:** Tüm görevler claim edildiğinde bir sonraki sıfırlamaya kalan süre gösterilir. 24 saatten az ise `HHh:MMm:SSs`, 24 saatten fazla ise `Nd:HHh:MMm:SSs` formatında (haftalık görevler için genelde gün bilgisi görünür).

### QuestCard Durumları

| Status | Buton görünümü | Buton aksiyonu |
|--------|---------------|----------------|
| `in_progress` | Gri, "In Progress" | Devre dışı |
| `completed` | Yeşil, "Claim!" | Tıklanabilir |
| `claimed` | Şeffaf, ✓ "Claimed" | Devre dışı |

### TypeScript Tipleri (types/index.ts)

```typescript
export type QuestStatus = 'in_progress' | 'completed' | 'claimed';

export type PlayerQuest = {
  id: string;
  definition_id: string;
  title: string;
  description: string;
  category: string;          // pvp | dungeon | resource | animal | cooking | upgrade
  difficulty: string;
  action_key: string;
  progress: number;
  target_count: number;      // Ölçeklenmiş değer
  reward_coins: number;
  status: QuestStatus;
  quest_type: 'daily' | 'weekly';
  period_key: string;
  bonus_claimed: boolean;
  metadata: Record<string, any>;
};

export type DailyBonus = {
  claimed_count: number;
  total: number;
  bonus_coins: number;
  bonus_resource: string;
  bonus_amount: number;
  already_claimed: boolean;
};

export type QuestsResponse = {
  daily: PlayerQuest[];
  weekly: PlayerQuest[];
  dailyBonus: DailyBonus;
};

export type ClaimQuestResult = {
  success: boolean;
  coins_awarded: number;
  new_coin_total: number;
  bonus: {
    awarded: boolean;
    coins?: number;
    resource?: string;
    amount?: number;
  };
};
```

---

## 14. Optimistik Güncellemeler (questOptimistic.ts)

Sunucu yanıtını beklemeden UI'ı anında güncelleyen iki yardımcı fonksiyon.

### `optimisticQuestProgress`

```typescript
// frontend/lib/query/questOptimistic.ts

export function optimisticQuestProgress(
  queryClient: QueryClient,
  actionKey: string,
  meta: { resourceType?, animalType?, championClass?, isBoss?, stars?, amount? } = {},
): void {
  const increment = (typeof meta.amount === 'number' && meta.amount > 0) ? meta.amount : 1;

  queryClient.setQueryData<QuestsResponse>(queryKeys.quests(), (old) => {
    if (!old) return old;
    function applyToList(list: PlayerQuest[]) {
      return list.map((q) => {
        if (q.status !== 'in_progress') return q;
        if (q.action_key !== actionKey) return q;
        if (!metaMatchesFE(q.metadata ?? {}, meta)) return q;

        const newProgress = Math.min(q.progress + increment, q.target_count);
        const newStatus = newProgress >= q.target_count ? 'completed' : 'in_progress';
        return { ...q, progress: newProgress, status: newStatus };
      });
    }
    return { ...old, daily: applyToList(old.daily), weekly: applyToList(old.weekly) };
  });
}
```

### `optimisticQuestClaim`

```typescript
export function optimisticQuestClaim(queryClient: QueryClient, questId: string): void {
  queryClient.setQueryData<QuestsResponse>(queryKeys.quests(), (old) => {
    if (!old) return old;
    const newDaily  = old.daily.map(q => q.id === questId ? { ...q, status: 'claimed' } : q);
    const newWeekly = old.weekly.map(q => q.id === questId ? { ...q, status: 'claimed' } : q);
    const dailyClaimedCount = newDaily.filter(q => q.status === 'claimed').length;
    return {
      ...old,
      daily: newDaily,
      weekly: newWeekly,
      dailyBonus: { ...old.dailyBonus, claimed_count: dailyClaimedCount },
    };
  });
}
```

### Optimistik güncelleme tetikleme noktaları

| Aksiyon | Tetikleme yeri | Fonksiyon |
|---------|---------------|-----------|
| Çiftçiden toplama | `useCollectFarmerMutation` onMutate | `optimisticQuestProgress('farmer_collect', { resourceType, amount })` |
| Çiftçi yükseltme | `useUpgradeFarmerMutation` onMutate | `optimisticQuestProgress('any_upgrade')` |
| Tek hayvan toplama | `useCollectAnimalMutation` onMutate | `optimisticQuestProgress('animal_collect', { resourceType, animalType, amount })` |
| Hayvan yükseltme | `useUpgradeAnimalMutation` onMutate | `optimisticQuestProgress('any_upgrade')` |
| Toplu farm toplama | `useCollectFarmMutation` onMutate | `optimisticQuestProgress('animal_collect', { resourceType, animalType, amount })` |
| Hayvan besleme (ana ekran) | `useFeedQueue.tapFeed` | `optimisticQuestProgress('animal_feed', { animalType })` |
| Hayvan max besleme | `useFeedQueue.tapFeedMax` | `optimisticQuestProgress('animal_feed', { animalType })` |
| Hayvan besleme (farm ekranı) | `farm/[type].tsx` feed butonu | `optimisticQuestProgress('animal_feed', { animalType })` |
| Görev claim | `useClaimQuestMutation` onMutate | `optimisticQuestClaim(questId)` |

---

## 15. Cache Geçersizleştirme (Invalidation) Noktaları

Optimistik güncellemenin ardından sunucu yanıtı geldiğinde `quests` cache'i yenilenir:

| Tetikleyici | Konum |
|------------|-------|
| Çiftçiden toplama (settle) | `useCollectFarmerMutation` onSettled |
| Çiftçi yükseltme (settle) | `useUpgradeFarmerMutation` onSettled |
| Hayvan toplama (settle) | `useCollectAnimalMutation` onSettled |
| Hayvan yükseltme (settle) | `useUpgradeAnimalMutation` onSettled |
| Toplu farm toplama (settle) | `useCollectFarmMutation` onSettled |
| Dungeon claim (settle) | `useClaimRunMutation` onSettled |
| PvP saldırısı (settle) | `pvp.tsx` — invalidate sonrası |
| Yemek pişirme (settle) | `kitchen.tsx` — invalidate sonrası |
| Yemek kullanma (settle) | `FarmerDrawer`, `ChampionDrawer` |
| Hayvan besleme flush (success) | `useFeedQueue._flush` |
| Farm ekranı besleme (success) | `farm/[type].tsx` flushFeedBufferRef |
| Görev claim (settle) | `useClaimQuestMutation` onSettled |

---

## 16. Kenar Durumlar ve Güvenceler

### Süresi Dolmuş Görevler
`GET /api/quests` yalnızca **mevcut** dönemin `period_key`'ini sorgular. Dünkü `completed` satırları hiç görünmez. `POST /api/quests/:id/claim` dönem kontrolü yapmaz — oyuncu kazanılmış görevi geç de claim edebilir.

### Eş Zamanlı İstekler
- İlerleme: `LEAST(progress + $1, target_count)` + `AND status='in_progress'` → progress asla `target_count`'u geçemez
- Atama: `ON CONFLICT DO NOTHING` → çift kayıt oluşmaz
- Claim: `WHERE status='completed'` guard → yalnızca bir kez çalışır; ikinci claim 400 döner
- Bonus: `bonus_claimed=TRUE` kontrolü → çift ödül engellenir

### Kısmi Atama Kurtarma
`ensureQuestsAssigned` içindeki hızlı kontrol: `COUNT >= 4`. Eski kod `> 0` kullanıyordu — bu sayede kısmi atamalar (1 veya 2 görev eklenmiş ama kalan eklenmemiş) kilitleniyordu. `>= 4` ile eksik atamalar tamamlanır.

### Feed Queue Batching
Oyuncu hızlıca 3 kez besleme tuşuna basarsa:
- 1. tap: buffer=1, flush → `/feed` (1 olay)
- 2. tap (uçuştayken): buffer=1
- 3. tap (uçuştayken): buffer=2
- 1. flush tamamlanır → 2. flush `/feed-max?requestedUnits=2` (1 olay)

Toplam: 2 API çağrısı = 2 `animal_feed` olayı (sunucu tarafı). Optimistik taraf 3 artırır, invalidation düzeltir.

---

## 17. React Query Cache Yapısı

```typescript
// queryKeys.ts
quests: () => ['quests'] as const

// queryConfig.ts
quests: 30 * 1000  // 30 saniye stale time
```

Ana ekranda görev badge'i (claimable count) için:
```typescript
// index.tsx
const { data: questsData } = useQuestsQuery();
const claimableQuestCount = (questsData?.daily ?? [])
  .filter(q => q.status === 'completed').length;
```

---

## 18. Bakım Notları

- **Yeni görev eklemek:** `seed.js`'e yeni bir satır ekle → `node src/seed.js` çalıştır. Görev tanım tablosu idempotent eklemeyi destekler.
- **Görev içeriğini güncellemek:** `quest_definitions` tablosunu direkt güncelle veya `migrate.js`'e bir UPDATE bloğu ekle.
- **Açıklama/başlıkta sayı kullanmaktan kaçın:** `target_count` tier'a göre ölçeklenir. Sayılar açıklamaya yazılırsa t2/t3 oyuncular için yanlış görünür. Progress bar zaten `progress/target_count` gösterir.
- **Yeni aksiyon anahtarı eklemek:** Backend'de `incrementQuestProgress(playerId, 'yeni_key')` çağır, frontend'de ilgili mutation'ın `onMutate`'ine `optimisticQuestProgress(queryClient, 'yeni_key', ...)` ekle.
