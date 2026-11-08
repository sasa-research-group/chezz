/** Grumble (misfit pawn): Hop. For 2 energy he hops two squares straight forward over whatever
 * stands between (a piece of either side, a wall; holes and gates once they exist), landing only on
 * a square that is on the board, not a wall and empty. The plain forward step stays. A hop onto the
 * far row promotes like any move. He is far too grumpy to defend, so the brace button is hidden
 * and the enemy never braces him. Strike unchanged. See docs/variants.md. */
import type { Ability } from "../abilities";
import { forward, same } from "../board";

export const grumble: Ability = {
  id: "misfit-pawn", variant: "misfit", kind: "pawn", name: "Grumble", ability: "Hop",
  sentence: "Grumble can hop two squares straight forward over anything (a piece, a wall, a hole) for 2 energy, but is far too grumpy to ever defend.",
  moveTargets: (g, u, base, ctx) => {
    const landing = { x: u.x, y: u.y + 2 * forward(u) };
    if (ctx.energy < 2 || !ctx.open(landing) || base.some(t => same(t, landing))) return base;
    return [...base, { ...landing, cost: 2 }];
  },
  crown: "knight",
  canDefend: () => false,
};
