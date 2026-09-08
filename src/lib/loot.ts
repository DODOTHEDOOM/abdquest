// Loot / item tables + RNG drop logic, extracted verbatim from legacy/AbdQuest.html.

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Item {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  desc: string;
  use: string;
  useVal: number;
  useDesc: string;
}

export const RC: Record<Rarity, string> = {
  common: "#888",
  rare: "#4488ff",
  epic: "#aa44ff",
  legendary: "#ffd700",
};

export const ITEMS: Item[] = [
  // Common — frequent drops, small effects
  {
    id: "i1",
    name: "Rusty Sword",
    icon: "🗡️",
    rarity: "common",
    desc: "A battered blade. Feels heavier than it looks.",
    use: "xp",
    useVal: 25,
    useDesc: "+25 XP",
  },
  {
    id: "i2",
    name: "Iron Shield",
    icon: "🛡️",
    rarity: "common",
    desc: "Basic protection. Better than nothing.",
    use: "xp",
    useVal: 25,
    useDesc: "+25 XP",
  },
  {
    id: "i3",
    name: "Health Potion",
    icon: "🧪",
    rarity: "common",
    desc: "Glows faintly. Smells weird.",
    use: "xp",
    useVal: 50,
    useDesc: "+50 XP",
  },
  {
    id: "i4",
    name: "Bread Loaf",
    icon: "🍞",
    rarity: "common",
    desc: "Simple sustenance for the journey.",
    use: "xp",
    useVal: 30,
    useDesc: "+30 XP",
  },
  {
    id: "i5",
    name: "Wooden Staff",
    icon: "🪄",
    rarity: "common",
    desc: "A wizards first weapon.",
    use: "xp",
    useVal: 35,
    useDesc: "+35 XP",
  },
  {
    id: "i6",
    name: "Copper Coin",
    icon: "🪙",
    rarity: "common",
    desc: "Worth less than your effort. Use it.",
    use: "xp",
    useVal: 40,
    useDesc: "+40 XP",
  },
  // Rare — uncommon drops, useful effects
  {
    id: "i7",
    name: "Speed Boots",
    icon: "👟",
    rarity: "rare",
    desc: "You feel faster just holding them.",
    use: "xp",
    useVal: 100,
    useDesc: "+100 XP",
  },
  {
    id: "i8",
    name: "Prayer Beads",
    icon: "📿",
    rarity: "rare",
    desc: "Each bead a prayer remembered.",
    use: "debt",
    useVal: 5,
    useDesc: "Clear 5 prayer debt",
  },
  {
    id: "i9",
    name: "Scholar Tome",
    icon: "📚",
    rarity: "rare",
    desc: "Knowledge is the real weapon.",
    use: "xp2x",
    useVal: 1,
    useDesc: "2x XP from Life Quests today",
  },
  {
    id: "i10",
    name: "Silver Arrow",
    icon: "🏹",
    rarity: "rare",
    desc: "Precise. Purposeful. Deadly.",
    use: "xp",
    useVal: 120,
    useDesc: "+120 XP",
  },
  {
    id: "i11",
    name: "Mana Crystal",
    icon: "🔷",
    rarity: "rare",
    desc: "Pulsing with stored energy.",
    use: "xp",
    useVal: 150,
    useDesc: "+150 XP",
  },
  {
    id: "i12",
    name: "Night Cloak",
    icon: "🌑",
    rarity: "rare",
    desc: "Invisible to failure.",
    use: "freeze",
    useVal: 1,
    useDesc: "Protect streak 1 day",
  },
  // Epic — rare drops, strong effects
  {
    id: "i13",
    name: "Dragon Scale",
    icon: "🐉",
    rarity: "epic",
    desc: "Shed from a beast you cannot imagine.",
    use: "freeze",
    useVal: 1,
    useDesc: "Protect streak 1 day",
  },
  {
    id: "i14",
    name: "Holy Scroll",
    icon: "📜",
    rarity: "epic",
    desc: "Ancient wisdom carved in light.",
    use: "debt",
    useVal: 10,
    useDesc: "Clear 10 prayer debt",
  },
  {
    id: "i15",
    name: "Void Crystal",
    icon: "💎",
    rarity: "epic",
    desc: "Forged in pure determination.",
    use: "xp",
    useVal: 300,
    useDesc: "+300 XP",
  },
  {
    id: "i16",
    name: "Phoenix Feather",
    icon: "🪶",
    rarity: "epic",
    desc: "Burns cold. Grants rebirth.",
    use: "freeze",
    useVal: 2,
    useDesc: "Protect streak 2 days",
  },
  {
    id: "i17",
    name: "Elixir of Focus",
    icon: "⚗️",
    rarity: "epic",
    desc: "One sip and distraction fades.",
    use: "xp2x",
    useVal: 1,
    useDesc: "2x XP all quests today",
  },
  {
    id: "i18",
    name: "War Banner",
    icon: "🚩",
    rarity: "epic",
    desc: "Plant it. Rally yourself.",
    use: "xp",
    useVal: 400,
    useDesc: "+400 XP",
  },
  // Legendary — very rare, powerful effects
  {
    id: "i19",
    name: "Crown of Will",
    icon: "👑",
    rarity: "legendary",
    desc: "Only the truly disciplined may wear this.",
    use: "xp2x",
    useVal: 1,
    useDesc: "2x XP all quests today",
  },
  {
    id: "i20",
    name: "Blade of Dawn",
    icon: "⚔️",
    rarity: "legendary",
    desc: "Forged at Fajr. Unbreakable.",
    use: "fajr",
    useVal: 1,
    useDesc: "Auto-complete Fajr today",
  },
  {
    id: "i21",
    name: "Star Fragment",
    icon: "⭐",
    rarity: "legendary",
    desc: "A piece of something greater than yourself.",
    use: "xp",
    useVal: 750,
    useDesc: "+750 XP",
  },
  {
    id: "i22",
    name: "Eternal Flame",
    icon: "🔥",
    rarity: "legendary",
    desc: "Never goes out. Neither do you.",
    use: "freeze",
    useVal: 3,
    useDesc: "Protect streak 3 days",
  },
  {
    id: "i23",
    name: "Tome of Ages",
    icon: "📕",
    rarity: "legendary",
    desc: "Every answer you need is in here.",
    use: "debt",
    useVal: 25,
    useDesc: "Clear 25 prayer debt",
  },
  {
    id: "i24",
    name: "Ring of Abdelrahman",
    icon: "💍",
    rarity: "legendary",
    desc: "The ring of one who never quit.",
    use: "xp",
    useVal: 1000,
    useDesc: "+1000 XP",
  },
];

export interface DailyChallenge {
  label: string;
  icon: string;
  xp: number;
}

export const DAILY_CH: DailyChallenge[] = [
  { label: "Do 30 pushups", icon: "💪", xp: 60 },
  { label: "Walk 5,000 steps", icon: "🚶", xp: 50 },
  { label: "Drink 3L of water today", icon: "💧", xp: 40 },
  { label: "Do 20 squats", icon: "🏋️", xp: 55 },
  { label: "10 minutes of stretching", icon: "🧘", xp: 35 },
  { label: "All 5 prayers on time", icon: "🕌", xp: 80 },
  { label: "Cook your own meal", icon: "🍳", xp: 45 },
  { label: "15 minutes of cardio", icon: "🏃", xp: 60 },
  { label: "Read Quran for 20 mins", icon: "📖", xp: 70 },
  { label: "Clean one room completely", icon: "🧹", xp: 40 },
  { label: "Study 2 hours straight", icon: "📚", xp: 65 },
  { label: "No junk food all day", icon: "🚫", xp: 55 },
  { label: "Sleep before midnight", icon: "🌙", xp: 50 },
  { label: "Log your weight today", icon: "⚖️", xp: 20 },
];

/** Deterministic "daily challenge" pick from a string key (e.g. a date). */
export function getDailyCh(key: string): DailyChallenge {
  let hsh = 0;
  for (let i = 0; i < key.length; i++) hsh = (hsh << 5) - hsh + key.charCodeAt(i);
  return DAILY_CH[Math.abs(hsh) % DAILY_CH.length];
}

/** Weighted random loot drop. `luck` multiplies the odds of better tiers. */
export function randItem(luck?: number): Item {
  luck = luck || 1;
  const r = Math.random();
  const byR = (rr: Rarity) => ITEMS.filter((i) => i.rarity === rr);
  const pick = (a: Item[]) => a[Math.floor(Math.random() * a.length)];
  if (r < 0.05 * luck) return pick(byR("legendary"));
  if (r < 0.15 * luck) return pick(byR("epic"));
  if (r < 0.4 * luck) return pick(byR("rare"));
  return pick(byR("common"));
}
