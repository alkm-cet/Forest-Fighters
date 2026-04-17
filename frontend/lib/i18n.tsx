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
    animals: "Animals",
    championsUpper: "CHAMPIONS",
    farmersUpper: "FARMERS",
    animalsUpper: "ANIMALS",

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
    egg: "Egg",
    wool: "Wool",
    milk: "Milk",

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
    claimReward: "SEE RESULT",
    onMission: "ON MISSION",
    victory: "Victory!",
    defeat: "Defeat",
    missionComplete: "Mission Complete",
    missionDone: "Returned from Mission",
    timeRemaining: "Time remaining",
    reward: "Reward",
    enemy: "Enemy",
    noDungeons: "No dungeons available",
    championDeployed: "Champion is already deployed",
    readyToClaim: "READY!",

    // Resource capacity
    upgradeCapacityTitle: "Upgrade Capacity?",
    upgradeCapacityInfo: "Max storage +2",
    farmerStorageFull: "Storage Full",

    // Combat boosts
    boostHp: "+10 HP",
    boostDefense: "+5 Defense",
    boostChance: "+5 Chance",
    boostConfirmTitle: "Apply Boost?",
    boostActiveUntil: "Active until next battle",
    boostAlreadyActive: "Already active",
    boostSection: "BATTLE BOOSTS",
    historyBack: "BACK",
    history: "HISTORY",
    defenderBanner: "DEFENDER",
    pvpLevelRequired: "PvP Lv3 Required",

    // Coins
    coins: "Coins",
    skipCooldown: "Skip",
    skipBattleNow: "Finish Battle!",
    skipMissionNow: "Finish Mission!",
    notEnoughCoins: "Not enough coins",
    coinRevive: "Revive",
    alreadyReady: "Already ready!",
    fillStorage: "Fill Storage",
    fillStorageDesc: "Fill farmer storage to max capacity?",
    storageFull: "Storage Full",

    // Leaderboard
    leaderboard: "Leaderboard",
    highestChampLv: "Highest Champion: Lv",

    // Animal drawer / Feed system
    feedStorage: "FEED STORAGE",
    available: "available",
    fuelRemaining: "Fuel Remaining",
    pausedAddFeed: "Paused — add feed",
    emptyAddFeed: "Empty — add feed",
    maxLabel: "MAX",
    maxLevel: "MAX LV",
    lv: "Lv",
    feedAnimal: "Feed",
    thisWillUse: "This will use",
    toFillFeedStorage: "to fill the feed storage.",
    notEnoughOf: "Not enough",
    haveLabel: "have",
    needLabel: "need",

    // PvP
    pvpArena: "PvP Arena",
    trophies: "Trophies",
    setDefender: "Set as Defender",
    defenderActive: "Defender ✓",
    defenderCooldown: "Can't Defend",
    attackBtn: "ATTACK!",
    pendingBattle: "Battle in progress...",
    viewResult: "View Result",
    resultReady: "Battle Result Ready!",
    underAttack: "Under Attack!",
    pvpVictory: "Victory!",
    pvpDefeat: "Defeat",
    trophyGain: "Trophies",
    resourceStolen: "Resources Lost",
    resourceGained: "Resources Gained",
    revenge: "Revenge",
    battleHistory: "Battle History",
    noHistory: "No battles yet",
    attackerRole: "Attacker",
    defenderRole: "Defender",
    selectDefender: "SELECT DEFENDER",
    noDefenderSet: "No defender set",
    pvpLevel3Required: "Level 3 required",
    vsOpponent: "vs",

    // Dungeon tabs
    harvestTab: "Harvest",
    adventureTab: "Adventure",
    eventsTab: "Events",
    dungeonCooldown: "Cooldown",
    dungeonReady: "READY!",
    dailyLimitReached: "Daily limit reached",
    noActiveEvents: "No active events right now. Check back later!",
    eventEndsIn: "Event ends in",
    stageCleared: "Stage Cleared!",
    bossStage: "BOSS",
    lockedStage: "Locked",
    totalStars: "Total Stars",
    milestoneReward: "Milestone Reward",
    claimMilestone: "Claim",
    nextMilestone: "Next Milestone",
    rewardResource2: "Bonus",
    coinRewardLabel: "Coins",
    starsEarnedLabel: "Stars Earned",
    noRewardThisTime: "No reward this time",
    roundLabel: "Round",
    championLabel: "Champion",
    enemyLabel: "Enemy",
    levelUpLabel: "LEVEL UP!",

    // Champion drawer — locked states
    pvpLockedWaiting: "Another warrior is waiting",
    foodLockedOnMission: "On Mission",
    foodLockedInBattle: "In Battle",
    addFood: "Add Food",

    // Gear system
    gearEquipment: "Equipment",
    gearEquipmentDrawerTitle: "Equipment",
    gearEquippedSection: "Equipped",
    gearWeaponSlot: "⚔️ Weapon",
    gearCharmSlot: "🍀 Charm",
    gearNoWeapon: "No weapon equipped",
    gearNoCharm: "No charm equipped",
    gearInventorySection: "Inventory",
    gearEquipBtn: "Equip",
    gearUnequipBtn: "Unequip",
    gearUpgradeBtn: "Upgrade",
    gearNoStonesBtn: "No stones",
    gearConfirmUpgrade: "Confirm",
    gearUpgradeStonesWillUse: "stones will be used",
    gearEmptyTitle: "No gear yet",
    gearEmptyHint: "Win adventure dungeons to find equipment!",
    gearForgeStones: "Forge Stones",
    gearErrorEquip: "Could not equip gear",
    gearErrorUnequip: "Could not unequip gear",
    gearErrorUpgrade: "Upgrade failed",
    gearErrorTitle: "Error",

    // Instant cook
    instantCookBtn: "Cook Now",
    instantCookTitle: "Cook Now",
    instantCookDesc: "Should this food be finished instantly?",

    // Forge stone descriptions
    forgeStoneT1Desc: "Upgrades Tier 1 gear by 1 level",
    forgeStoneT2Desc: "Upgrades Tier 2 gear by 1 level",
    forgeStoneAnyDesc: "Upgrades any tier gear by 1 level",
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
    animals: "Hayvanlar",
    championsUpper: "SAVAŞÇILAR",
    farmersUpper: "ÇİFTÇİLER",
    animalsUpper: "HAYVANLAR",

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
    egg: "Yumurta",
    wool: "Yün",
    milk: "Süt",

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
    claimReward: "SONUCU GÖR",
    onMission: "GÖREVDE",
    victory: "Zafer!",
    defeat: "Yenilgi",
    missionComplete: "Görev Tamamlandı",
    missionDone: "Görevden Dönüldü",
    timeRemaining: "Kalan süre",
    reward: "Ödül",
    enemy: "Düşman",
    noDungeons: "Zindan bulunamadı",
    championDeployed: "Savaşçı zaten görevde",
    readyToClaim: "HAZIR!",

    // Resource capacity
    upgradeCapacityTitle: "Kapasiteyi Artır?",
    upgradeCapacityInfo: "Maks depolama +2",
    farmerStorageFull: "Depo Dolu",

    // Combat boosts
    boostHp: "+10 Can",
    boostDefense: "+5 Savunma",
    boostChance: "+5 Şans",
    boostConfirmTitle: "Boost Uygula?",
    boostActiveUntil: "Bir sonraki savaşa kadar aktif",
    boostAlreadyActive: "Zaten aktif",
    boostSection: "SAVAŞ BOOSTLARI",
    historyBack: "GERİ DÖN",
    history: "GEÇMİŞ",
    defenderBanner: "SAVUNUCU",
    pvpLevelRequired: "PvP Lv3 Gerekli",

    // Coins
    coins: "Altın",
    skipCooldown: "Atla",
    skipBattleNow: "Savaşı Hemen Bitir!",
    skipMissionNow: "Görevi Hemen Bitir!",
    notEnoughCoins: "Yeterli altın yok",
    coinRevive: "Canlandır",
    alreadyReady: "Zaten hazır!",
    fillStorage: "Depoyu Doldur",
    fillStorageDesc: "Çiftçi deposunu max kapasiteye doldur?",
    storageFull: "Depo Dolu",

    // Leaderboard
    leaderboard: "Liderlik Tablosu",
    highestChampLv: "En Yüksek Savaşçı: Sv",

    // Animal drawer / Feed system
    feedStorage: "YEM DEPOSU",
    available: "mevcut",
    fuelRemaining: "Kalan Yakıt",
    pausedAddFeed: "Duraklatıldı — yem ekle",
    emptyAddFeed: "Boş — yem ekle",
    maxLabel: "MAX",
    maxLevel: "MAX SV",
    lv: "Sv",
    feedAnimal: "Besle",
    thisWillUse: "Kullanılacak:",
    toFillFeedStorage: "yem deposunu doldurmak için.",
    notEnoughOf: "Yeterli yok:",
    haveLabel: "var",
    needLabel: "gerekli",

    // PvP
    pvpArena: "PvP Arenası",
    trophies: "Kupa",
    setDefender: "Savunucu Yap",
    defenderActive: "Savunucu ✓",
    defenderCooldown: "Savunucu Olamaz",
    attackBtn: "SALDIR!",
    pendingBattle: "Savaş devam ediyor...",
    viewResult: "Sonucu Gör",
    resultReady: "Savaş Sonucu Hazır!",
    underAttack: "Saldırı Altındasın!",
    pvpVictory: "Zafer!",
    pvpDefeat: "Yenilgi",
    trophyGain: "Kupa",
    resourceStolen: "Kaynak Kaybı",
    resourceGained: "Kazanılan Kaynak",
    revenge: "İntikam",
    battleHistory: "Savaş Geçmişi",
    noHistory: "Henüz savaş yok",
    attackerRole: "Saldıran",
    defenderRole: "Savunan",
    selectDefender: "SAVUNUCU SEÇ",
    noDefenderSet: "Savunucu seçilmedi",
    pvpLevel3Required: "Seviye 3 gerekli",
    vsOpponent: "vs",

    // Dungeon tabs
    harvestTab: "Hasat",
    adventureTab: "Macera",
    eventsTab: "Etkinlik",
    dungeonCooldown: "Bekleme",
    dungeonReady: "HAZIR!",
    dailyLimitReached: "Günlük limit doldu",
    noActiveEvents: "Şu an aktif etkinlik yok. Sonra tekrar kontrol et!",
    eventEndsIn: "Etkinlik bitiyor",
    stageCleared: "Bölüm Temizlendi!",
    bossStage: "BOSS",
    lockedStage: "Kilitli",
    totalStars: "Toplam Yıldız",
    milestoneReward: "Kilometre Taşı Ödülü",
    claimMilestone: "Al",
    nextMilestone: "Sonraki Hedef",
    rewardResource2: "Bonus",
    coinRewardLabel: "Koin",
    starsEarnedLabel: "Kazanılan Yıldız",
    noRewardThisTime: "Bu sefer ödül yok",
    roundLabel: "Tur",
    championLabel: "Şampiyon",
    enemyLabel: "Düşman",
    levelUpLabel: "SEVİYE ATLADI!",

    // Champion drawer — locked states
    pvpLockedWaiting: "Diğer savaşçı bekleniyor",
    foodLockedOnMission: "Görevde",
    foodLockedInBattle: "Savaşta",
    addFood: "Yemek Ekle",

    // Gear system
    gearEquipment: "Ekipman",
    gearEquipmentDrawerTitle: "Ekipman",
    gearEquippedSection: "Kuşanılan Eşyalar",
    gearWeaponSlot: "⚔️ Silah",
    gearCharmSlot: "🍀 Tılsım",
    gearNoWeapon: "Silah takılı değil",
    gearNoCharm: "Tılsım takılı değil",
    gearInventorySection: "Envanter",
    gearEquipBtn: "Kuşan",
    gearUnequipBtn: "Çıkar",
    gearUpgradeBtn: "Güçlendir",
    gearNoStonesBtn: "Taş yok",
    gearConfirmUpgrade: "Onayla",
    gearUpgradeStonesWillUse: "adet taş kullanılacak",
    gearEmptyTitle: "Henüz eşya yok",
    gearEmptyHint: "Macera dungeonlarını kazan, eşyalar düşebilir!",
    gearForgeStones: "Forge Taşları",
    gearErrorEquip: "Eşya takılamadı",
    gearErrorUnequip: "Eşya çıkarılamadı",
    gearErrorUpgrade: "Güçlendirme başarısız",
    gearErrorTitle: "Hata",

    // Instant cook
    instantCookBtn: "Hemen Pişir",
    instantCookTitle: "Hemen Pişir",
    instantCookDesc: "Yemek anında hazır olsun mu?",

    // Forge stone descriptions
    forgeStoneT1Desc: "Tier 1 eşyaları 1 seviye yükseltir",
    forgeStoneT2Desc: "Tier 2 eşyaları 1 seviye yükseltir",
    forgeStoneAnyDesc: "Tüm tier eşyaları 1 seviye yükseltir",
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
