export type ResourceKey = "strawberry" | "pinecone" | "blueberry";
export type AdvancedResourceKey = "egg" | "wool" | "milk";

export type Resources = {
  strawberry: number;
  pinecone: number;
  blueberry: number;
  strawberry_cap: number;
  pinecone_cap: number;
  blueberry_cap: number;
  egg: number;
  wool: number;
  milk: number;
  egg_cap: number;
  wool_cap: number;
  milk_cap: number;
};

export type AnimalType = "chicken" | "sheep" | "cow";

export type Animal = {
  id: string;
  animal_type: AnimalType;
  farm_id?: string;
  level: number;
  current_feed: number;        // display: floor(fuel_remaining_minutes / minutes_per_feed)
  max_feed: number;            // max feed units (e.g. 30)
  fuel_remaining_minutes: number;
  max_fuel_minutes: number;
  progress_minutes: number;    // progress into current production cycle at the moment of fetch
  pending: number;
  next_ready_in_seconds: number | null; // null when stopped
  interval_minutes: number;
  minutes_per_feed: number;
  max_capacity: number;
  is_running: boolean;
  consume_resource: string;
  produce_resource: string;
  _fetched_at_ms: number;      // client-side: Date.now() when this snapshot arrived
};

export type Farm = {
  id: string;
  farm_type: AnimalType;
  level: number;            // farm level = max slots (max 20)
  slot_count: number;       // min(level, 20)
  animals: Animal[];        // individual animals in this farm (each with _fetched_at_ms)
  total_pending: number;    // sum of animals' pending
  produce_resource: string;
  consume_resource: string;
};

export type Champion = {
  id: string;
  name: string;
  class: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  attack: number;
  defense: number;
  chance: number;
  max_hp: number;
  current_hp: number;
  is_deployed: boolean;
  stat_points: number;
  boost_hp: number;
  boost_defense: number;
  boost_chance: number;
  boost_attack: number;
  last_defender: boolean;
  // Gear bonuses (capped at 50% of base stat, summed from equipped gear)
  gear_attack: number;
  gear_defense: number;
  gear_chance: number;
};

export type Farmer = {
  id: string;
  name: string;
  resource_type: string;
  level: number;
  interval_minutes: number;
  pending: number;
  next_ready_in_seconds: number;
  last_collected_at?: string;  // ISO string from backend, used to detect data updates
  _fetched_at_ms: number;      // client-side: Date.now() when this snapshot arrived
  active_boost_pct?: number;   // sum of active boost_production % for this farmer
};

export type Player = {
  id: string;
  username: string;
  email: string;
  coins: number;
};

export type DungeonType = "harvest" | "adventure" | "event";

export type Dungeon = {
  id: string;
  name: string;
  description: string;
  dungeon_type: DungeonType;
  enemy_name: string;
  enemy_attack: number;
  enemy_defense: number;
  enemy_chance: number;
  enemy_hp: number;
  duration_minutes: number;
  duration_seconds?: number | null;
  reward_resource: string;
  reward_amount: number;
  reward_resource_2?: string | null;
  reward_amount_2?: number;
  xp_reward: number;
  coin_reward?: number;
  reward_multiplier?: number;
  // Harvest
  cooldown_minutes?: number | null;
  daily_run_limit?: number | null;
  min_champion_level?: number | null;
  extra_rewards?: Array<{ resource: string; amount: number }>;
  // Adventure
  stage_number?: number | null;
  is_boss_stage?: boolean;
  dungeon_level?: number | null;
  // Event
  event_starts_at?: string | null;
  event_ends_at?: string | null;
};

export type HarvestDungeon = Dungeon & { dungeon_type: "harvest" };
export type AdventureDungeon = Dungeon & { dungeon_type: "adventure"; stage_number: number };
export type EventDungeon = Dungeon & { dungeon_type: "event" };

export type DungeonRun = {
  id: string;
  champion_id: string;
  champion_name: string;
  champion_class?: string;
  dungeon_id: string;
  dungeon_name: string;
  started_at: string;
  ends_at: string;
  status: "active" | "completed" | "claimed";
  winner: "champion" | "enemy" | null;
  reward_resource: string | null;
  reward_amount: number | null;
  stars_earned: number | null;
  dungeon_type?: DungeonType;
  reward_resource_2?: string | null;
  reward_amount_2?: number | null;
  champion_id_2?: string | null;
  champion2_name?: string | null;
  champion2_class?: string | null;
  is_boss_stage?: boolean;
};

export type AdventureProgress = {
  dungeon_id: string;
  stage_number: number;
  best_stars: number;
  cleared_at: string | null;
  name: string;
};

export type HarvestCooldown = {
  dungeon_id: string;
  last_run_at: string;
  runs_today: number;
  day_reset_at: string;
  cooldown_minutes: number | null;
  daily_run_limit: number | null;
};

export type AdventureMilestone = {
  required_stars: number;
  reward_coins: number;
  reward_resource: string | null;
  reward_amount: number;
  label: string;
  claimed: boolean;
};

export type GearRarity = 'common' | 'rare' | 'epic';

export type GearSnapshot = {
  weapon: PlayerGear | null;
  charm: PlayerGear | null;
};

export type GearDefinition = {
  id: string;
  name: string;
  gear_type: 'weapon' | 'charm';
  class_restriction: string | null;
  tier: 1 | 2 | 3;
  base_attack: number;
  base_defense: number;
  base_chance: number;
  atk_increment: number;
  def_increment: number;
  chance_increment: number;
  emoji: string;
};

export type PlayerGear = {
  id: string;
  player_id: string;
  definition_id: string;
  definition: GearDefinition;
  rarity: GearRarity;
  level: number;
  equipped_champion_id: string | null;
  equipped_slot: 'weapon' | 'charm' | null;
  acquired_at: string;
  // Computed by backend (rarity multiplier + level applied):
  attack_bonus: number;
  defense_bonus: number;
  chance_bonus: number;
};

export type ClaimResult = {
  winner: "champion" | "enemy";
  enemyName?: string | null;
  rewardResource: string;
  rewardAmount: number;
  rewardResource2: string | null;
  rewardAmount2: number;
  coinReward: number;
  starsEarned: number | null;
  log: any[];
  xpGained: number;
  levelsGained: number;
  newLevel: number;
  gearDrops?: PlayerGear[];
  championGear?: GearSnapshot;
  extraRewards?: Array<{ resource: string; amount: number }>;
  // Boss battle extras
  isBossBattle?: boolean;
  champion2Name?: string;
  champion2Class?: string;
  champion2HpLeft?: number;
  champion2XpGained?: number;
  champion2LevelsGained?: number;
  champion2NewLevel?: number;
  c1StartStats?: { attack: number; defense: number; chance: number; hp: number };
  c2StartStats?: { attack: number; defense: number; chance: number; hp: number };
  bossStartStats?: { attack: number; defense: number; chance: number; hp: number };
};

export type PvpStatus = {
  trophies: number;
  league: string;
  pvp_unlocked: boolean;
  defender_champion_id: string | null;
  pending_battle: {
    battleId: string;
    result_available_at: string;
    opponent_name: string;
    attacker_champion_id: string | null;
  } | null;
};

export type Recipe = {
  id: string;
  name: string;
  target: 'fighters' | 'farmers' | 'animals' | 'farm_animals' | 'all' | 'gear';
  effect_type: string;
  effect_value: number;
  effect_duration_minutes: number | null;
  cook_duration_minutes: number;
  ingredients: Partial<Record<ResourceKey | AdvancedResourceKey, number>>;
  tier: 1 | 2 | 3;
  gear_upgrade_tier?: number | null;
};

export type PlayerFood = {
  id: string;
  recipe_id: string;
  recipe: Recipe;
  status: 'cooking' | 'ready' | 'used';
  cooking_started_at: string;
  cooking_ready_at: string;
  cooking_ready_at_ms: number;
  cooking_started_at_ms: number;
  _fetched_at_ms: number;
  used_at: string | null;
  expires_at_ms?: number;  // when the boost from this food expires (set after use)
};

export type ActiveBoost = {
  id: string;
  boost_type: string;
  boost_value: number;
  target: string;
  expires_at: string;
  entity_id?: string | null;
  is_one_shot: boolean;
};

// ── Quest System ──────────────────────────────────────────────────────────────

export type QuestStatus = 'in_progress' | 'completed' | 'claimed';

export type PlayerQuest = {
  id: string;
  definition_id: string;
  quest_type: 'daily' | 'weekly';
  period_key: string;
  progress: number;
  target_count: number;
  reward_coins: number;
  metadata: Record<string, any>;
  status: QuestStatus;
  bonus_claimed: boolean;
  assigned_at: string;
  completed_at: string | null;
  claimed_at: string | null;
  // joined from quest_definitions
  title: string;
  description: string;
  category: string;
  difficulty: string;
  action_key: string;
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

export type PvpBattle = {
  id: string;
  attacker_id: string;
  defender_id: string;
  attacker_champion_id: string;
  defender_champion_id: string;
  winner_id: string;
  attacker_name: string;
  defender_name: string;
  attacker_champion_name: string;
  attacker_champion_class: string;
  defender_champion_name: string;
  defender_champion_class: string;
  combat_log: any[];
  battle_log?: { attacker?: { attack: number; defense: number; chance: number; hp: number }; defender?: { attack: number; defense: number; chance: number; hp: number } } | null;
  fought_at: string;
  result_available_at: string;
  status: "pending" | "resolved";
  attacker_trophies_delta: number;
  defender_trophies_delta: number;
  transferred_strawberry: number;
  transferred_pinecone: number;
  transferred_blueberry: number;
  revenge_used: boolean;
  gear_snapshot?: {
    attacker: GearSnapshot;
    defender: GearSnapshot;
  };
};
