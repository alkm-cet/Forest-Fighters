export type Resources = {
  strawberry: number;
  pinecone: number;
  blueberry: number;
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
};

export type Farmer = {
  id: string;
  name: string;
  resource_type: string;
  level: number;
  interval_minutes: number;
  pending: number;
  next_ready_in_seconds: number;
};

export type Player = {
  id: string;
  username: string;
  email: string;
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
