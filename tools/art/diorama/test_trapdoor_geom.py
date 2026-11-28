# Check of trapdoor_geom.py (no Blender needed):  python3 tools/art/diorama/test_trapdoor_geom.py
# The planks fill the door's width without overlapping, the ironwork stays on the door, the hung-open door goes down
# (not up, Wesley 2026-11-25) and leaves most of the opening clear for a falling figure, its back face never reaches
# past the hinge inset into the pit's back wall, and it stops above the pit's floor.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import trapdoor_geom as tg

S = 2.04
hw = 0.4 * S
th = 0.055 * S
W = L = 2 * hw - 2 * 0.012 * S
fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


ps = tg.planks(W, L, th, n=4, seed=5)
check(len(ps) == 4, "four planks")
edges = sorted((p["at"][0] - p["size"][1] / 2, p["at"][0] + p["size"][1] / 2) for p in ps)
check(all(edges[k][1] < edges[k + 1][0] for k in range(3)), "planks never overlap (a dark gap between each)")
check(abs(edges[0][0] + W / 2) < 1e-9 and abs(edges[-1][1] - W / 2) < 1e-9, "planks span the door's full width")
check(all(p["size"][0] <= L + 1e-9 and p["at"][1] - p["size"][0] / 2 >= -L - 1e-9 and p["at"][1] + p["size"][0] / 2 <= 1e-9
          for p in ps), "planks stay within the door's length (hinge at y=0, front at -L)")
check(len({round(p["size"][1], 6) for p in ps}) == 4, "plank widths differ, as hand-built")
check(tg.planks(W, L, th, seed=5) == ps, "the same seed gives the same door")

iw = tg.ironwork(W, L, th)
kinds = [p["kind"] for p in iw]
check(kinds.count("torus") == 1, "one ring pull")
check(kinds.count("dome") == 8, "a nail on each plank of both straps")
check(all(-W / 2 - 1e-9 <= p["at"][0] <= W / 2 + 1e-9 and -L - 1e-9 <= p["at"][1] <= 1e-9 for p in iw),
      "all ironwork sits on the door")
ring = next(p for p in iw if p["kind"] == "torus")
check(ring["at"][1] < -0.8 * L, "the ring is at the front edge, away from the hinge")

y, z = tg.hung(L, th, tg.FALLEN_DEG)
check(z < -0.95 * L, "fallen: the front edge swings down into the pit, not up (z %.3f)" % z)
check(tg.hung(L, th, 0) == (-L, 0.0), "shut: the door lies flat")
share = tg.clear_share(W, L, th, tg.FALLEN_DEG, hw)
check(share > 0.9, "fallen: the hanging door leaves %.0f%% of the opening clear for a falling figure" % (100 * share))
# the back face (z = -th) after the swing must stay within the inset the builder leaves behind the hinge (1.2 th)
t = math.radians(tg.FALLEN_DEG)
back = max(yy * math.cos(t) - zz * math.sin(t) for yy, zz in ((0, -th), (-L, -th)))
check(back <= 1.2 * th, "fallen: the door's back face stays off the pit's back wall (%.3f <= %.3f)" % (back, 1.2 * th))
depth = 1.15 * S
check(-z < depth - 0.05 * S, "fallen: the door hangs clear of the pit's floor")
mt = tg.moss_tufts(W, L)
gx = [(edges[k][1] + edges[k + 1][0]) / 2 for k in range(3)]
check(len(mt) == 8 and all(min(abs(x - g) for g in gx) < 0.02 * W and -L < y < 0 for x, y, r in mt),
      "moss tufts sit in the gaps between boards, on the door")
wd = tg.wall_deg(L, th)
check(90.0 < wd < 93.0, "the back wall stops the door just past plumb (%.2f deg)" % wd)
fc = tg.fall_curve(wall=wd)
check(fc[0] == 0.0 and abs(fc[-1] - tg.FALLEN_DEG) < 1e-9, "the drop runs from shut to fallen")
check(max(fc) <= wd + 1e-9, "the door never swings through the pit's back wall")
hit = fc.index(wd)
check(14 <= hit <= 18, "a 1.9 m door takes about 16 frames to swing down (%d)" % hit)
check(all(b > a for a, b in zip(fc[:hit], fc[1:hit + 1])), "it speeds up all the way down")
steps = [b - a for a, b in zip(fc[:hit - 1], fc[1:hit])]  # the hit frame is a part frame
check(all(b >= a - 1e-9 for a, b in zip(steps, steps[1:])), "each frame turns it further than the last (gravity)")
check(min(fc[hit:]) < wd - 10, "it bounces back off the wall")
check(2 <= tg.fall_curve(L_m=0.05).index(91.0) <= 3, "a 5 cm model door drops in 2-3 frames, as the clips show")
check(len(fc) <= 40, "the whole drop fits in under 2 s (%d frames)" % len(fc))
check(tg.inside(0.1, -0.1, 0.2) and not tg.inside(0.3, 0.0, 0.2), "inside() is a square test")

# the bake mask: a pinhole inside the outline is filled, a notch open to the edge is not
grid = [[c == "#" for c in r] for r in ("......", ".####.", ".#.##.", ".####.", ".##...", "......")]
holes = tg.enclosed_holes(grid)
check(holes == [(2, 2)], "only the enclosed pinhole is filled (%s)" % holes)
check(tg.enclosed_holes([[True]]) == [] and tg.enclosed_holes([[False]]) == [], "1-pixel images have no holes")

print("%d failed" % len(fails) if fails else "all ok")
sys.exit(1 if fails else 0)
