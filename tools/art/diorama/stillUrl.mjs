// A loop capture must hold the page's own clock still: without ?still the page draws at wall-clock time between
// renderAt(t) calls, and the saved frames come out at random moments (FIGURES.md, live sludge round 6).
export function stillUrl(url) {
  const u = new URL(url);
  if (!u.searchParams.has("still")) u.searchParams.set("still", "");
  return u.toString();
}
