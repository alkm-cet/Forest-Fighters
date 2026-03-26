import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Resources } from "../types";
import { RESOURCE_META } from "../constants/resources";

type Props = {
  resources: Resources;
};

export default function ResourceBar({ resources }: Props) {
  const entries: { key: keyof Resources; amount: number }[] = [
    { key: "strawberry", amount: resources.strawberry },
    { key: "pinecone",   amount: resources.pinecone },
    { key: "blueberry",  amount: resources.blueberry },
  ];

  return (
    <View style={styles.container}>
      {entries.map(({ key, amount }) => {
        const meta = RESOURCE_META[key];
        return (
          <View key={key} style={styles.pill}>
            <Text style={styles.icon}>{meta.icon}</Text>
            <View style={styles.labelBlock}>
              <Text style={styles.label}>{meta.label}</Text>
              <Text style={styles.amount}>{amount}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
              <Text style={styles.addText}>+</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 20,
  },
  labelBlock: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: "#888",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  amount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
    lineHeight: 16,
  },
  addBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4caf50",
    justifyContent: "center",
    alignItems: "center",
  },
  addText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
  },
});
