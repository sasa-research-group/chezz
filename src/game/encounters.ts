/** The road: every battle the player fights, in order. Board shape, walls, enemy spawns (kind, x, y,
 * hp, optional variant) and where the player's army starts. Data only, so abilities and the board
 * helpers can read it without importing the rules. */
import type { Encounter } from "./turns";

export const ENCOUNTERS: Encounter[] = [
  { title: "The roadside patrol", story: "Two royal lackeys. One very annoyed former king. Clear the road.", reward: 8, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 1, 1], ["pawn", 2, 1, 1]], starts: [{ x: 1, y: 3 }] },
  { title: "The first follower", story: "The old toll gate is closed. Find a way around, and bring everyone home.", reward: 8, enemyEnergy: 3, width: 6, height: 4, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["pawn", 5, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 5, y: 3 }] },
  { title: "The narrow crossing", story: "A battered knight holds the bridge. Your little rebellion has somewhere to be.", reward: 0, enemyEnergy: 3, width: 6, height: 6, walls: [2, 3].flatMap(y => [0, 1, 4, 5].map(x => ({ x, y }))), spawns: [["knight", 3, 0, 2], ["pawn", 1, 1, 1], ["pawn", 4, 1, 1]], starts: [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }] },
];
