# Check of sludge_pond.py (no Blender needed):  python3 tools/art/diorama/test_sludge_pond.py
# Touching sludge squares group into one pond, the pond runs straight across shared edges and stays inset on free
# sides, an L gets a filled inside corner, a 2x2 pond has no island in its middle, the outline is one loop with the
# pond on its left, and the rim stones never overlap.
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sludge_pond as sp

S = 2.04
fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


# grouping
g = sp.components([(0, 0), (1, 0), (0, 1), (1, 1), (3, 0), (3, 1), (3, 2), (1, 3), (2, 4)])
check(g == [[(0, 0), (0, 1), (1, 0), (1, 1)], [(1, 3)], [(2, 4)], [(3, 0), (3, 1), (3, 2)]], "components: 2x2, two lone (diagonal is not touching), a channel")
check(sp.components([]) == [], "components: none")

# a 3-square channel along y
ch = sp.pond_sdf([(0, 0), (0, 1), (0, 2)], S, margin=0.12)
check(ch(0, 0.5 * S) < -0.3 * S, "channel: runs straight across the shared edge")
check(ch(0, 1.5 * S) < -0.3 * S, "channel: and the second one")
check(abs(ch(0.5 * S - 0.12 * S, S)) < 1e-6, "channel: inset by the margin on its free side")
check(ch(0, -0.5 * S + 0.05 * S) > 0, "channel: closed at its end")

# 2x2: no island in the middle (where four corners meet)
sq = sp.pond_sdf([(0, 0), (1, 0), (0, 1), (1, 1)], S)
check(sq(0.5 * S, 0.5 * S) < -0.3 * S, "2x2: the middle is pond")

# L: the inside corner is filled with a fillet (not a notch), the missing square stays stone
L = sp.pond_sdf([(0, 0), (1, 0), (0, 1)], S, margin=0.12, fillet=0.1)
check(L(1 * S, 1 * S) > 0.2 * S, "L: the missing square is stone")
check(L(0.5 * S - 0.12 * S + 0.01, 0.5 * S - 0.12 * S + 0.01) < 0, "L: inside corner filled")

# ragged noise moves the edge by at most ragged * S
R = sp.pond_sdf([(0, 0)], S, ragged=0.03, noise=lambda x, y: math.sin(7 * x) * math.cos(5 * y))
P = sp.pond_sdf([(0, 0)], S)
check(max(abs(R(x * 0.1, y * 0.1) - P(x * 0.1, y * 0.1)) for x in range(-10, 11) for y in range(-10, 11)) <= 0.03 * S + 1e-9, "ragged: bounded")

# outline: one loop, on the zero line, pond on its left
loops = sp.outline(sq, (-S, -S, 2 * S, 2 * S), 0.02 * S)
check(len(loops) == 1, "outline: one loop for the 2x2 pond (got %d)" % len(loops))
check(max(abs(sq(x, y)) for x, y in loops[0]) < 0.01 * S, "outline: points on the edge")
check(sp._area(loops[0]) > 0, "outline: counter-clockwise (pond on the left)")
check(abs(sp._area(loops[0]) - (2 * S - 0.24 * S) ** 2) < 0.05 * (2 * S) ** 2, "outline: encloses about the inset 2x2 area")
ring = sp.outline(lambda x, y: abs(math.hypot(x, y) - 1.0) - 0.3, (-2, -2, 2, 2), 0.02)
check(len(ring) == 2 and sp._area(ring[0]) > 0 and sp._area(ring[1]) < 0, "outline: a ring gives an outer loop and a clockwise inner one")

# rim stones
for comp in ([(0, 0)], [(0, 0), (0, 1), (0, 2)], [(0, 0), (1, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (0, 1)]):
    f = sp.pond_sdf(comp, S)
    lp = sp.outline(f, (-S, -S, 3 * S, 3 * S), 0.02 * S)
    sl = sp.rim_slots(lp, f, S, random.Random(3))
    per = sum(math.dist(l[q], l[(q + 1) % len(l)]) for l in lp for q in range(len(l)))
    check(sp.no_overlap(sl), "rim: no overlaps, %d squares" % len(comp))
    check(len(sl) >= per / (0.4 * S), "rim: the edge is lined (%d stones on %.1f squares of edge)" % (len(sl), per / S))
    check(all(-0.15 * S < f(x, y) < 0.15 * S for x, y, *_ in sl), "rim: stones sit on the edge")
    check(all(abs(math.hypot(*o) - 1) < 1e-6 and o[0] * sp.grad(f, x, y)[0] + o[1] * sp.grad(f, x, y)[1] > 0.5 for x, y, _, _, o in sl), "rim: normals point out")
a1 = sp.rim_slots(loops, sq, S, random.Random(5))
a2 = sp.rim_slots(loops, sq, S, random.Random(5))
check(a1 == a2, "rim: same seed, same stones")

print("SLUDGE POND TESTS", "FAILED: %d" % len(fails) if fails else "OK")
sys.exit(1 if fails else 0)
