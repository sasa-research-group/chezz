/** One energy lantern on the table. Code-drawn stand-in: the art pipeline will replace the drawing, not the props. */
export function Lantern({ lit }: { lit: boolean }) {
  return <svg className={`lantern ${lit ? "lit" : "out"}`} viewBox="0 0 40 62" aria-hidden="true">
    <path d="M14 8V5a6 6 0 0 1 12 0v3" fill="none" stroke="#2b201b" strokeWidth="3" />
    <rect x="11" y="6" width="18" height="6" rx="2" fill="#2b201b" />
    <rect className="lantern-glass" x="6" y="11" width="28" height="40" rx="9" stroke="#2b201b" strokeWidth="3" />
    <path className="lantern-flame" d="M20 20c6 8 8 13 8 17a8 8 0 0 1-16 0c0-4 2-9 8-17z" />
    <rect x="4" y="50" width="32" height="9" rx="3" fill="#2b201b" />
  </svg>;
}

/** The row of energy lanterns: one per point, lit while unspent. */
export function Lanterns({ lit, total }: { lit: number; total: number }) {
  return <div className="lanterns" role="img" aria-label={`Energy ${lit} / ${total}`}>
    {Array.from({ length: total }, (_, i) => <Lantern key={i} lit={i < lit} />)}
  </div>;
}
