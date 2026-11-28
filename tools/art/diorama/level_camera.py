# The camera a level's set is baked from, shared by bake_set.py and every square's sprite bake
# (build_trapdoor_cycles.py), so a trapdoor drawn on its own lines up with the set it is pasted into.
import math, os
import bpy
from mathutils import Vector
import stage

# Locked play camera (base_r78): 35 deg down, 50 mm, framed for a 5x5 box. Bigger sets widen the view in
# step with the box's outer width so the box fills the frame the same way.
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0


def set_camera(sc, H, nx, ny, zoom_k=1.0):
    """The camera the set is baked from. Returns (camera, zoom).
    Squares: the locked play camera (35 deg down, 50 mm, box ~90% of the frame; bigger sets widen the view in
    step with the box's outer width). Rectangles, for now: the same elevation and lens, centred on the box and
    backed off until the whole box (frame and base included) fits. Real panning play cameras replace this later."""
    if nx == ny:
        zoom = ZOOM5 * (5 + 1.24) / (nx + 1.24) * zoom_k
        return stage.build_camera(sc, H, aspect=ASPECT, zoom=zoom, elevation=EL, look_ahead=LA, focal=FOCAL), zoom
    from bpy_extras.object_utils import world_to_camera_view
    S_ = 1.2 * H
    Hw = float(os.environ.get("WALL_H", 3.0)) * H
    ox = nx * S_ / 2 + 0.28 * S_ + 0.12 * H + 0.24 * S_ + 0.3 * S_  # outer edge of the frame base
    oy = ny * S_ / 2 + 0.28 * S_ + 0.12 * H + 0.24 * S_ + 0.3 * S_
    corners = [Vector((sx * ox, sy * oy, z)) for sx in (-1, 1) for sy in (-1, 1)
               for z in (-0.12 * H - 0.24 * H, Hw + 0.22 * H)]
    fill = 0.92  # the box's larger extent, as a fraction of the frame
    sc.render.resolution_x, sc.render.resolution_y = 1200, int(round(1200 / ASPECT))  # the frame shape (setup_render sets the size)
    zoom, cy = ZOOM5 * (5 + 1.24) / (max(nx, ny) + 1.24) * zoom_k, 0.0
    for _ in range(12):
        cam = stage.build_camera(sc, H, center=(0.0, cy), aspect=ASPECT, zoom=zoom, elevation=EL, look_ahead=LA, focal=FOCAL)
        bpy.context.view_layer.update()
        uv = [world_to_camera_view(sc, cam, p) for p in corners]
        us, vs = [p.x for p in uv], [p.y for p in uv]
        ext = max(max(us) - min(us), max(vs) - min(vs))
        vmid = (max(vs) + min(vs)) / 2
        vis_h = 2.7 * S_ / zoom / ASPECT  # visible height (scene units) across the view at the target
        cy += (vmid - 0.5) * vis_h / math.sin(math.radians(EL))
        zoom *= fill / ext
    cam = stage.build_camera(sc, H, center=(0.0, cy), aspect=ASPECT, zoom=zoom, elevation=EL, look_ahead=LA, focal=FOCAL)
    print("CAMERA fit nx=%d ny=%d zoom=%.3f centre_y=%.2fS" % (nx, ny, zoom, cy / S_), flush=True)
    return cam, zoom


def stop_camera(sc, H, nx, ny, stop=None, zoom_k=1.0):
    """The camera for one panning stop of an nx x ny board (level_layout.stops): the camera a set the size of
    the window would be baked from, slid (never turned) so the window centres on `stop` (squares, stage axes).
    stop None: the whole board in one view (set_camera). Every stop shares one zoom and one rotation, so the game
    pans between them by moving the camera alone."""
    if stop is None:
        return set_camera(sc, H, nx, ny, zoom_k)
    from level_layout import window
    mx, my = window(nx, ny)
    cam, zoom = set_camera(sc, H, mx, my, zoom_k)
    S_ = 1.2 * H
    cam.location.x += stop[0] * S_
    cam.location.y += stop[1] * S_
    bpy.context.view_layer.update()
    print("CAMERA stop %.2f,%.2f window %dx%d" % (stop[0], stop[1], mx, my), flush=True)
    return cam, zoom
