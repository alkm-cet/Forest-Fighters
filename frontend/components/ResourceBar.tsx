import { View, Image, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { useState } from "react";
import { Text } from "./StyledText";
import { Resources, ResourceKey, AdvancedResourceKey } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage, TranslationKeys } from "../lib/i18n";

const PLUS_BTN = require("../assets/plus-button-image.png");

const CAP_COSTS: Record<ResourceKey, [ResourceKey, ResourceKey]> = {
  strawberry: ["pinecone", "blueberry"],
  pinecone: ["strawberry", "blueberry"],
  blueberry: ["strawberry", "pinecone"],
};

const ADVANCED_COSTS: Record<
  AdvancedResourceKey,
  { res1: ResourceKey; res2: ResourceKey; cost1: number; cost2: number }
> = {
  egg: { res1: "strawberry", res2: "pinecone", cost1: 20, cost2: 10 },
  wool: { res1: "pinecone", res2: "blueberry", cost1: 20, cost2: 10 },
  milk: { res1: "blueberry", res2: "strawberry", cost1: 20, cost2: 10 },
};

type Props = {
  resources: Resources;
  onUpgrade?: (resource: ResourceKey) => void;
  onUpgradeAdvanced?: (resource: AdvancedResourceKey) => void;
};

export default function ResourceBar({
  resources,
  onUpgrade,
  onUpgradeAdvanced,
}: Props) {
  const { t } = useLanguage();
  const [showCapMenu, setShowCapMenu] = useState(false);

  const basicEntries: { key: ResourceKey; amount: number; cap: number }[] = [
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

  const advancedEntries: {
    key: AdvancedResourceKey;
    amount: number;
    cap: number;
  }[] = [
    { key: "egg", amount: resources.egg ?? 0, cap: resources.egg_cap ?? 10 },
    {
      key: "wool",
      amount: resources.wool ?? 0,
      cap: resources.wool_cap ?? 10,
    },
    {
      key: "milk",
      amount: resources.milk ?? 0,
      cap: resources.milk_cap ?? 10,
    },
  ];

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Left: two rows of 3 */}
        <View style={styles.rows}>
          {[basicEntries, advancedEntries].map((rowEntries, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {rowEntries.map(({ key, amount, cap }) => {
                const meta = RESOURCE_META[key];
                return (
                  <View key={key} style={styles.item}>
                    {meta.image && (
                      <Image
                        source={meta.image}
                        style={styles.icon}
                        resizeMode="contain"
                      />
                    )}
                    <View style={[styles.amountBadge, amount >= cap && styles.amountBadgeFull]}>
                      <Text style={styles.amountText}>
                        {amount}
                        <Text style={styles.capText}>/{cap}</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Right: plus button */}
        <TouchableOpacity
          style={styles.plusWrap}
          onPress={() => setShowCapMenu(true)}
          activeOpacity={0.8}
        >
          <Image
            source={PLUS_BTN}
            style={styles.plusBtn}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Capacity overview modal */}
      <Modal
        visible={showCapMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCapMenu(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowCapMenu(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t("upgradeCapacityTitle")}</Text>

            {basicEntries.map(({ key, cap }) => {
              const meta = RESOURCE_META[key];
              const cost = Math.ceil((cap - 10) / 2 + 2);
              const [costRes1, costRes2] = CAP_COSTS[key];
              const meta1 = RESOURCE_META[costRes1];
              const meta2 = RESOURCE_META[costRes2];
              const level = Math.floor((cap - 10) / 2) + 1;
              const has1 = (resources[costRes1] ?? 0) >= cost;
              const has2 = (resources[costRes2] ?? 0) >= cost;
              const canAfford = has1 && has2;
              const isMax = cap >= 100;
              return (
                <View key={key} style={styles.menuRow}>
                  {/* Top line: icon + name ........... lv → lv+1 / cap → cap */}
                  <View style={styles.menuTopLine}>
                    <Image
                      source={meta.image!}
                      style={styles.menuIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.menuName}>
                      {t(key as TranslationKeys)}
                    </Text>
                    {isMax ? (
                      <Text style={styles.menuLevelArrowNext}>
                        {t("maxLabel")}
                      </Text>
                    ) : (
                      <View style={styles.menuLevelCapCol}>
                        <Text style={styles.menuLevelArrow}>
                          {`${t("lv")}${level}`}
                          <Text style={styles.menuLevelSep}>{" → "}</Text>
                          <Text style={styles.menuLevelArrowNext}>{`${t("lv")}${level + 1}`}</Text>
                        </Text>
                        <Text style={styles.menuCapCur}>
                          {`cap${cap}`}
                          <Text style={styles.menuLevelSep}>{" → "}</Text>
                          <Text style={styles.menuCapNext}>{`cap${cap + 2}`}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Bottom line: costs ........... upgrade button */}
                  <View style={styles.menuBottomLine}>
                    <View style={styles.menuCostRow}>
                      <Image
                        source={meta1.image!}
                        style={styles.menuCostIcon}
                        resizeMode="contain"
                      />
                      <Text
                        style={[
                          styles.menuCostText,
                          !has1 && styles.menuCostShort,
                        ]}
                      >
                        ×{cost}
                      </Text>
                      <Image
                        source={meta2.image!}
                        style={styles.menuCostIcon}
                        resizeMode="contain"
                      />
                      <Text
                        style={[
                          styles.menuCostText,
                          !has2 && styles.menuCostShort,
                        ]}
                      >
                        ×{cost}
                      </Text>
                    </View>
                    {!isMax && (
                      <TouchableOpacity
                        style={[
                          styles.menuUpgradeBtn,
                          !canAfford && styles.menuUpgradeBtnDisabled,
                        ]}
                        disabled={!canAfford}
                        onPress={() => {
                          setShowCapMenu(false);
                          onUpgrade?.(key);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.menuUpgradeBtnText}>
                          ▲ {t("upgrade")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {advancedEntries.map(({ key, cap }) => {
              const meta = RESOURCE_META[key];
              const { res1, res2, cost1, cost2 } = ADVANCED_COSTS[key];
              const meta1 = RESOURCE_META[res1];
              const meta2 = RESOURCE_META[res2];
              const level = Math.floor((cap - 10) / 2) + 1;
              const has1 = (resources[res1] ?? 0) >= cost1;
              const has2 = (resources[res2] ?? 0) >= cost2;
              const canAfford = has1 && has2;
              const isMax = cap >= 100;
              return (
                <View key={key} style={styles.menuRow}>
                  {/* Top line: icon + name ........... lv → lv+1 / cap → cap */}
                  <View style={styles.menuTopLine}>
                    <Image
                      source={meta.image!}
                      style={styles.menuIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.menuName}>
                      {t(key as TranslationKeys)}
                    </Text>
                    {isMax ? (
                      <Text style={styles.menuLevelArrowNext}>
                        {t("maxLabel")}
                      </Text>
                    ) : (
                      <View style={styles.menuLevelCapCol}>
                        <Text style={styles.menuLevelArrow}>
                          {`${t("lv")}${level}`}
                          <Text style={styles.menuLevelSep}>{" → "}</Text>
                          <Text style={styles.menuLevelArrowNext}>{`${t("lv")}${level + 1}`}</Text>
                        </Text>
                        <Text style={styles.menuCapCur}>
                          {`cap${cap}`}
                          <Text style={styles.menuLevelSep}>{" → "}</Text>
                          <Text style={styles.menuCapNext}>{`cap${cap + 2}`}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Bottom line: costs ........... upgrade button */}
                  <View style={styles.menuBottomLine}>
                    <View style={styles.menuCostRow}>
                      <Image
                        source={meta1.image!}
                        style={styles.menuCostIcon}
                        resizeMode="contain"
                      />
                      <Text
                        style={[
                          styles.menuCostText,
                          !has1 && styles.menuCostShort,
                        ]}
                      >
                        ×{cost1}
                      </Text>
                      <Image
                        source={meta2.image!}
                        style={styles.menuCostIcon}
                        resizeMode="contain"
                      />
                      <Text
                        style={[
                          styles.menuCostText,
                          !has2 && styles.menuCostShort,
                        ]}
                      >
                        ×{cost2}
                      </Text>
                    </View>
                    {!isMax && (
                      <TouchableOpacity
                        style={[
                          styles.menuUpgradeBtn,
                          !canAfford && styles.menuUpgradeBtnDisabled,
                        ]}
                        disabled={!canAfford}
                        onPress={() => {
                          setShowCapMenu(false);
                          onUpgradeAdvanced?.(key as AdvancedResourceKey);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.menuUpgradeBtnText}>
                          ▲ {t("upgrade")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  rows: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 30,
    height: 30,
    zIndex: 2,
  },
  amountBadge: {
    backgroundColor: "#d4aa6e",
    height: 20,
    width: "80%",
    borderRadius: 10,
    paddingLeft: 26,
    paddingRight: 8,
    marginLeft: -19,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  amountBadgeFull: {
    backgroundColor: "#6abf69",
  },
  amountText: {
    color: "#3a1e00",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
  },
  capText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#5a2e00",
    fontFamily: "Fredoka-Bold",
  },
  plusWrap: {
    marginLeft: 4,
  },
  plusBtn: {
    width: 34,
    height: 34,
  },

  // Capacity menu modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuCard: {
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    paddingHorizontal: 12,
    paddingVertical: 16,
    width: 320,
    gap: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "900",
    fontFamily: "Fredoka-Bold",
    color: "#4a2e0a",
    textAlign: "center",
    marginBottom: 4,
  },
  menuRow: {
    backgroundColor: "#edddb8",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  menuTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  menuBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuIcon: {
    width: 22,
    height: 22,
  },
  menuName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Fredoka-Bold",
    color: "#4a2e0a",
  },
  menuLevelCapCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 1,
  },
  menuLevelArrow: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#4a7c3f",
  },
  menuLevelSep: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Fredoka-Bold",
    color: "#9a7040",
  },
  menuLevelArrowNext: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#5b6bbf",
  },
  menuCapCur: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Fredoka-Bold",
    color: "#7a5030",
  },
  menuCapNext: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#4a7c3f",
  },
  menuCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  menuCostIcon: {
    width: 18,
    height: 18,
  },
  menuCostText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Fredoka-Bold",
    color: "#4a2e0a",
    marginRight: 4,
  },
  menuCostShort: {
    color: "#c0392b",
  },
  menuUpgradeBtn: {
    backgroundColor: "#4a7c3f",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "#2d5a24",
  },
  menuUpgradeBtnDisabled: {
    opacity: 0.35,
  },
  menuUpgradeBtnText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#fff",
  },
});
