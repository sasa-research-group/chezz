"""Blind pair judge: can Gemini tell the live (browser) sludge from the full Cycles render?
python3 pair_judge.py CYCLES.mp4 LIVE.mp4 OUT.json [trials=6]
Each trial shows the two clips in a random order as A and B. Pass = it picks the live one no better than chance."""
import base64, json, os, random, sys, urllib.request

cyc, live, out = sys.argv[1], sys.argv[2], sys.argv[3]
trials = int(sys.argv[4]) if len(sys.argv) > 4 else 6
mime = "video/mp4" if cyc.endswith(".mp4") else "image/png"
PROMPT = """Two clips, A then B, of the same small handmade miniature diorama: pools of thick glowing green ooze
bubbling in a broken stone floor, same camera. One was rendered entirely offline with a path tracer (every frame
fully path traced). The other is a realtime game renderer that draws the ooze's moving surface itself over a still
path-traced background, approximating the lighting. Look closely at the ooze: highlights, reflections, shading on
the bubbles, the dark torn holes, the flung blobs, edges where ooze meets stone, any flicker, aliasing or mismatch.

Return JSON only:
{"realtime_is": "A" | "B", "confidence": 0-100 (50 = a pure guess),
 "tells": [up to three short concrete visual differences that gave it away, most important first],
 "quality_A": 1-10, "quality_B": 1-10 (how good each looks as a premium handmade diorama)}"""


def part(path):
    return {"inline_data": {"mime_type": mime, "data": base64.b64encode(open(path, "rb").read()).decode()}}


url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"
rng = random.Random()
res = []
for i in range(trials):
    live_first = rng.random() < 0.5
    a, b = (live, cyc) if live_first else (cyc, live)
    body = {"contents": [{"parts": [{"text": "Clip A:"}, part(a), {"text": "Clip B:"}, part(b), {"text": PROMPT}]}],
            "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"}}
    req = urllib.request.Request(url, json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    r = json.load(urllib.request.urlopen(req, timeout=600))
    j = json.loads("".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"]))
    truth = "A" if live_first else "B"
    j["caught"] = j["realtime_is"] == truth
    j["q_live"], j["q_cycles"] = (j["quality_A"], j["quality_B"]) if live_first else (j["quality_B"], j["quality_A"])
    res.append(j)
    print(i, "caught" if j["caught"] else "fooled", j["confidence"], j["tells"][:2], flush=True)
caught = sum(x["caught"] for x in res)
summ = {"caught": caught, "trials": trials,
        "mean_conf_when_caught": sum(x["confidence"] for x in res if x["caught"]) / max(1, caught),
        "q_live": sum(x["q_live"] for x in res) / trials, "q_cycles": sum(x["q_cycles"] for x in res) / trials,
        "runs": res}
json.dump(summ, open(out, "w"), indent=1)
print("SUMMARY", {k: v for k, v in summ.items() if k != "runs"})
