import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { deleteToken } from '../../lib/auth';

type Resources = { strawberry: number; pinecone: number; blueberry: number };
type Champion = { id: string; name: string; class: string; level: number; attack: number; defense: number; chance: number };

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#c0392b',
  Mage: '#8e44ad',
  Archer: '#27ae60',
};

const CLASS_EMOJI: Record<string, string> = {
  Warrior: '⚔️',
  Mage: '🔮',
  Archer: '🏹',
};

const PLACEHOLDER_CHAMPIONS: Champion[] = [
  { id: '1', name: 'Oak Warrior', class: 'Warrior', level: 1, attack: 10, defense: 10, chance: 10 },
  { id: '2', name: 'Forest Mage', class: 'Mage', level: 1, attack: 10, defense: 10, chance: 10 },
  { id: '3', name: 'Pine Archer', class: 'Archer', level: 1, attack: 10, defense: 10, chance: 10 },
];

export default function MainScreen() {
  const router = useRouter();
  const [resources, setResources] = useState<Resources>({ strawberry: 0, pinecone: 0, blueberry: 0 });
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<{ username: string } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/auth/me').then(r => setPlayer(r.data)).catch(() => {}),
      api.get('/api/resources').then(r => setResources(r.data)).catch(() => {}),
      api.get('/api/champions').then(r => setChampions(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await deleteToken();
    router.replace('/(auth)/login');
  }

  const displayChampions = champions.length > 0 ? champions : PLACEHOLDER_CHAMPIONS;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.playerName}>{player ? `🌿 ${player.username}` : '🌿 Forest Fighters'}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Resource Bar */}
      <View style={styles.resourceBar}>
        <ResourcePill icon="🍓" label="Strawberry" value={resources.strawberry} />
        <ResourcePill icon="🌲" label="Pinecone" value={resources.pinecone} />
        <ResourcePill icon="🫐" label="Blueberry" value={resources.blueberry} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Battlefield */}
        <View style={styles.battlefieldCard}>
          <Text style={styles.sectionTitle}>⚔️  Battlefield</Text>
          <View style={styles.battlefield}>
            <View style={styles.battlefieldLane}>
              <Text style={styles.treeEmoji}>🌲</Text>
              <Text style={styles.treeEmoji}>🌳</Text>
              <Text style={styles.treeEmoji}>🌲</Text>
            </View>
            <View style={styles.vsRow}>
              <View style={[styles.fighter, { backgroundColor: '#e74c3c22' }]}>
                <Text style={styles.fighterEmoji}>🧙</Text>
                <Text style={styles.fighterLabel}>Your Team</Text>
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={[styles.fighter, { backgroundColor: '#2c3e5022' }]}>
                <Text style={styles.fighterEmoji}>👹</Text>
                <Text style={styles.fighterLabel}>Enemies</Text>
              </View>
            </View>
            <Text style={styles.battlefieldHint}>Send champions on missions to battle!</Text>
          </View>
        </View>

        {/* Champions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆  Your Champions</Text>
          {loading ? (
            <ActivityIndicator color="#2d6a2d" style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.championsGrid}>
              {displayChampions.map((c) => (
                <ChampionCard key={c.id} champion={c} />
              ))}
            </View>
          )}
        </View>

        {/* Farmers placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌾  Farmers</Text>
          <View style={styles.farmersRow}>
            <FarmerPill type="strawberry" icon="🍓" />
            <FarmerPill type="pinecone" icon="🌲" />
            <FarmerPill type="blueberry" icon="🫐" />
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗺️  Dungeons</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Dungeons coming soon...</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResourcePill({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={styles.resourcePill}>
      <Text style={styles.resourceIcon}>{icon}</Text>
      <Text style={styles.resourceValue}>{value}</Text>
    </View>
  );
}

function ChampionCard({ champion }: { champion: Champion }) {
  const color = CLASS_COLORS[champion.class] ?? '#888';
  const emoji = CLASS_EMOJI[champion.class] ?? '⚔️';
  return (
    <View style={[styles.championCard, { borderColor: color }]}>
      <View style={[styles.championAvatar, { backgroundColor: color + '22' }]}>
        <Text style={styles.championEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.championName}>{champion.name}</Text>
      <View style={[styles.classTag, { backgroundColor: color }]}>
        <Text style={styles.classTagText}>{champion.class}</Text>
      </View>
      <Text style={styles.championLevel}>Level {champion.level}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>⚔️ {champion.attack}</Text>
        <Text style={styles.stat}>🛡 {champion.defense}</Text>
        <Text style={styles.stat}>✨ {champion.chance}</Text>
      </View>
    </View>
  );
}

function FarmerPill({ type, icon }: { type: string; icon: string }) {
  return (
    <View style={styles.farmerPill}>
      <Text style={styles.farmerIcon}>{icon}</Text>
      <Text style={styles.farmerLabel}>{type}</Text>
      <Text style={styles.farmerSub}>Idle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a3d1a' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1a3d1a',
  },
  playerName: { color: '#a8e6a3', fontSize: 16, fontWeight: '700' },
  logoutBtn: { backgroundColor: '#ffffff22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: '#fff', fontSize: 13 },

  resourceBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#2d6a2d', paddingVertical: 10, paddingHorizontal: 8,
  },
  resourcePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  resourceIcon: { fontSize: 18 },
  resourceValue: { color: '#fff', fontWeight: '700', fontSize: 15 },

  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  battlefieldCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  battlefield: { marginTop: 12, backgroundColor: '#e8f5e8', borderRadius: 12, padding: 16, alignItems: 'center', gap: 12 },
  battlefieldLane: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  treeEmoji: { fontSize: 28 },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fighter: { alignItems: 'center', padding: 12, borderRadius: 12, minWidth: 80 },
  fighterEmoji: { fontSize: 32 },
  fighterLabel: { fontSize: 11, color: '#555', marginTop: 4 },
  vsText: { fontSize: 22, fontWeight: '900', color: '#2d6a2d' },
  battlefieldHint: { fontSize: 12, color: '#888', fontStyle: 'italic' },

  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a3d1a', marginBottom: 4 },

  championsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' },
  championCard: { backgroundColor: '#fafafa', borderRadius: 14, padding: 12, alignItems: 'center', width: 100, borderWidth: 2 },
  championAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  championEmoji: { fontSize: 26 },
  championName: { fontSize: 11, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 4 },
  classTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  classTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  championLevel: { fontSize: 11, color: '#888' },
  statsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  stat: { fontSize: 10, color: '#555' },

  farmersRow: { flexDirection: 'row', gap: 10, marginTop: 8, justifyContent: 'center' },
  farmerPill: { flex: 1, backgroundColor: '#f0f8f0', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c8' },
  farmerIcon: { fontSize: 24, marginBottom: 4 },
  farmerLabel: { fontSize: 12, fontWeight: '600', color: '#2d6a2d', textTransform: 'capitalize' },
  farmerSub: { fontSize: 11, color: '#888', marginTop: 2 },

  comingSoon: { marginTop: 8, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 20, alignItems: 'center' },
  comingSoonText: { color: '#aaa', fontStyle: 'italic' },
});
