# The props' shared materials (gate, lever, ...), for Cycles: hand-forged iron and the photo oak, moved here from
# build_gate_cycles.py (2026-11-26) so every square prop wears the same metal and wood. Node graphs unchanged: the
# gate's renders come out the same. Needs bpy and the stage module (stage._wood_mat for the vine oak).
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OAK_PNG = os.path.join(HERE, "tex", "gate_oak.png")


def iron_mat(u, name="gate_iron", rust_at=(0.48, 0.66), rust_col=(0.07, 0.03, 0.015), base_col=(0.075, 0.072, 0.07),
             rough=0.78, rust="light", worn="edges", disp=0.06, amount=1.0):
    """Hand-forged iron as the trapdoor's: dark, hammer-dented, rust blooming in patches, worn bright on the edges.
    u: the dent size (set units). rust_at: where the rust noise turns to rust (lower: more rust); rough: the bare
    iron's roughness (rust is 0.15 rougher). rust="damp": the lever's old dungeon iron (damp_iron; rust_at, worn
    and rough are used, the colours are its own; amount<1 dials the rust back, see damp_iron). The default "light" is the gate's, baked: leave it as it is."""
    if rust == "damp":
        return damp_iron(u, name, rust_at=rust_at, rough=rough, worn=worn, disp=disp, amount=amount)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; L_ = nt.links.new
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 9 / u
    L_(tc.outputs["Object"], vor.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = u * 0.02
    L_(vor.outputs["Distance"], bump.inputs["Height"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2 / u; nz.inputs["Detail"].default_value = 6
    L_(tc.outputs["Object"], nz.inputs["Vector"])
    rust = nt.nodes.new("ShaderNodeValToRGB")
    rust.color_ramp.elements[0].position = rust_at[0]; rust.color_ramp.elements[1].position = rust_at[1]
    L_(nz.outputs["Fac"], rust.inputs["Fac"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wear = nt.nodes.new("ShaderNodeValToRGB")
    wear.color_ramp.elements[0].position = 0.97; wear.color_ramp.elements[1].position = 0.995  # flat-shaded straps: high pointiness everywhere
    L_(geo.outputs["Pointiness"], wear.inputs["Fac"])
    mix1 = nt.nodes.new("ShaderNodeMix"); mix1.data_type = "RGBA"
    mix1.inputs[6].default_value = base_col + (1,); mix1.inputs[7].default_value = rust_col + (1,)
    L_(rust.outputs["Color"], mix1.inputs["Factor"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    L_(mix1.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.2, 0.17, 0.14, 1)
    L_(wear.outputs["Color"], mix2.inputs["Factor"])
    L_(mix2.outputs[2], b.inputs["Base Color"])
    met = nt.nodes.new("ShaderNodeMath"); met.operation = "MULTIPLY_ADD"
    met.inputs[1].default_value = -0.5; met.inputs[2].default_value = 0.6
    L_(rust.outputs["Color"], met.inputs[0]); L_(met.outputs[0], b.inputs["Metallic"])
    rgh = nt.nodes.new("ShaderNodeMath"); rgh.operation = "MULTIPLY_ADD"
    rgh.inputs[1].default_value = 0.15; rgh.inputs[2].default_value = rough
    L_(rust.outputs["Color"], rgh.inputs[0]); L_(rgh.outputs[0], b.inputs["Roughness"])
    L_(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def damp_iron(u, name, rust_at=(0.4, 0.55), rough=0.7, worn="top", disp=0.06, amount=1.0):
    """Old wrought iron that has sat for years in a damp dungeon, as a painted miniature: a dark brown-black base;
    rust in blotchy patches (rust_at: where the patch noise turns to rust, lower: more), deep brown with orange-brown
    blooms; the rust a raised, flaky crust (bump) with paler edges; small pits in the bare iron; bare metal only
    where worn: worn="top" on the upward faces (a knob under the hand), "edges" in fine flecks (chain links rubbing).
    Rust 0.95 rough and never metallic; bare iron `rough`, a little metallic (it glints); worn spots more so. The
    crust and pits are also true displacement, disp of u (the mesh must be dense; thin wire wants less). u: the
    feature size (set units). amount (0..1, default 1: the chain's look, unchanged): less rust, for a knob a hand
    still grips: the rust patches shrink (rust_at moves up), fewer orange blooms, and a wider hand-polished top."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; L_ = nt.links.new
    N = nt.nodes.new

    def math_(op, a_, b_=None, c_=None):
        n_ = N("ShaderNodeMath"); n_.operation = op
        for k, v in enumerate((a_, b_, c_)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n_.inputs[k].default_value = v
            else:
                L_(v, n_.inputs[k])
        return n_.outputs[0]

    def ramp(src, lo, hi):
        r_ = N("ShaderNodeMapRange"); r_.clamp = True
        L_(src, r_.inputs["Value"]); r_.inputs["From Min"].default_value = lo; r_.inputs["From Max"].default_value = hi
        return r_.outputs[0]

    def noise(scale, detail=6, rough_=0.6, dist=0.0, w=None):
        n_ = N("ShaderNodeTexNoise"); n_.inputs["Scale"].default_value = scale; n_.inputs["Detail"].default_value = detail
        n_.inputs["Roughness"].default_value = rough_; n_.inputs["Distortion"].default_value = dist
        L_(tc.outputs["Object"], n_.inputs["Vector"])
        return n_.outputs["Fac"]

    def mix(fac, c0, c1):
        n_ = N("ShaderNodeMix"); n_.data_type = "RGBA"
        L_(fac, n_.inputs["Factor"])
        for sock, c in ((n_.inputs[6], c0), (n_.inputs[7], c1)):
            if isinstance(c, tuple):
                sock.default_value = c + (1,)
            else:
                L_(c, sock)
        return n_.outputs[2]

    tc = N("ShaderNodeTexCoord")
    import lever_geom
    less = 1.0 - amount
    rust_at = lever_geom.rust_band(rust_at, amount)
    patch = ramp(noise(1.6 / u, 8, 0.62, 0.35), rust_at[0], rust_at[1])         # where the rust has taken
    flake = noise(45 / u, 4, 0.7)                                               # the crust's flaky lumps: tight, miniature-scale
    crust = math_("MULTIPLY", patch, ramp(flake, 0.42, 0.55))  # hard-edged flakes, not a soft blur
    bloom = ramp(noise(9 / u, 4, 0.55, 0.6), 0.48 + 0.15 * less, 0.6 + 0.15 * less)                       # orange-brown blooms in the brown
    vor = N("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 70 / u
    L_(tc.outputs["Object"], vor.inputs["Vector"])
    pit = math_("MULTIPLY", ramp(vor.outputs["Distance"], 0.16, 0.06), ramp(vor.outputs["Color"], 0.55, 0.62))
    pit = math_("MULTIPLY", pit, math_("MULTIPLY_ADD", patch, -0.4, 1.0))     # pits, mostly in the bare iron
    if worn == "top":
        nz = N("ShaderNodeSeparateXYZ"); L_(tc.outputs["Normal"], nz.inputs[0])
        wear = ramp(nz.outputs["Z"], 0.85 - 0.25 * less, 0.97 - 0.1 * less)
    else:
        wear = ramp(noise(9 / u, 2, 0.5), 0.68, 0.78)
    wear = math_("MULTIPLY", wear, math_("SUBTRACT", 1.0, ramp(patch, 0.0, 0.3)))

    col = mix(ramp(noise(12 / u, 3, 0.5), 0.3, 0.7), (0.016, 0.014, 0.013), (0.03, 0.022, 0.016))  # the bare iron (charcoal), never one flat black
    rustc = mix(bloom, (0.075, 0.022, 0.008), (0.17, 0.075, 0.022))  # deep red-brown, ochre blooms
    rustc = mix(ramp(flake, 0.58, 0.7), rustc, (0.3, 0.14, 0.035))             # the crust's raised flakes catch the light
    col = mix(patch, col, rustc)
    col = mix(pit, col, (0.008, 0.006, 0.005))
    col = mix(wear, col, (0.16, 0.15, 0.14))
    L_(col, b.inputs["Base Color"])
    bare = math_("SUBTRACT", 1.0, patch)
    L_(math_("MULTIPLY_ADD", wear, 0.3, math_("MULTIPLY", bare, 0.65)), b.inputs["Metallic"])  # bare iron is metal: dielectric dark iron read pale grey under the set lights; rust never
    rg = math_("MULTIPLY_ADD", patch, 0.95 - rough, rough)
    L_(math_("MULTIPLY_ADD", wear, -0.35, rg), b.inputs["Roughness"])
    hgt = math_("MULTIPLY_ADD", crust, 0.8, math_("MULTIPLY", patch, 0.5))
    hgt = math_("MULTIPLY_ADD", pit, -0.9, hgt)
    grain = math_("MULTIPLY", noise(150 / u, 2, 0.5), math_("MULTIPLY", bare, 0.06))  # faint forged grain on the bare iron (0.15 read sandblasted)
    bump = N("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.8; bump.inputs["Distance"].default_value = u * 0.05
    L_(math_("ADD", hgt, grain), bump.inputs["Height"]); L_(bump.outputs["Normal"], b.inputs["Normal"])
    # the crust and the pits as real relief too (bump alone read as a flat print): true displacement on the mesh
    m.displacement_method = "BOTH"
    dsp = N("ShaderNodeDisplacement"); dsp.inputs["Midlevel"].default_value = 0.3; dsp.inputs["Scale"].default_value = u * disp
    L_(hgt, dsp.inputs["Height"]); L_(dsp.outputs[0], nt.nodes["Material Output"].inputs["Displacement"])
    return m


def oak(stage, name, val, wood="1.85,2.9,5.6", wood_sat=0.7):
    """The set's oak, lifted to the trapdoor door's weathered grey-brown; val darkens it (the gate's vines)."""
    os.environ["WOOD_TINT"] = wood
    m = stage._wood_mat(); m.name = name
    bsdf = m.node_tree.nodes["Principled BSDF"]
    lk = bsdf.inputs["Base Color"].links[0]
    hs = m.node_tree.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Saturation"].default_value = wood_sat; hs.inputs["Value"].default_value = 1.15 * val
    m.node_tree.links.new(lk.from_socket, hs.inputs["Color"]); m.node_tree.links.new(hs.outputs["Color"], bsdf.inputs["Base Color"])
    for n_ in m.node_tree.nodes:  # deeper, rougher grain than the set's polished frame
        if n_.type == "BUMP":
            n_.inputs["Strength"].default_value = 1.0
    return m


def photo_oak(name, S, wood_sat=0.7, oak_val=0.42, foot=True):
    """The photo oak: a photo of weathered oak (tex/gate_oak.png, made with Gemini 2026-11-26: grain, knots, checks)
    on the mesh's "UVMap" (grain up the image), each piece's tone from its "tone" UV layer (u brightness, v hue), its
    light and dark also the relief. foot: weathered grey near the object's z = 0 (rain splash on the gate's doors).
    Hand-built grain (the set's _wood_mat, wave bands, a scan zoomed in) read as cardboard."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; L_ = nt.links.new
    uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UVMap"
    tone = nt.nodes.new("ShaderNodeUVMap"); tone.uv_map = "tone"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L_(tone.outputs["UV"], sep.inputs[0])
    dif = nt.nodes.new("ShaderNodeTexImage"); dif.extension = "REPEAT"
    dif.image = bpy.data.images.load(OAK_PNG, check_existing=True)
    L_(uvn.outputs["UV"], dif.inputs["Vector"])
    hs = nt.nodes.new("ShaderNodeHueSaturation"); L_(dif.outputs["Color"], hs.inputs["Color"])
    hs.inputs["Saturation"].default_value = wood_sat
    val = nt.nodes.new("ShaderNodeMath"); val.operation = "MULTIPLY_ADD"  # each plank a little lighter or darker
    val.inputs[1].default_value = 0.35 * oak_val; val.inputs[2].default_value = 0.8 * oak_val
    L_(sep.outputs["X"], val.inputs[0]); L_(val.outputs[0], hs.inputs["Value"])
    hue = nt.nodes.new("ShaderNodeMath"); hue.operation = "MULTIPLY_ADD"
    hue.inputs[1].default_value = 0.03; hue.inputs[2].default_value = 0.485
    L_(sep.outputs["Y"], hue.inputs[0]); L_(hue.outputs[0], hs.inputs["Hue"])
    if foot:
        # the foot: weathered grey where rain splashes (object z is height above the sill on each leaf)
        tc = nt.nodes.new("ShaderNodeTexCoord"); sz = nt.nodes.new("ShaderNodeSeparateXYZ"); L_(tc.outputs["Object"], sz.inputs[0])
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 14 / S; L_(tc.outputs["Object"], nz.inputs["Vector"])
        hgt = nt.nodes.new("ShaderNodeMath"); hgt.operation = "MULTIPLY_ADD"
        hgt.inputs[1].default_value = 0.12 * S; L_(nz.outputs["Fac"], hgt.inputs[0]); L_(sz.outputs["Z"], hgt.inputs[2])
        ft = nt.nodes.new("ShaderNodeMapRange"); L_(hgt.outputs[0], ft.inputs["Value"])
        ft.inputs["From Min"].default_value = 0.06 * S; ft.inputs["From Max"].default_value = 0.2 * S
        ft.inputs["To Min"].default_value = 0.5; ft.inputs["To Max"].default_value = 0.0
        grey = nt.nodes.new("ShaderNodeMix"); grey.data_type = "RGBA"
        L_(ft.outputs[0], grey.inputs["Factor"]); L_(hs.outputs["Color"], grey.inputs[6]); grey.inputs[7].default_value = (0.11, 0.1, 0.085, 1)
        L_(grey.outputs[2], b.inputs["Base Color"])
    else:
        L_(hs.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.82
    bw = nt.nodes.new("ShaderNodeRGBToBW"); L_(dif.outputs["Color"], bw.inputs["Color"])  # dark grain and checks sit low
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 1.0; bump.inputs["Distance"].default_value = 0.012 * S  # deep, carved miniature grain
    L_(bw.outputs[0], bump.inputs["Height"]); L_(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def set_moss(sc, stage):
    """The set's moss material (the floor's "Moss" object wears it), or a fresh stage moss when the set has none."""
    mo = sc.objects.get("Moss")
    return mo.active_material if mo is not None else stage._moss_mat()
