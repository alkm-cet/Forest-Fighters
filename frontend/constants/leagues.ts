export type LeagueName =
  | 'Bronz'
  | 'Gumus'
  | 'Altin'
  | 'Platinium'
  | 'Elmas'
  | 'Master'
  | 'Grandmaster'
  | 'Challenger';

export const LEAGUE_META: Record<LeagueName, { image: any; color: string; minTrophies: number; label: string }> = {
  Bronz:       { image: require('../assets/leagues/league-bronz.png'),       color: '#cd7f32', minTrophies: 0,    label: 'Bronze'      },
  Gumus:       { image: require('../assets/leagues/league-silver.png'),      color: '#aaaaaa', minTrophies: 150,  label: 'Silver'      },
  Altin:       { image: require('../assets/leagues/league-gold.png'),        color: '#ffd700', minTrophies: 300,  label: 'Gold'        },
  Platinium:   { image: require('../assets/leagues/league-platinium.png'),   color: '#a0c4ff', minTrophies: 500,  label: 'Platinum'    },
  Elmas:       { image: require('../assets/leagues/league-diamond.png'),     color: '#b9f2ff', minTrophies: 750,  label: 'Diamond'     },
  Master:      { image: require('../assets/leagues/league-master.png'),      color: '#c084fc', minTrophies: 1000, label: 'Master'      },
  Grandmaster: { image: require('../assets/leagues/league-grandmaster.png'), color: '#f97316', minTrophies: 1300, label: 'Grandmaster' },
  Challenger:  { image: require('../assets/leagues/league-challenger.png'),  color: '#ef4444', minTrophies: 1600, label: 'Challenger'  },
};

export function getLeagueMeta(trophies: number) {
  const tiers: LeagueName[] = ['Challenger', 'Grandmaster', 'Master', 'Elmas', 'Platinium', 'Altin', 'Gumus', 'Bronz'];
  for (const name of tiers) {
    if (trophies >= LEAGUE_META[name].minTrophies) return LEAGUE_META[name];
  }
  return LEAGUE_META['Bronz'];
}
