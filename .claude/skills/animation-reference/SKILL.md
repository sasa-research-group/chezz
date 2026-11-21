---
name: animation-reference
description: Reference pass to run before keying any new Chezz character animation (walk, idle, attack with sword/spear/bow, hit reaction, death, spell cast). Finds 2-3 real-motion videos, turns them into numbered contact sheets, writes a key-pose and timing table, adapts it to our chibi proportions, and checks the keyed result against the reference. Use when starting a new action, or when an animation looks stiff, floaty or wrong.
---

# Animation reference pass

Our figures are chibi clay characters (big head, beard and belly, short arms and legs), posed by knob keys
(`*_pose.py`, solved per frame by `guard_pose.py` / IK) and baked to sprites. Real motion is the source of timing
and intent; our proportions decide the geometry. Budget about 30 minutes per new action. Worked example: the
patrol guard's spear lunge, `tools/art/diorama/lunge_pose.py`.

## A. Define the action (one line, in the pose script's header comment)
Action, length in frames at 24 fps, the hit/contact frame, the prop, and the sprite camera (high square-on view;
check the game view, not a side view). Example: "two-handed spear lunge, 28 f, hit f12, spear, game camera".

## B. Find 2-3 reference clips
Want: static camera, whole body in frame, side or 3/4 view; one clean drill, one slow motion, one stylised
(game or animation). Drills beat sparring and film. Search "<action> slow motion", "<action> side view",
"<weapon> technique drill".
- Sword, spear, staff: HEMA schools (Academie Duello, Scholagladiatoria, Chicago Swordplay Guild), wushu
  (qiang = spear, jian/dao = sword), kendo.
- Bow: Olympic archery form, side on.
- Walks, runs, idles: animator walk-cycle references; Mixamo / ActorCore previews.
- Hit reactions, deaths: stage-combat and stunt reaction clips; fighting-game frame data.
- Spells: martial-arts forms, throwing (shot put), conducting; game cast animations.
- A Mixamo clip played in Blender is a fine 3D pose reference too (look only; no retargeting).

Download small: `yt-dlp -f "bv*[height<=720]" --download-sections "*0:05-0:12" -o clip.mp4 URL`
(install with `brew install yt-dlp` if missing; ask Wesley first, it is a download). Keep clips in the scratch
folder, never in the repo (licences: study only, ship nothing from them).

## C. Contact sheets
`python3 tools/art/diorama/refsheet.py clip.mp4 OUT --start 5.2 --end 6.4` writes OUT/f_###.png at 24 fps and
OUT/sheet.png with frame numbers. Read the sheet, then open single frames around each key pose.

## D. Key-pose and timing table
Write it into the pose script's header (or the art doc) before keying:

| key | ref frame | our frame | body | hands / prop | leads |
|---|---|---|---|---|---|

Keys are usually: guard, anticipation (coil), drive, contact/hit, hold, recovery. Normalise timing to 24 fps.
Note what leads (hips before shoulders before hands), where the weight is, and where the prop sits relative to
the body. Mark which numbers are measured and which are guessed.
Spear example (Academie Duello): the rear hand shoves the shaft through a still lead hand; the shaft runs beside
the body at hip or rib height, not across the chest; fast out, slower back.

## E. Adapt to chibi proportions
Keep the reference's timing and silhouette; change the geometry.
1. Reach: our arms are short. Work out what the hands can actually reach before copying a hold.
2. Clear the body first: try the key poses alone with the clip check before animating anything.
   `python3 tools/art/diorama/gripsearch.py KEYNAME OUT gx=a,b gy=... gz=... tilt=...` grid-searches a
   key's grip (or `F6`, a blended frame) and ranks by clip depth and hand reach. Beards and bellies block the
   centre line, so props go beside the torso (the lunge holds the spear low at the right hip, angled in across).
3. Cheat for the sprite camera, not physics: the game view is what has to read.
4. Exaggerate anticipation and follow-through; hold the hit 2-4 frames; squash and stretch on belly and head.

## F. Key, check, compare
Key 4-6 poses, then breakdowns. Then:
- Solve every frame and run the clip check over the whole action (`strike_check.py`, with `CHAR_GLB` set to the
  figure's rig; under 0.03 depth is a touch at most). In-between frames clip even when keys are clean; search the
  bad frame with `gripsearch.py F<n>`.
- Render previews (`--render`) and build a contact sheet in the game camera; put it beside the reference sheet
  and compare timing and silhouette.
- Add or update the action's test (see `test_lunge_pose.py`: hand reach on every key, a whole-action clip check).

## G. Video-to-motion capture: usually skip it
For a short action (about 1 s, 4-6 keys) hand-keying is cheaper. Monocular tools (GVHMR, WHAM, 4D-Humans) need an
NVIDIA GPU (the Windows PC), mostly carry non-commercial licences, are weakest exactly along a thrust's depth axis,
and give a human skeleton that still has to be retargeted to stubby proportions, where hands miss the prop and
clipping returns. Consider it only for long, human-shaped cycles with many variants. Cloud services (Rokoko,
DeepMotion, Move.ai) cost money: ask Wesley first.
