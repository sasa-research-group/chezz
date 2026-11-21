# A 4x4 world matrix as guard_pose.py's release-pose knobs (hx, hy, hz, hqw..hqz), without Blender's mathutils.
import math


def held_knobs(m):
    """m: rows of a rigid 4x4 (rotation and translation, any uniform scale is dropped)"""
    r = [[m[i][j] for j in range(3)] for i in range(3)]
    s = (sum(r[i][0] ** 2 for i in range(3))) ** 0.5
    r = [[v / s for v in row] for row in r]
    t = r[0][0] + r[1][1] + r[2][2]
    if t > 0:
        k = 0.5 / math.sqrt(t + 1)
        q = (0.25 / k, (r[2][1] - r[1][2]) * k, (r[0][2] - r[2][0]) * k, (r[1][0] - r[0][1]) * k)
    else:
        i = max(range(3), key=lambda i: r[i][i])
        j, k_ = (i + 1) % 3, (i + 2) % 3
        sq = math.sqrt(1 + r[i][i] - r[j][j] - r[k_][k_]) * 2
        q = [0, 0, 0, 0]
        q[0] = (r[k_][j] - r[j][k_]) / sq
        q[1 + i] = 0.25 * sq
        q[1 + j] = (r[j][i] + r[i][j]) / sq
        q[1 + k_] = (r[k_][i] + r[i][k_]) / sq
    return dict(hx=m[0][3], hy=m[1][3], hz=m[2][3], hqw=q[0], hqx=q[1], hqy=q[2], hqz=q[3])
