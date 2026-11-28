# Lamp colours for the live sludge's export (live_plate.py lights()), kept free of bpy so they can be tested.

# Blender 5.3's Blackbody colour (linear Rec.709), measured by rendering the node every 500 K (Cycles, Standard view).
# Not scaled to luminance 1: Blender's isn't either. This is what a glowing material with a Blackbody node gives.
BLACKBODY = (
    (1000, (2.787, 0.1095, 0.042)),
    (1500, (2.2373, 0.5246, 0.0445)),
    (2000, (1.8629, 0.6757, 0.1285)),
    (2500, (1.762, 0.8581, 0.3024)),
    (3000, (1.6776, 0.9697, 0.4964)),
    (3500, (1.5857, 1.0296, 0.6528)),
    (4000, (1.5406, 1.0607, 0.7859)),
    (4500, (1.5326, 1.1088, 0.9208)),
    (5000, (1.5583, 1.1802, 1.0787)),
    (5500, (1.5825, 1.2398, 1.2358)),
    (6000, (1.582, 1.2794, 1.374)),
    (6500, (1.5515, 1.294, 1.4744)),
    (7000, (1.5205, 1.3009, 1.5463)),
    (7500, (1.4895, 1.3078, 1.6094)),
    (8000, (1.4639, 1.3128, 1.671)),
    (8500, (1.4406, 1.3169, 1.7232)),
    (9000, (1.4165, 1.3178, 1.767)),
    (9500, (1.3942, 1.3178, 1.8058)),
    (10000, (1.3733, 1.3193, 1.8395)),
    (10500, (1.3543, 1.3197, 1.8698)),
    (11000, (1.3407, 1.3234, 1.9032)),
    (11500, (1.3313, 1.3293, 1.9366)),
    (12000, (1.3213, 1.3343, 1.9656)),
)


# A lamp's own Kelvin colour ("use_temperature") is a different curve: about white at 6500 K, and 2850 K is
# (1.34, 0.81, 0.37), not the node's (1.70, 0.94, 0.44). Measured as a white plane lit by a sun at each temperature,
# divided by the same sun with no temperature.
LAMP_KELVIN = (
    (1000, (2.8663, 0.1874, 0.0628)),
    (1500, (2.0219, 0.5929, 0.0468)),
    (2000, (1.5544, 0.6948, 0.1049)),
    (2500, (1.3862, 0.7551, 0.2561)),
    (3000, (1.3175, 0.8242, 0.4103)),
    (3500, (1.2655, 0.8797, 0.5429)),
    (4000, (1.2072, 0.9097, 0.654)),
    (4500, (1.1534, 0.9281, 0.7439)),
    (5000, (1.1129, 0.9489, 0.8246)),
    (5500, (1.0828, 0.9684, 0.9014)),
    (6000, (1.0579, 0.9844, 0.9689)),
    (6500, (1.036, 0.9972, 1.0289)),
    (7000, (1.0182, 1.0072, 1.0815)),
    (7500, (1.003, 1.0156, 1.1286)),
    (8000, (0.9896, 1.0228, 1.1706)),
    (8500, (0.9781, 1.0284, 1.2083)),
    (9000, (0.9681, 1.0336, 1.2426)),
    (9500, (0.9599, 1.0384, 1.2744)),
    (10000, (0.9543, 1.0439, 1.3054)),
    (10500, (0.9488, 1.0487, 1.3339)),
    (11000, (0.9436, 1.0519, 1.3599)),
    (11500, (0.938, 1.0535, 1.3822)),
    (12000, (0.932, 1.0547, 1.4023)),
)


def _between(table, kelvin):
    k = min(max(kelvin, table[0][0]), table[-1][0])
    for (k0, c0), (k1, c1) in zip(table, table[1:]):
        if k <= k1:
            f = (k - k0) / (k1 - k0)
            return [a + f * (b - a) for a, b in zip(c0, c1)]
    return list(table[-1][1])


def blackbody(kelvin):
    """Blender's Blackbody node colour at a temperature (linear), between the measured rows."""
    return _between(BLACKBODY, kelvin)


def lamp_kelvin(kelvin):
    """The colour a Blender lamp's temperature multiplies its colour by (linear), between the measured rows."""
    return _between(LAMP_KELVIN, kelvin)


def mix(a, b, f):
    """A Mix colour node in Mix mode: f of the way from a to b."""
    return [x + f * (y - x) for x, y in zip(a, b)]
