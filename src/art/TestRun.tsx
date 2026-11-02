import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import App from "../App";
import type { TestLevel } from "../App";
import "../table.css";

/** The real game, full screen over the studio, playing one level with a set army. It never reads or
 * writes the player's run or meta saves. Stop returns to the editor; Restart deals the level again. */
export default function TestRun({ test, title, onStop }: { test: TestLevel; title: string; onStop: () => void }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(<div className="test-run" role="region" aria-label="Test run">
    <div className="test-run-bar">
      <b>▶ {title}</b>
      <span>{test.army.join(" · ")}</span>
      <button type="button" onClick={() => setRound(r => r + 1)}>↻ Restart</button>
      <button type="button" className="stop" onClick={onStop}>■ Stop</button>
    </div>
    <App key={round} test={test} />
  </div>, document.body);
}
