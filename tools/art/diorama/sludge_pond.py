# The sludge pond's shape, without Blender (Wesley 2026-11-24: sludge squares that touch become one pond, three in a row
# a channel, any shape). build_sludge_cycles.py builds the Blender objects from what this works out:
#   components(squares)            -> touching squares grouped (4-neighbour)
#   pond_sdf(comp, S, ...)         -> a signed distance to the pond's edge (negative inside), any shape
#   outline(sdf, box, step)        -> the edge as closed loops (marching squares)
#   rim_slots(loops, sdf, ...)     -> where the broken stones go round it, never overlapping
# Plain Python (no numpy) so its test runs with any python3:  python3 tools/art/diorama/test_sludge_pond.py
import math
import random


def components(squares):
    """Squares (i, j) grouped into 4-connected sets, each sorted; the groups sorted by their first square."""
    left = set(squares)
    out = []
    while left:
        s = min(left)
        left.discard(s)
        comp, todo = [s], [s]
        while todo:
            i, j = todo.pop()
            for n in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if n in left:
                    left.discard(n)
                    comp.append(n)
                    todo.append(n)
        out.append(sorted(comp))
    return sorted(out)


def _box(x, y, x0, y0, x1, y1, r):
    """Signed distance to a box with corners rounded by r (the box itself is x0..x1, y0..y1)."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = max((x1 - x0) / 2 - r, 0.0), max((y1 - y0) / 2 - r, 0.0)
    qx, qy = abs(x - cx) - hx, abs(y - cy) - hy
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def pond_boxes(comp, S, margin, center):
    """The boxes whose union is the pond: each square inset by margin, a bridge between every touching pair (so the
    pond runs straight across the shared edge), and the middle of every full 2x2 block (so a pond has no island)."""
    cs = set(comp)
    hw = S / 2 - margin
    out = []
    for i, j in comp:
        x, y = center(i, j)
        out.append((x - hw, y - hw, x + hw, y + hw))
        if (i + 1, j) in cs:
            x2, _ = center(i + 1, j)
            out.append((x, y - hw, x2, y + hw))
        if (i, j + 1) in cs:
            _, y2 = center(i, j + 1)
            out.append((x - hw, y, x + hw, y2))
        if (i + 1, j) in cs and (i, j + 1) in cs and (i + 1, j + 1) in cs:
            x2, y2 = center(i + 1, j + 1)
            out.append((x, y, x2, y2))
    return out


def inside_corners(comp, S, margin, center):
    """The pond's inside (concave) corners: where three squares of a 2x2 block are pond and the fourth is not. Each is
    (x, y, sx, sy): the corner and the direction toward the missing square."""
    cs = set(comp)
    out = []
    for i, j in comp:
        for di in (-1, 1):
            for dj in (-1, 1):
                if (i + di, j) in cs and (i, j + dj) in cs and (i + di, j + dj) not in cs:
                    x, y = center(i, j)
                    out.append((x + di * (S / 2 - margin), y + dj * (S / 2 - margin), di, dj))
    return out


def pond_sdf(comp, S, margin=0.12, round_=0.12, fillet=0.1, ragged=0.0, noise=None, center=None):
    """Signed distance (negative inside) to the pond over the squares in comp. margin, round_ and fillet are shares of
    a square: the inset on free sides, the outside corners' radius, the inside corners' fillet. noise(x, y) in -1..1
    (world position, so touching squares agree) wobbles the edge by ragged * S. A hard union of boxes (so the edge runs
    dead straight across shared edges) plus a fillet piece in each inside corner."""
    center = center or (lambda i, j: (i * S, j * S))
    boxes = pond_boxes(comp, S, margin * S, center)
    corners = inside_corners(comp, S, margin * S, center)
    r, k = round_ * S, fillet * S

    def f(x, y):
        d = min(_box(x, y, *b, r) for b in boxes)
        for cx, cy, sx, sy in corners:
            # the corner square k wide toward the missing square, less a disc of radius k in its far corner
            # (reaching a little back into the pond so it overlaps the boxes instead of meeting them on a seam)
            bx0, bx1 = sorted((cx - sx * 0.25 * k, cx + sx * k)); by0, by1 = sorted((cy - sy * 0.25 * k, cy + sy * k))
            fp = max(_box(x, y, bx0, by0, bx1, by1, 0.0), k - math.hypot(x - (cx + sx * k), y - (cy + sy * k)))
            d = min(d, fp)
        if ragged and noise:
            d += ragged * S * noise(x, y)
        return d
    f.boxes = boxes
    return f


def outline(sdf, box, step):
    """The zero line of sdf inside box (x0, y0, x1, y1) as closed loops of (x, y), by marching squares. Each loop has
    the inside on its left (counter-clockwise round a pond, clockwise round an island); the biggest loop first."""
    x0, y0, x1, y1 = box
    nx, ny = int(math.ceil((x1 - x0) / step)) + 1, int(math.ceil((y1 - y0) / step)) + 1
    v = [[sdf(x0 + a * step, y0 + b * step) for b in range(ny)] for a in range(nx)]
    pos, adj = {}, {}

    def key(p, q):  # one crossing per grid edge, shared by the two cells on it
        k = (min(p, q), max(p, q))
        if k not in pos:
            va, vb = v[p[0]][p[1]], v[q[0]][q[1]]
            t = va / (va - vb) if va != vb else 0.5
            pos[k] = (x0 + (p[0] + (q[0] - p[0]) * t) * step, y0 + (p[1] + (q[1] - p[1]) * t) * step)
        return k

    def join(k1, k2):
        adj.setdefault(k1, []).append(k2)
        adj.setdefault(k2, []).append(k1)
    for a in range(nx - 1):
        for b in range(ny - 1):
            c = [(a, b), (a + 1, b), (a + 1, b + 1), (a, b + 1)]
            ins = [v[p][q] < 0 for p, q in c]
            if all(ins) or not any(ins):
                continue
            e = [key(c[m], c[(m + 1) % 4]) if ins[m] != ins[(m + 1) % 4] else None for m in range(4)]
            cut = [m for m in range(4) if e[m] is not None]
            if len(cut) == 2:
                join(e[cut[0]], e[cut[1]])
            else:  # saddle: cut off the two corners the cell's middle does not join
                mid_in = sum(v[p][q] for p, q in c) / 4 < 0
                for m in range(4):
                    if ins[m] != mid_in:  # corner m is cut off by edges m-1 and m
                        join(e[(m - 1) % 4], e[m])
    loops, seen = [], set()
    for s0 in adj:
        if s0 in seen:
            continue
        loop, prev, k = [], None, s0
        while k not in seen:
            seen.add(k)
            loop.append(pos[k])
            nb = [n for n in adj[k] if n != prev] or adj[k]
            prev, k = k, nb[0]
        if len(loop) < 3:
            continue
        (ax, ay), (bx, by) = loop[0], loop[1]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1.0
        if sdf((ax + bx) / 2 - dy / n * step * 0.25, (ay + by) / 2 + dx / n * step * 0.25) >= 0:
            loop.reverse()  # the left side was outside
        loops.append(loop)
    return sorted(loops, key=lambda L: -abs(_area(L)))


def _area(loop):
    return 0.5 * sum(loop[q][0] * loop[(q + 1) % len(loop)][1] - loop[(q + 1) % len(loop)][0] * loop[q][1]
                     for q in range(len(loop)))


def grad(sdf, x, y, h=1e-3):
    gx = (sdf(x + h, y) - sdf(x - h, y)) / (2 * h)
    gy = (sdf(x, y + h) - sdf(x, y - h)) / (2 * h)
    n = math.hypot(gx, gy) or 1.0
    return gx / n, gy / n


def rim_slots(loops, sdf, S, rng, spacing=(0.15, 0.2), sizes=(0.2, 0.12), overhang=0.3):
    """Where the rim stones go: walking each loop, a slot every spacing (share of a square), big and small in turn.
    Each slot is (x, y, along, size, out) with along the edge's direction (radians), size its length along the edge,
    (x, y) its centre (pushed out so overhang of its width hangs over the pool) and out the outward normal. A slot that
    would touch an earlier one (2D circles, radius half its size) moves on along the edge or is skipped."""
    slots = []
    for loop in loops:
        n = len(loop)
        seg = [math.dist(loop[q], loop[(q + 1) % n]) for q in range(n)]
        total = sum(seg)
        if total <= 0:
            continue
        s, q, acc, big = rng.uniform(0, spacing[0] * S), 0, 0.0, True
        while s < total:
            while q < n - 1 and acc + seg[q] < s:
                acc += seg[q]
                q += 1
            t = (s - acc) / seg[q] if seg[q] else 0.0
            ax, ay = loop[q]
            bx, by = loop[(q + 1) % n]
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            gx, gy = grad(sdf, x, y)
            size = (sizes[0] if big else sizes[1]) * S * rng.uniform(0.85, 1.15)
            width = size * 0.6
            cx, cy = x + gx * width * (0.5 - overhang), y + gy * width * (0.5 - overhang)
            rad = size / 2
            if all(math.dist((cx, cy), (o[0], o[1])) >= rad + o[3] / 2 for o in slots):
                slots.append((cx, cy, math.atan2(-gx, gy), size, (gx, gy)))
                s += rad + rng.uniform(*spacing) * S * 0.5
                big = not big
            else:
                s += 0.02 * S
        # the loop closes: the last slot may touch the first, already handled by the overlap test
    return slots


def no_overlap(slots):
    """True when no two slots' circles (radius half the size) overlap."""
    for a in range(len(slots)):
        for b in range(a + 1, len(slots)):
            if math.dist(slots[a][:2], slots[b][:2]) < (slots[a][3] + slots[b][3]) / 2 - 1e-9:
                return False
    return True
