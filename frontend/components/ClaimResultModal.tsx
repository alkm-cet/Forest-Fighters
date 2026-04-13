import { Modal, View, Image, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "./StyledText";
import { RESOURCE_META } from "../constants/resources";
import type { ClaimResult } from "../types";

type Props = {
  result: ClaimResult | null;
  onClose: () => void;
};

export default function ClaimResultModal({ result, onClose }: Props) {
  if (!result) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.header, result.winner === "champion" ? styles.headerWin : styles.headerLose]}>
            <Text style={styles.title}>
              {result.winner === "champion" ? "⚔️ Zafer!" : "💀 Yenilgi"}
            </Text>
            <View style={styles.rewardRow}>
              {result.rewardAmount > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {result.rewardResource && RESOURCE_META[result.rewardResource]?.image ? (
                    <Image
                      source={RESOURCE_META[result.rewardResource].image}
                      style={{ width: 24, height: 24 }}
                      resizeMode="contain"
                    />
                  ) : null}
                  <Text style={styles.reward}>+{result.rewardAmount}</Text>
                </View>
              ) : (
                <Text style={styles.noReward}>Ödül yok</Text>
              )}
              {result.xpGained > 0 && (
                <Text style={styles.xp}>+{result.xpGained} XP</Text>
              )}
            </View>
            {result.levelsGained > 0 && (
              <View style={styles.levelUpBadge}>
                <Text style={styles.levelUpText}>
                  ⬆️ SEVİYE ATLADI! LV {result.newLevel}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.logTitle}>Savaş Günlüğü</Text>
          <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
            {(result.log ?? []).map((entry: any, i: number) => {
              const isChamp = entry.actor === "attacker";
              const atkHp = isChamp ? entry.attackerHpAfter : entry.defenderHpAfter;
              const defHp = isChamp ? entry.defenderHpAfter : entry.attackerHpAfter;
              const blocked = entry.damage === 0;
              const newRound = i === 0 || result.log[i - 1]?.round !== entry.round;

              return (
                <View key={i} style={styles.logRow}>
                  {newRound && (
                    <View style={styles.roundBadge}>
                      <Text style={styles.roundBadgeText}>Tur {entry.round + 1}</Text>
                    </View>
                  )}
                  <View style={[styles.logLine, isChamp ? styles.logLineChamp : styles.logLineEnemy]}>
                    <View style={styles.logSide}>
                      <Text style={[styles.logSideName, isChamp ? styles.logActorChamp : styles.logActorEnemy]}>
                        {isChamp ? "⚔️" : "👹"} {isChamp ? "Şampiyon" : "Düşman"}
                      </Text>
                      <Text style={styles.logSideHp}>{atkHp} HP</Text>
                      <View style={styles.logSideStatRow}>
                        <Text style={styles.logAtkVal}>ATK {entry.attackValue}</Text>
                        {entry.atkBoosted && <Text style={styles.logCritBadge}>KRİT</Text>}
                      </View>
                    </View>
                    <View style={styles.logCenter}>
                      <Text style={styles.logArrow}>→</Text>
                      <View style={[styles.logDmgPill, blocked ? styles.logDmgPillBlock : styles.logDmgPillHit]}>
                        <Text style={[styles.logDmgText, blocked ? styles.logDmgTextBlock : styles.logDmgTextHit]}>
                          {blocked ? "BLOK" : `−${entry.damage}`}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.logSide, styles.logSideRight]}>
                      <Text style={[styles.logSideName, isChamp ? styles.logActorEnemy : styles.logActorChamp]}>
                        {isChamp ? "👹" : "⚔️"} {isChamp ? "Düşman" : "Şampiyon"}
                      </Text>
                      <Text style={[styles.logSideHp, !blocked && styles.logSideHpDamaged]}>{defHp} HP</Text>
                      <View style={[styles.logSideStatRow, styles.logSideStatRight]}>
                        {entry.defBoosted && <Text style={styles.logBlockBadge}>BLOK</Text>}
                        <Text style={styles.logDefVal}>DEF {entry.defenseValue}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  card: { backgroundColor: "#f5edd8", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2, borderBottomWidth: 0, borderColor: "#d4b896", maxHeight: "80%", paddingBottom: 32 },
  header: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 24, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginBottom: 4 },
  headerWin: { backgroundColor: "#c8e6c9" },
  headerLose: { backgroundColor: "#ffcdd2" },
  title: { fontSize: 26, fontWeight: "800", color: "#3a2a10", marginBottom: 4 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  reward: { fontSize: 18, fontWeight: "800", color: "#4a7c3f" },
  noReward: { fontSize: 14, color: "#c0392b" },
  xp: { fontSize: 16, fontWeight: "800", color: "#b8860b" },
  levelUpBadge: { marginTop: 8, backgroundColor: "#3a1e00", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  levelUpText: { fontSize: 14, fontWeight: "800", color: "#f5c842", letterSpacing: 0.5 },
  logTitle: { fontSize: 12, fontWeight: "700", color: "#9a7040", letterSpacing: 1.2, paddingHorizontal: 20, paddingVertical: 8 },
  logScroll: { maxHeight: 340, paddingHorizontal: 16 },
  logRow: { marginBottom: 6 },
  roundBadge: { alignSelf: "center", backgroundColor: "#ede0c4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 3, marginBottom: 5, marginTop: 8 },
  roundBadgeText: { fontSize: 11, fontWeight: "700", color: "#9a7040", letterSpacing: 0.8 },
  logLine: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1.5 },
  logLineChamp: { backgroundColor: "#f0faf0", borderColor: "#b2d8b2" },
  logLineEnemy: { backgroundColor: "#fdf0f0", borderColor: "#e0b8b8" },
  logSide: { flex: 1, gap: 2 },
  logSideRight: { alignItems: "flex-end" },
  logSideName: { fontSize: 12, fontWeight: "800" },
  logActorChamp: { color: "#2d6e24" },
  logActorEnemy: { color: "#a02020" },
  logSideHp: { fontSize: 12, fontWeight: "700", color: "#555" },
  logSideHpDamaged: { color: "#c0392b" },
  logSideStatRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  logSideStatRight: { justifyContent: "flex-end" },
  logAtkVal: { fontSize: 11, fontWeight: "600", color: "#888" },
  logDefVal: { fontSize: 11, fontWeight: "600", color: "#888" },
  logCritBadge: { fontSize: 9, fontWeight: "800", color: "#fff", backgroundColor: "#e67e22", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  logBlockBadge: { fontSize: 9, fontWeight: "800", color: "#fff", backgroundColor: "#2980b9", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  logCenter: { alignItems: "center", paddingHorizontal: 8, gap: 4 },
  logArrow: { fontSize: 16, color: "#aaa" },
  logDmgPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  logDmgPillHit: { backgroundColor: "#c0392b" },
  logDmgPillBlock: { backgroundColor: "#bbb" },
  logDmgText: { fontSize: 12, fontWeight: "800" },
  logDmgTextHit: { color: "#fff" },
  logDmgTextBlock: { color: "#fff" },
  btn: { backgroundColor: "#4a7c3f", borderRadius: 12, marginHorizontal: 20, marginTop: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
