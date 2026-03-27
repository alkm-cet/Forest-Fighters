export const RESOURCE_META: Record<
  string,
  { image: ReturnType<typeof require>; label: string; color: string }
> = {
  strawberry: {
    image: require("../assets/resource-images/strawberry.webp"),
    label: "Strawberry",
    color: "#e8534a",
  },
  pinecone: {
    image: require("../assets/resource-images/pinecone.webp"),
    label: "Pinecone",
    color: "#5a8a3c",
  },
  blueberry: {
    image: require("../assets/resource-images/blueberry.webp"),
    label: "Blueberry",
    color: "#5b6bbf",
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
