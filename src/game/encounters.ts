/** The road: every battle the player fights, in order. Board shape, walls, enemy spawns (kind, x, y,
 * hp, optional variant) and where the player's army starts. Data only, so abilities and the board
 * helpers can read it without importing the rules. */
import type { Encounter, Pos } from "./turns";

export const ENCOUNTERS: Encounter[] = [
  { title: "The roadside patrol", story: "Two royal lackeys. One very annoyed former king. Clear the road.", reward: 8, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 1, 1], ["pawn", 2, 1, 1]], starts: [{ x: 1, y: 3 }] },
  { title: "The first follower", story: "The old toll gate is closed. Find a way around, and bring everyone home.", reward: 8, enemyEnergy: 3, width: 6, height: 4, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["pawn", 5, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 5, y: 3 }] },
  { title: "The narrow crossing", story: "A battered knight holds the bridge. Your little rebellion has somewhere to be.", reward: 0, enemyEnergy: 3, width: 6, height: 6, walls: [2, 3].flatMap(y => [0, 1, 4, 5].map(x => ({ x, y }))), spawns: [["knight", 3, 0, 2], ["pawn", 1, 1, 1], ["pawn", 4, 1, 1]], starts: [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }] },
];

/** The Grandmaster's Guild: puzzles on boards the road never shows. Each hands you a fixed army and a
 * turn limit; the solver (src/game/solver.ts) checks that every one has a forced win in that many turns. */
const sq = (x: number, y: number): Pos => ({ x, y });
export const PUZZLES: Encounter[] = [
  {
    title: "Rabbit Holes", story: "Two burrows, one tunnel. The long way round is the short way.", goal: "Fell King Gilt this turn.", win: "king", reward: 0, enemyEnergy: 3, width: 5, height: 5, turns: 1,
    walls: [sq(1, 1), sq(3, 1), sq(1, 3), sq(3, 3)], portals: [[sq(0, 4), sq(4, 0)]],
    spawns: [["pawn", 1, 0, 1, "royal"], ["king", 2, 0, 3, "royal"]], starts: [],
    army: [["king", 2, 2, 5, "rebel"], ["rook", 1, 4, 5, "rebel"]],
  },
  {
    title: "Frozen Lake", story: "Step onto the ice and you keep going. The extra squares are free; the stopping is the hard part.", goal: "Fell King Gilt within two turns.", win: "king", reward: 0, enemyEnergy: 3, width: 5, height: 5, turns: 2,
    walls: [], ice: [sq(1, 2), sq(2, 2), sq(3, 2), sq(1, 3), sq(2, 3), sq(3, 3)],
    spawns: [["pawn", 4, 0, 1, "royal"], ["king", 4, 1, 5, "royal"]], starts: [],
    army: [["rook", 0, 2, 5, "misfit"], ["king", 2, 4, 5, "rebel"]],
  },
  {
    title: "The Portcullis", story: "A lever opens the gate, slowly. A sledgehammer opens it now. Two keys, one mate.", goal: "Fell King Gilt within two turns.", win: "king", reward: 0, enemyEnergy: 3, width: 5, height: 5, turns: 2,
    walls: [sq(0, 1), sq(1, 1), sq(3, 1), sq(4, 1)], gates: [{ at: sq(2, 1), group: "gate" }], levers: [{ at: sq(0, 2), group: "gate" }],
    spawns: [["king", 2, 0, 3, "royal"], ["knight", 3, 0, 3, "royal"]], starts: [],
    army: [["rook", 2, 4, 5, "rebel"], ["king", 3, 4, 5, "rebel"]],
  },
  {
    title: "The Sinkhole Road", story: "Pits swallow whatever is knocked into them, and the bridge falls away behind whoever crosses it.", goal: "Clear the road within three turns.", reward: 0, enemyEnergy: 3, width: 5, height: 5, turns: 3,
    walls: [], holes: [sq(0, 1)], crumbling: [sq(0, 3), sq(1, 3), sq(2, 3), sq(3, 3), sq(4, 3)],
    spawns: [["king", 2, 0, 5, "royal"], ["pawn", 2, 1, 1, "royal"], ["knight", 1, 2, 3, "royal"]], starts: [],
    army: [["bishop", 1, 4, 3, "misfit"], ["king", 2, 4, 5, "rebel"]],
  },
];
