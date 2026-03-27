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
  attack: number;
  defense: number;
  chance: number;
  max_hp: number;
  current_hp: number;
  is_deployed: boolean;
};

export type Farmer = {
  id: string;
  name: string;
  resource_type: string;
  production_rate: number;
  level: number;
};

export type Player = {
  id: string;
  username: string;
  email: string;
};
