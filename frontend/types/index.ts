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
  last_defender: boolean;
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
};

export type Player = {
  id: string;
  username: string;
  email: string;
  coins: number;
};

export type Dungeon = {
  id: string;
  name: string;
  description: string;
  enemy_name: string;
  enemy_attack: number;
  enemy_defense: number;
  enemy_chance: number;
  enemy_hp: number;
  duration_minutes: number;
  reward_resource: "strawberry" | "pinecone" | "blueberry";
  reward_amount: number;
  xp_reward: number;
};

export type DungeonRun = {
  id: string;
  champion_id: string;
  champion_name: string;
  dungeon_id: string;
  dungeon_name: string;
  started_at: string;
  ends_at: string;
  status: "active" | "completed" | "claimed";
  winner: "champion" | "enemy" | null;
  reward_resource: string | null;
  reward_amount: number | null;
};

export type PvpStatus = {
  trophies: number;
  league: string;
  defender_champion_id: string | null;
  pending_battle: {
    battleId: string;
    result_available_at: string;
    opponent_name: string;
  } | null;
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
  fought_at: string;
  result_available_at: string;
  status: "pending" | "resolved";
  attacker_trophies_delta: number;
  defender_trophies_delta: number;
  transferred_strawberry: number;
  transferred_pinecone: number;
  transferred_blueberry: number;
  revenge_used: boolean;
};
