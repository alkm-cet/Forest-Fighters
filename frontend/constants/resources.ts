export const RESOURCE_META: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  strawberry: { icon: "🍓", label: "Strawberry", color: "#e8534a" },
  pinecone:   { icon: "🌲", label: "Pinecone",   color: "#5a8a3c" },
  blueberry:  { icon: "🫐", label: "Blueberry",  color: "#5b6bbf" },
};

export const CLASS_META: Record<
  string,
  { emoji: string; color: string; image: ReturnType<typeof require>; cost: number }
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
