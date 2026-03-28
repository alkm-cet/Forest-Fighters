import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANG_KEY = "@language";

export type Language = "en" | "tr";

const translations = {
  en: {
    // App name
    appName: "Forest Fighters",

    // Auth
    email: "Email",
    password: "Password",
    username: "Username",
    login: "Login",
    register: "Register",
    createAccount: "Create Account",
    noAccount: "Don't have an account? Register",
    haveAccount: "Already have an account? Login",
    loginFailed: "Login failed",
    registerFailed: "Registration failed",

    // Main screen
    cannotReachServer: "Cannot reach server",
    champions: "Champions",
    farmers: "Farmers",
    championsUpper: "CHAMPIONS",
    farmersUpper: "FARMERS",

    // Settings
    settings: "Settings",
    music: "Music",
    backgroundMusic: "Background music",
    logout: "Logout",
    language: "Language",

    // Champion drawer
    level: "Level",
    baseStatistics: "BASE STATISTICS",
    attack: "Attack",
    defense: "Defense",
    chance: "Chance",

    // Farmer drawer
    productionStats: "PRODUCTION STATS",
    production: "Production",
    collect: "Collect",
    pendingReady: "ready",
    nothingToCollect: "Nothing ready yet",
    upgradeCost: "Upgrade Cost",
    perMin: "/ min",
    nextIn: "Next in",

    // Champion card stat labels
    atk: "ATK",
    def: "DEF",
    chc: "CHC",

    // Farmer card stat labels
    lvl: "LVL",
    prod: "PROD",
    type: "TYPE",

    // Resource names
    strawberry: "Strawberry",
    pinecone: "Pinecone",
    blueberry: "Blueberry",

    // Buttons
    enter: "ENTER",
    dungeon: "DUNGEON",
    pvp: "PvP",
    battle: "BATTLE",
    upgrade: "UPGRADE",
    farmer: "FARMER",

    // Champion actions
    revive: "Revive",
    heal: "Heal",
    notEnoughStrawberries: "Not enough strawberries",
    statPoints: "Stat Points",
    confirmUpgradeTitle: "Confirm Upgrade?",
    confirmUpgradeBtn: "Confirm",
    cancelBtn: "Cancel",
    upgradeStatAttack: "Upgrade Attack stat",
    upgradeStatDefense: "Upgrade Defense stat",
    upgradeStatChance: "Upgrade Chance stat",

    // Dungeon screen
    dungeons: "Dungeons",
    enterDungeon: "ENTER DUNGEON",
    claimReward: "CLAIM REWARD",
    onMission: "ON MISSION",
    victory: "Victory!",
    defeat: "Defeat",
    missionComplete: "Mission Complete",
    missionDone: "Mission Done!",
    timeRemaining: "Time remaining",
    reward: "Reward",
    enemy: "Enemy",
    noDungeons: "No dungeons available",
    championDeployed: "Champion is already deployed",
    readyToClaim: "READY!",

    // Resource capacity
    upgradeCapacityTitle: "Upgrade Capacity?",
    upgradeCapacityInfo: "Max storage +3",
  },
  tr: {
    // App name
    appName: "Orman Savaşçıları",

    // Auth
    email: "E-posta",
    password: "Şifre",
    username: "Kullanıcı Adı",
    login: "Giriş Yap",
    register: "Kayıt Ol",
    createAccount: "Hesap Oluştur",
    noAccount: "Hesabın yok mu? Kayıt ol",
    haveAccount: "Zaten hesabın var mı? Giriş yap",
    loginFailed: "Giriş başarısız",
    registerFailed: "Kayıt başarısız",

    // Main screen
    cannotReachServer: "Sunucuya ulaşılamıyor",
    champions: "Savaşçılar",
    farmers: "Çiftçiler",
    championsUpper: "SAVAŞÇILAR",
    farmersUpper: "ÇİFTÇİLER",

    // Settings
    settings: "Ayarlar",
    music: "Müzik",
    backgroundMusic: "Arka plan müziği",
    logout: "Çıkış Yap",
    language: "Dil",

    // Champion drawer
    level: "Seviye",
    baseStatistics: "TEMEL İSTATİSTİKLER",
    attack: "Saldırı",
    defense: "Savunma",
    chance: "Şans",

    // Farmer drawer
    productionStats: "ÜRETİM İSTATİSTİKLERİ",
    production: "Üretim",
    collect: "Topla",
    pendingReady: "hazır",
    nothingToCollect: "Henüz hazır değil",
    upgradeCost: "Geliştirme Maliyeti",
    perMin: "/ dak",
    nextIn: "Sonraki",

    // Champion card stat labels
    atk: "SAL",
    def: "SAV",
    chc: "ŞNS",

    // Farmer card stat labels
    lvl: "SVY",
    prod: "ÜRT",
    type: "TİP",

    // Resource names
    strawberry: "Çilek",
    pinecone: "Çam Kozalağı",
    blueberry: "Yaban Mersini",

    // Buttons
    enter: "GİR",
    dungeon: "ZINDAN",
    pvp: "PvP",
    battle: "SAVAŞ",
    upgrade: "GELİŞTİR",
    farmer: "ÇİFTÇİ",

    // Champion actions
    revive: "Canlandır",
    heal: "İyileştir",
    notEnoughStrawberries: "Yeterli çilek yok",
    statPoints: "İstatistik Puanı",
    confirmUpgradeTitle: "Güçlendirmeyi Onaylıyor musun?",
    confirmUpgradeBtn: "Onayla",
    cancelBtn: "Reddet",
    upgradeStatAttack: "Saldırı istatistiğini güçlendir",
    upgradeStatDefense: "Savunma istatistiğini güçlendir",
    upgradeStatChance: "Şans istatistiğini güçlendir",

    // Dungeon screen
    dungeons: "Zindanlar",
    enterDungeon: "ZINDANA GİR",
    claimReward: "ÖDÜL AL",
    onMission: "GÖREVDE",
    victory: "Zafer!",
    defeat: "Yenilgi",
    missionComplete: "Görev Tamamlandı",
    missionDone: "Görev Bitti!",
    timeRemaining: "Kalan süre",
    reward: "Ödül",
    enemy: "Düşman",
    noDungeons: "Zindan bulunamadı",
    championDeployed: "Savaşçı zaten görevde",
    readyToClaim: "HAZIR!",

    // Resource capacity
    upgradeCapacityTitle: "Kapasiteyi Artır?",
    upgradeCapacityInfo: "Maks depolama +3",
  },
} as const;

export type TranslationKeys = keyof typeof translations.en;

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === "en" || saved === "tr") setLanguageState(saved);
    });
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang);
  }

  function t(key: TranslationKeys): string {
    return translations[language][key];
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
