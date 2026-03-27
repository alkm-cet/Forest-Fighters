import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Resources } from "../types";
import { RESOURCE_META } from "../constants/resources";

const PLUS_BTN = require("../assets/plus-button-image.png");

type Props = {
  resources: Resources;
};

type Entry = { key: keyof Resources; amount: number };

export default function ResourceBar({ resources }: Props) {
  const entries: Entry[] = [
    { key: "strawberry", amount: resources.strawberry },
    { key: "pinecone", amount: resources.pinecone },
    { key: "blueberry", amount: resources.blueberry },
  ];

  return (
    <View style={styles.container}>
      {entries.map(({ key, amount }) => {
        const meta = RESOURCE_META[key];
        return (
          <View key={key} style={styles.section}>
            {/* Resource name */}
            <Text style={styles.label}>{meta.label}</Text>

            {/* Row: image overlaps badge from the left */}
            <View style={styles.row}>
              {/* Resource image — rendered last so it sits on top */}
              <Image
                source={meta.image}
                style={styles.resourceImage}
                resizeMode="contain"
              />
              {/* Badge pulled left under the image */}
              <View style={styles.amountBadge}>
                <Text style={styles.amountText}>{amount}</Text>
                <TouchableOpacity activeOpacity={0.8} style={styles.plusWrap}>
                  <Image
                    source={PLUS_BTN}
                    style={styles.plusBtn}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "#f5e9cc",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#c8a96e",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    paddingRight: 16,
  },
  section: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a2e0a",
    textAlign: "right",
    width: "100%",
    paddingRight: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Image overlaps the badge: rendered after badge in JSX but zIndex higher
  resourceImage: {
    width: 40,
    height: 40,
    zIndex: 2,
  },
  amountBadge: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d4aa6e",
    height: 24,
    borderRadius: 10,
    paddingLeft: 12, // space for the image that overlaps from the left
    paddingRight: 4,
    marginLeft: -16, // pulls badge under the resource image
    zIndex: 1,
    gap: 4,
  },
  amountText: {
    color: "#3a1e00",
    fontSize: 14,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
    width: 40,
  },
  plusWrap: {
    marginLeft: 2,
  },
  plusBtn: {
    position: "absolute",
    right: -20,
    bottom: 0,
    transform: [{ translateY: "50%" }],
    width: 28,
    height: 28,
  },
});
