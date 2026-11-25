// Frame-time summary for the phone bench: frames a second, the median frame and the slowest 5%.
export function frameStats(gaps: number[]) {
  const s = [...gaps].sort((a, b) => a - b);
  if (!s.length) return { frames: 0, fps: 0, median: 0, p95: 0 };
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const total = s.reduce((a, b) => a + b, 0);
  return { frames: s.length, fps: (1000 * s.length) / total, median: at(0.5), p95: at(0.95) };
}
