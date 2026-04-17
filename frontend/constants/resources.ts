export const RESOURCE_META: Record<
  string,
  {
    image: ReturnType<typeof require> | null;
    catImage?: ReturnType<typeof require> | null;
    label: string;
    color: string;
  }
> = {
  strawberry: {
    image: require("../assets/resource-images/strawberry.webp"),
    catImage: require("../assets/cats/strawberry-cat.webp"),
    label: "Strawberry",
    color: "#e8534a",
  },
  pinecone: {
    image: require("../assets/resource-images/pinecone.webp"),
    catImage: require("../assets/cats/pinecone-cat.webp"),
    label: "Pinecone",
    color: "#5a8a3c",
  },
  blueberry: {
    image: require("../assets/resource-images/blueberry.webp"),
    catImage: require("../assets/cats/blueberry-cat.webp"),
    label: "Blueberry",
    color: "#5b6bbf",
  },
  egg: {
    image: require("../assets/resource-images/egg.png"),
    label: "Egg",
    color: "#e8c840",
  },
  wool: {
    image: require("../assets/resource-images/wool.png"),
    label: "Wool",
    color: "#b0b8c8",
  },
  milk: {
    image: require("../assets/resource-images/milk.png"),
    label: "Milk",
    color: "#d4a070",
  },
};

export const ANIMAL_META: Record<
  string,
  {
    image: ReturnType<typeof require>;
    label: string;
    consumeResource: string;
    produceResource: string;
    color: string;
  }
> = {
  chicken: {
    image: require("../assets/animals/chicken.png"),
    label: "Chicken",
    consumeResource: "strawberry",
    produceResource: "egg",
    color: "#e8534a",
  },
  sheep: {
    image: require("../assets/animals/sheep.png"),
    label: "Sheep",
    consumeResource: "pinecone",
    produceResource: "wool",
    color: "#5a8a3c",
  },
  cow: {
    image: require("../assets/animals/cow.png"),
    label: "Cow",
    consumeResource: "blueberry",
    produceResource: "milk",
    color: "#5b6bbf",
  },
};

export const FARM_META: Record<
  string,
  {
    image: ReturnType<typeof require>;
    label: string;
    farmLabel: string;
    consumeResource: string;
    produceResource: string;
    color: string;
    upgradeCostPerLevel: number; // pinecone cost = farmLevel * upgradeCostPerLevel
  }
> = {
  chicken: {
    image: require("../assets/animals/chicken.png"),
    label: "Chicken",
    farmLabel: "Chicken Farm",
    consumeResource: "strawberry",
    produceResource: "egg",
    color: "#e8534a",
    upgradeCostPerLevel: 10,
  },
  sheep: {
    image: require("../assets/animals/sheep.png"),
    label: "Sheep",
    farmLabel: "Sheep Farm",
    consumeResource: "pinecone",
    produceResource: "wool",
    color: "#5a8a3c",
    upgradeCostPerLevel: 10,
  },
  cow: {
    image: require("../assets/animals/cow.png"),
    label: "Cow",
    farmLabel: "Cow Farm",
    consumeResource: "blueberry",
    produceResource: "milk",
    color: "#5b6bbf",
    upgradeCostPerLevel: 10,
  },
};

export const CLASS_META: Record<
  string,
  {
    emoji: string;
    color: string;
    image: ReturnType<typeof require>;
    cost: number;
  }
> = {
  Warrior: {
    emoji: "⚔️",
    color: "#c0392b",
    image: require("../assets/cats/warrior-cat.webp"),
    cost: 50,
  },
  Mage: {
    emoji: "🔮",
    color: "#8e44ad",
    image: require("../assets/cats/mage-cat.webp"),
    cost: 100,
  },
  Archer: {
    emoji: "🏹",
    color: "#27ae60",
    image: require("../assets/cats/archer-cat.webp"),
    cost: 75,
  },
};

import type { GearRarity } from '../types';

export const RARITY_META: Record<GearRarity, { label: string; color: string; borderColor: string }> = {
  common: { label: 'Common', color: '#757575', borderColor: '#9E9E9E' },
  rare:   { label: 'Rare',   color: '#1976D2', borderColor: '#2196F3' },
  epic:   { label: 'Epic',   color: '#7B1FA2', borderColor: '#8A5CC7' },
};
