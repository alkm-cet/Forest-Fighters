import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./StyledText";
import { Resources, ResourceKey, AdvancedResourceKey } from "../types";
import { RESOURCE_META, ANIMAL_META } from "../constants/resources";
import { useLanguage, TranslationKeys } from "../lib/i18n";

const PLUS_BTN = require("../assets/plus-button-image.png");

type Props = {
  resources: Resources;
  onUpgrade?: (resource: ResourceKey) => void;
  onUpgradeAdvanced?: (resource: AdvancedResourceKey) => void;
};

type Entry = { key: ResourceKey; amount: number; cap: number };

// Emoji icons for advanced resources (no image assets yet)
const ADVANCED_RESOURCE_EMOJI: Record<string, string> = {
  egg: "🥚",
  wool: "🧶",
  milk: "🥛",
};

export default function ResourceBar({
  resources,
  onUpgrade,
  onUpgradeAdvanced,
}: Props) {
  const { t } = useLanguage();
  const entries: Entry[] = [
    {
      key: "strawberry",
      amount: resources.strawberry,
      cap: resources.strawberry_cap ?? 10,
    },
    {
      key: "pinecone",
      amount: resources.pinecone,
      cap: resources.pinecone_cap ?? 10,
    },
    {
      key: "blueberry",
      amount: resources.blueberry,
      cap: resources.blueberry_cap ?? 10,
    },
  ];

  const advancedEntries = [
    {
      key: "egg",
      amount: resources.egg ?? 0,
      cap: resources.egg_cap ?? 10,
      producedBy: "chicken",
    },
    {
      key: "wool",
      amount: resources.wool ?? 0,
      cap: resources.wool_cap ?? 10,
      producedBy: "sheep",
    },
    {
      key: "milk",
      amount: resources.milk ?? 0,
      cap: resources.milk_cap ?? 10,
      producedBy: "cow",
    },
  ];
  const hasAdvanced = advancedEntries.some((e) => e.amount > 0 || e.cap > 10);

  return (
    <View style={styles.wrapper}>
      {/* Row 1: Basic resources */}
      <View style={styles.container}>
        {entries.map(({ key, amount, cap }) => {
          const meta = RESOURCE_META[key];
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.label}>{t(key as TranslationKeys)}</Text>
              <View style={styles.row}>
                {meta.image ? (
                  <Image
                    source={meta.image}
                    style={styles.resourceImage}
                    resizeMode="contain"
                  />
                ) : null}
                <View style={styles.amountBadge}>
                  <Text style={styles.amountText}>
                    {amount}
                    <Text style={styles.capText}>/{cap}</Text>
                  </Text>
                  {cap < 100 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.plusWrap}
                      onPress={() => onUpgrade?.(key)}
                    >
                      <Image
                        source={PLUS_BTN}
                        style={styles.plusBtn}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Row 2: Advanced resources — always visible to show animals are present */}
      <View style={styles.container}>
        {advancedEntries.map(({ key, amount, cap }) => {
          const meta = RESOURCE_META[key];
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.label}>{t(key as TranslationKeys)}</Text>
              <View style={styles.row}>
                {meta.image ? (
                  <Image
                    source={meta.image}
                    style={styles.resourceImage}
                    resizeMode="contain"
                  />
                ) : null}
                <View style={styles.amountBadge}>
                  <Text style={styles.amountText}>
                    {amount}
                    <Text style={styles.capText}>/{cap}</Text>
                  </Text>
                  {cap < 100 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.plusWrap}
                      onPress={() =>
                        onUpgradeAdvanced?.(key as AdvancedResourceKey)
                      }
                    >
                      <Image
                        source={PLUS_BTN}
                        style={styles.plusBtn}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 8,
    gap: 6,
  },
  container: {
    flexDirection: "row",
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
    fontWeight: "900",
    fontFamily: "Fredoka-Bold",
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
    paddingLeft: 22, // space for the image that overlaps from the left
    paddingRight: 14,
    marginLeft: -16, // pulls badge under the resource image
    zIndex: 1,
    gap: 4,
  },
  amountText: {
    color: "#3a1e00",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
    fontFamily: "Fredoka-Bold",
  },
  capText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6a3e10",
    fontFamily: "Fredoka-Bold",
  },
  plusWrap: {
    marginLeft: 2,
  },
  plusBtn: {
    position: "absolute",
    right: -30,
    bottom: 0,
    transform: [{ translateY: "50%" }],
    width: 28,
    height: 28,
  },
});
