# Check of lamp_colour.py (no Blender needed):  python3 tools/art/diorama/test_lamp_colour.py
# Blender's Kelvin lamp colours, as the live sludge exports them: warm when low, cool when high, and close to a value
# Blender itself rendered between the table's rows.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lamp_colour import blackbody, lamp_kelvin, mix

fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


w = blackbody(2700)
check(w[0] > w[1] > w[2] > 0, "2700 K is warm: red > green > blue")
c = blackbody(12000)
check(c[2] > c[0], "12000 K is cool: blue > red")
# Blender 5.3 renders its Blackbody node at 2850 K (the fairy bulbs) as (1.6954, 0.9381, 0.4382): a measured row
# sits between rows 2500 and 3000, so the in-between value must come out close
b = blackbody(2850)
check(all(abs(x - y) < 0.03 for x, y in zip(b, (1.6954, 0.9381, 0.4382))), "2850 K close to Blender's render")
check(blackbody(500) == blackbody(1000) and blackbody(20000) == blackbody(12000), "clamped to the table's ends")

l = lamp_kelvin(6500)
check(all(abs(x - 1) < 0.05 for x in l), "a 6500 K lamp is about white")
# Blender 5.3 lit a white plane with a 2850 K sun at (1.34, 0.81, 0.37) times the plain sun: between two rows
check(all(abs(x - y) < 0.04 for x, y in zip(lamp_kelvin(2850), (1.34, 0.81, 0.37))), "2850 K lamp close to Blender's render")
check(lamp_kelvin(2850)[2] < blackbody(2850)[2], "the lamp curve is not the node's")
check(mix([1, 0, 0], [0, 1, 0], 0.4) == [0.6, 0.4, 0.0], "mix goes the factor's way from A to B")

print("\n%d failed" % len(fails) if fails else "\nall ok")
sys.exit(1 if fails else 0)
