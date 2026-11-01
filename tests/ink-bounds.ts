/** The ink extent of a rendered rig, read from its static SVG markup: every visible shape's
 * geometry, transformed by its groups' `transform` attributes and grown by half its stroke.
 * Curves are sampled, so the result is exact to a few hundredths of a unit. */

type Matrix = [number, number, number, number, number, number];
type Box = { top: number; bottom: number; left: number; right: number };
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const mul = ([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix =>
  [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
const apply = ([a, b, c, d, e, f]: Matrix, x: number, y: number) => [a * x + c * y + e, b * x + d * y + f] as const;

function parseTransform(t: string): Matrix {
  let m = IDENTITY;
  for (const [, fn, raw] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = raw.trim().split(/[\s,]+/).map(Number);
    if (fn === "translate") m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0]);
    else if (fn === "scale") m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0]);
    else if (fn === "matrix") m = mul(m, n as Matrix);
    else if (fn === "rotate") {
      const r = (n[0] * Math.PI) / 180, [cx, cy] = [n[1] ?? 0, n[2] ?? 0], cos = Math.cos(r), sin = Math.sin(r);
      m = mul(mul(mul(m, [1, 0, 0, 1, cx, cy]), [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else throw new Error(`unsupported transform ${fn}`);
  }
  return m;
}

const STEPS = 32;
/** Points along a path, curves sampled. */
function pathPoints(d: string): [number, number][] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  const num = () => Number(tokens[i++]);
  const bez = (ps: number[][]) => {
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      let row = ps;
      while (row.length > 1) row = row.slice(1).map((p, k) => [row[k][0] + (p[0] - row[k][0]) * t, row[k][1] + (p[1] - row[k][1]) * t]);
      pts.push([row[0][0], row[0][1]]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": x = ox + num(); y = oy + num(); sx = x; sy = y; pts.push([x, y]); cmd = rel ? "l" : "L"; cx = x; cy = y; break;
      case "L": x = ox + num(); y = oy + num(); pts.push([x, y]); cx = x; cy = y; break;
      case "H": x = ox + num(); pts.push([x, y]); cx = x; cy = y; break;
      case "V": y = oy + num(); pts.push([x, y]); cx = x; cy = y; break;
      case "Z": x = sx; y = sy; cx = x; cy = y; break;
      case "Q": case "T": {
        const [qx, qy] = cmd.toUpperCase() === "Q" ? [ox + num(), oy + num()] : [2 * x - cx, 2 * y - cy];
        const ex = ox + num(), ey = oy + num();
        bez([[x, y], [qx, qy], [ex, ey]]); cx = qx; cy = qy; x = ex; y = ey; break;
      }
      case "C": case "S": {
        const [ax, ay] = cmd.toUpperCase() === "C" ? [ox + num(), oy + num()] : [2 * x - cx, 2 * y - cy];
        const bx = ox + num(), by = oy + num(), ex = ox + num(), ey = oy + num();
        bez([[x, y], [ax, ay], [bx, by], [ex, ey]]); cx = bx; cy = by; x = ex; y = ey; break;
      }
      case "A": {
        let rx = Math.abs(num()), ry = Math.abs(num());
        const phi = (num() * Math.PI) / 180, large = num(), sweep = num(), ex = ox + num(), ey = oy + num();
        const cos = Math.cos(phi), sin = Math.sin(phi), dx = (x - ex) / 2, dy = (y - ey) / 2;
        const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
        const grow = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2;
        if (grow > 1) { rx *= Math.sqrt(grow); ry *= Math.sqrt(grow); }
        const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2) / (rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2)));
        const ccx = (k * rx * y1) / ry, ccy = (-k * ry * x1) / rx;
        const mx = cos * ccx - sin * ccy + (x + ex) / 2, my = sin * ccx + cos * ccy + (y + ey) / 2;
        const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
        const a0 = angle((x1 - ccx) / rx, (y1 - ccy) / ry);
        let da = angle((-x1 - ccx) / rx, (-y1 - ccy) / ry) - a0;
        if (sweep && da < 0) da += 2 * Math.PI;
        if (!sweep && da > 0) da -= 2 * Math.PI;
        for (let s = 1; s <= STEPS * 2; s++) {
          const a = a0 + (da * s) / (STEPS * 2);
          pts.push([mx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, my + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos]);
        }
        x = ex; y = ey; cx = x; cy = y; break;
      }
      default: throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return pts;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const SHAPES = new Set(["path", "circle", "ellipse", "rect", "line", "polygon", "polyline"]);

function shapePoints(name: string, tag: string): [number, number][] {
  const n = (a: string) => Number(attr(tag, a) ?? 0);
  if (name === "path") return pathPoints(attr(tag, "d") ?? "");
  if (name === "circle" || name === "ellipse") {
    const rx = name === "circle" ? n("r") : n("rx"), ry = name === "circle" ? n("r") : n("ry");
    return Array.from({ length: STEPS * 4 }, (_, k) => [n("cx") + rx * Math.cos((k / (STEPS * 4)) * 2 * Math.PI), n("cy") + ry * Math.sin((k / (STEPS * 4)) * 2 * Math.PI)]);
  }
  if (name === "rect") return [[n("x"), n("y")], [n("x") + n("width"), n("y") + n("height")]];
  if (name === "line") return [[n("x1"), n("y1")], [n("x2"), n("y2")]];
  return pathPoints(`M${attr(tag, "points")}`);
}

/** `skip` drops any element whose class list holds one of these classes, with its children. */
export function inkBox(markup: string, { within, skip }: { within: string; skip: string[] }): Box {
  const box: Box = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  type Frame = { name: string; m: Matrix; stroke?: string; width?: number; fill?: string; on: boolean; off: boolean };
  const stack: Frame[] = [{ name: "root", m: IDENTITY, on: false, off: false }];
  for (const [tag, close, name, , self] of markup.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    if (close) { stack.pop(); continue; }
    const top = stack[stack.length - 1], classes = (attr(tag, "class") ?? "").split(/\s+/);
    const t = attr(tag, "transform"), sw = attr(tag, "stroke-width");
    const frame: Frame = {
      name, m: t ? mul(top.m, parseTransform(t)) : top.m,
      stroke: attr(tag, "stroke") ?? top.stroke, width: sw !== undefined ? Number(sw) : top.width, fill: attr(tag, "fill") ?? top.fill,
      on: top.on || classes.includes(within),
      // Clips, defs, filters and parts drawn inside a clip never reach past the part they are clipped to.
      off: top.off || classes.some(c => skip.includes(c)) || ["clipPath", "defs", "filter", "mask"].includes(name) || attr(tag, "clip-path") !== undefined,
    };
    if (frame.on && !frame.off && SHAPES.has(name)) {
      const stroked = frame.stroke && frame.stroke !== "none";
      if (stroked || frame.fill !== "none") {
        const half = stroked ? ((frame.width ?? 1) / 2) * Math.sqrt(Math.abs(frame.m[0] * frame.m[3] - frame.m[1] * frame.m[2])) : 0;
        for (const [px, py] of shapePoints(name, tag)) {
          const [sx, sy] = apply(frame.m, px, py);
          box.top = Math.min(box.top, sy - half); box.bottom = Math.max(box.bottom, sy + half);
          box.left = Math.min(box.left, sx - half); box.right = Math.max(box.right, sx + half);
        }
      }
    }
    if (!self) stack.push(frame);
  }
  return box;
}
