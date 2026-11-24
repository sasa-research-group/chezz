# Check of rook_death.py (the rebel rook taken). The key table and timing are checked in plain Python against the
# reference pass (scratch rook/death/REFERENCE.md); then the story's frames are solved in Blender (rook_pose.py, no
# render): standing at the blow, off his feet with his legs up on the landing, flat with the hammer on the floor
# beside him at the end, nothing clipping.
#   python3 test_rook_death.py
import json, os, re, sys, tempfile, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rook_death as rd


def test_keys():
    ts = [t for t, _, _ in rd.KEYS]
    assert ts == sorted(ts) and ts[0] == 0 and rd.LAND in ts, ts
    assert 14 <= rd.LAND <= 18, rd.LAND  # the reference lands at 12 f; ours a touch slower, as the guard's 15
    assert 24 <= ts[-1] <= 32, ts[-1]  # about 1.2 s
    # woe from the blow, X eyes from the landing on
    assert [rd.face_at(f) for f in (0, rd.LAND - 1, rd.LAND, ts[-1])] == [2, 2, 3, 3]
    k0 = rd.knobs_at(0)
    assert k0["fall"] < 6 and k0["let"] < 0.5 and k0["drop"] == 0, k0  # the blow cuts from the idle carry
    assert rd.knobs_at(5)["let"] == 1.0  # both hands off the handle by the snap's peak
    # the hammer hits the floor on frame 10 (before he does), then one small bounce
    assert rd.knobs_at(9)["drop"] < 1.0 and rd.knobs_at(10)["drop"] == 1.0
    assert rd.knobs_at(10)["clat"] == 0.0 and rd.knobs_at(10 + rd.CLAT_F)["clat"] == 1.0
    # on his back at the landing, legs up; legs down after; still at the end
    land, end = rd.knobs_at(rd.LAND), rd.knobs_at(ts[-1])
    assert land["fall"] >= 85 and land["kick"] >= 25 and end["fall"] >= 85 and end["kick"] < 0
    assert end["lean"] >= 15  # head and shoulders raised: his visor reads from the high camera
    # the fall keeps speeding up into the floor (ease in on the landing key)
    assert dict((t, e) for t, _, e in rd.KEYS)[rd.LAND] == "in"


def test_solves():
    out = tempfile.mkdtemp()
    last = rd.KEYS[-1][0]
    r = subprocess.run(["python3", os.path.join(HERE, "rook_death.py"), out, "--only", "0,%d,%d" % (rd.LAND, last)],
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
    lines = {int(m.group(1)): m.group(2) for m in re.finditer(r"frame +(\d+) \| (.*)", r.stdout)}
    idle = json.load(open(os.path.join(out, "f99", "rook_pose.json")))
    for f, txt in sorted(lines.items()):
        miss = [float(x) for x in re.findall(r"miss ([0-9.]+)", txt)]
        assert miss and max(miss) < 0.01, (f, txt)
        fl = float(re.search(r"FLOOR hammer (-?[0-9.]+) feet (-?[0-9.]+)", txt).group(1))
        feet = float(re.search(r"FLOOR hammer (-?[0-9.]+) feet (-?[0-9.]+)", txt).group(2))
        hclip = float(re.search(r"CLIP hammer +([0-9.]+)", txt).group(1))
        g = json.load(open(os.path.join(out, "f%02d" % f, "rook_pose.json")))
        assert g["fists"][0]["m"] == idle["fists"][0]["m"]  # his left fist keeps its carry grip on the forearm
        if f == 0:
            assert fl > 0.4 and feet < 0.12, (f, txt)  # standing, the hammer still up at his shoulders
        if f == rd.LAND:
            assert feet > 0.25, (f, txt)  # legs swung up as his back lands
        if f in (rd.LAND, last):
            assert -0.01 < fl < 0.01, (f, txt)  # the hammer lies on the floor
            assert hclip < 0.01, (f, txt)  # beside him, not through him
        if f == last:
            assert feet < 0.2, (f, txt)  # legs back down
        print("ok frame", f, "hammer floor", fl, "feet", feet, "hammer clip", hclip, flush=True)


if __name__ == "__main__":
    test_keys()
    print("ok keys", flush=True)
    test_solves()
    print("ALL OK")
