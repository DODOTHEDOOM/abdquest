// Extracted verbatim from legacy/AbdQuest.html (the `LEVELS` table + getLvl/getNextLvl).
// Behaviour is intentionally identical to the legacy app — this module only makes the
// logic importable and testable. Do not "fix" anything here without a failing test first.

export interface Level {
  level: number;
  name: string;
  minXp: number;
  avatar: string;
  glow: string;
}

export const LEVELS: Level[] = [
  { level: 1, name: "Peasant", minXp: 0, avatar: "🧑", glow: "#888" },
  { level: 2, name: "Squire", minXp: 150, avatar: "🧑", glow: "#aaa" },
  { level: 3, name: "Scout", minXp: 350, avatar: "🏹", glow: "#aaa" },
  { level: 4, name: "Warrior", minXp: 600, avatar: "🗡️", glow: "#4488ff" },
  { level: 5, name: "Knight", minXp: 1000, avatar: "🛡️", glow: "#4488ff" },
  { level: 6, name: "Champion", minXp: 1500, avatar: "⚔️", glow: "#aa44ff" },
  { level: 7, name: "Crusader", minXp: 2200, avatar: "🌙", glow: "#aa44ff" },
  { level: 8, name: "Berserker", minXp: 3000, avatar: "🪓", glow: "#ff4444" },
  { level: 9, name: "Warlord", minXp: 4000, avatar: "👑", glow: "#ffd700" },
  { level: 10, name: "Warchief", minXp: 5500, avatar: "⚔️", glow: "#ffd700" },
  { level: 11, name: "Conqueror", minXp: 7000, avatar: "🏆", glow: "#ffd700" },
  { level: 12, name: "Titan", minXp: 9000, avatar: "💪", glow: "#ff6b35" },
  { level: 13, name: "Shadow", minXp: 11500, avatar: "🌑", glow: "#6644aa" },
  { level: 14, name: "Phantom", minXp: 14000, avatar: "👻", glow: "#6644aa" },
  { level: 15, name: "Reaper", minXp: 17000, avatar: "💀", glow: "#aa2244" },
  { level: 16, name: "Overlord", minXp: 20500, avatar: "🔱", glow: "#ffd700" },
  { level: 17, name: "Sovereign", minXp: 24500, avatar: "👑", glow: "#ffd700" },
  { level: 18, name: "Emperor", minXp: 29000, avatar: "🌟", glow: "#ffaa00" },
  { level: 19, name: "Archon", minXp: 34000, avatar: "⚡", glow: "#44aaff" },
  { level: 20, name: "Paragon", minXp: 40000, avatar: "🌟", glow: "#fff" },
  { level: 21, name: "Ascendant", minXp: 47000, avatar: "✨", glow: "#fff" },
  { level: 22, name: "Celestial", minXp: 55000, avatar: "🌠", glow: "#aaddff" },
  { level: 23, name: "Eternal", minXp: 64000, avatar: "🔮", glow: "#aaddff" },
  { level: 24, name: "Undying", minXp: 74000, avatar: "🔥", glow: "#ff6b35" },
  { level: 25, name: "Mythic", minXp: 85000, avatar: "🐉", glow: "#ff4444" },
  { level: 26, name: "Legendary", minXp: 97000, avatar: "💎", glow: "#ffd700" },
  { level: 27, name: "Ancient", minXp: 110000, avatar: "🗿", glow: "#888866" },
  { level: 28, name: "Primordial", minXp: 124000, avatar: "🌋", glow: "#ff4400" },
  { level: 29, name: "Cosmic", minXp: 139000, avatar: "🌌", glow: "#4444ff" },
  { level: 30, name: "Transcendent", minXp: 155000, avatar: "🌀", glow: "#aa44ff" },
  { level: 31, name: "Divine", minXp: 173000, avatar: "☀️", glow: "#ffdd00" },
  { level: 32, name: "Godlike", minXp: 192000, avatar: "⚡", glow: "#fff" },
  { level: 33, name: "Radiant", minXp: 213000, avatar: "💫", glow: "#fff" },
  { level: 34, name: "Infinite", minXp: 236000, avatar: "🔮", glow: "#aaddff" },
  { level: 35, name: "Prophet", minXp: 261000, avatar: "📿", glow: "#44ddcc" },
  { level: 36, name: "Oracle", minXp: 288000, avatar: "👁️", glow: "#aa44ff" },
  { level: 37, name: "Arbiter", minXp: 317000, avatar: "⚖️", glow: "#ffd700" },
  { level: 38, name: "Vanguard", minXp: 348000, avatar: "🛡️", glow: "#4488ff" },
  { level: 39, name: "Apex", minXp: 381000, avatar: "🦅", glow: "#ffaa00" },
  { level: 40, name: "Zenith", minXp: 416000, avatar: "🏔️", glow: "#fff" },
  { level: 41, name: "Eternal King", minXp: 454000, avatar: "👑", glow: "#ffd700" },
  { level: 42, name: "Eternal Flame", minXp: 494000, avatar: "🔥", glow: "#ff6b35" },
  { level: 43, name: "Star Forged", minXp: 537000, avatar: "⭐", glow: "#ffdd44" },
  { level: 44, name: "World Ender", minXp: 583000, avatar: "🌍", glow: "#ff4444" },
  { level: 45, name: "The Undying", minXp: 632000, avatar: "💀", glow: "#aa44ff" },
  { level: 46, name: "The Chosen", minXp: 684000, avatar: "✨", glow: "#fff" },
  { level: 47, name: "The Immortal", minXp: 740000, avatar: "💎", glow: "#ffd700" },
  { level: 48, name: "The Eternal", minXp: 800000, avatar: "🔮", glow: "#aaddff" },
  { level: 49, name: "The One", minXp: 865000, avatar: "🌟", glow: "#fff" },
  { level: 50, name: "Abdelrahman", minXp: 935000, avatar: "👑", glow: "#ffd700" },
];

export function getLvl(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (xp >= LEVELS[i].minXp) return LEVELS[i];
  return LEVELS[0];
}

export function getNextLvl(xp: number): Level {
  const c = getLvl(xp);
  return LEVELS.find((l) => l.level === c.level + 1) || c;
}
