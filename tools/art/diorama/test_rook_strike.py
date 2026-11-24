# Check of rook_strike.py (the rebel rook's one-handed hammer slam). The key table is checked in plain Python; then
# the swing's key frames are solved in Blender (rook_pose.py, no render) and must reach, keep clear of his body and
# hold the wrist in line with the arm (Wesley 2026-11-23: "the wrist doesn't break from the arm").
#   python3 test_rook_strike.py
import os, re, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rook_strike as rs


def test_keys():
    ts = [t for t, _, _ in rs.KEYS]
    assert ts == sorted(ts) and ts[0] == 0, ts
    assert rs.HIT in ts and any(k is rs.HIT_ for t, k, _ in rs.KEYS if t == rs.HIT), "HIT must be the blow's key"
    # starts and ends in the shoulder carry (where he landed), wrist free
    for f in (0, ts[-1]):
        k = rs.knobs_at(f)
        assert k["lock"] == 0 and k["wa"] == 92, (f, k["lock"], k["wa"])
        for n in ("th", "psi", "gx", "gy", "gz"):
            assert abs(k[n] - rs.IDLE[n]) < 1e-9, (f, n)
    # every key between is locked, and the hammer line never swings the long way round between keys
    full = [{**rs.IDLE, **k} for _, k, _ in rs.KEYS]
    for k in full[1:-1]:
        assert k["lock"] == 1, k
    for a, b in zip(full, full[1:]):
        assert abs(b["th"] - a["th"]) <= 180 and abs(b["psi"] - a["psi"]) <= 180, (a["th"], b["th"], a["psi"], b["psi"])
    # the swing keys hold the handle in line with the forearm (wa well under the carry's square grip)
    for k in (rs.COCK, rs.TOP, rs.HIT_, rs.HOLD):
        assert k["wa"] <= 50, k["wa"]
    assert rs.KEYS[-1][1].get("ahead", 0) > 0  # he steps in and lands on the target's square


def test_solves():
    out = tempfile.mkdtemp()
    frames = [t for t, k, _ in rs.KEYS if k in (rs.COCK, rs.TOP, rs.HIT_)]
    for f in sorted(set(frames)):
        _, lines = rs.solve(out, f, 0)
        txt = " | ".join(lines)
        miss = [float(x) for x in re.findall(r"miss ([0-9.]+)", txt)]
        assert miss and max(miss) < 0.01, (f, txt)
        clip = float(re.search(r"CLIP_MAX ([0-9.]+)", txt).group(1))
        assert clip < 0.02, (f, txt)
        wrist = float(re.search(r"WRIST left ([0-9.]+)", txt).group(1))
        wa = rs.knobs_at(f)["wa"]
        assert abs(wrist - wa) <= 6, (f, wrist, wa)
        if f == rs.HIT:  # the head is on the floor, not through it
            fl = float(re.search(r"FLOOR hammer (-?[0-9.]+)", txt).group(1))
            assert -0.03 < fl < 0.03, (f, fl)
        print("ok frame", f, "wrist", wrist, "clip", clip, flush=True)


if __name__ == "__main__":
    test_keys()
    print("ok keys", flush=True)
    test_solves()
    print("ALL OK")
