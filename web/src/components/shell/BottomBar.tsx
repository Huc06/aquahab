"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { startAmbient } from "@/lib/ambient";
import { useHQ } from "@/lib/store";
import { useApi } from "@/lib/useApi";

// Operator status line (DESIGN.md §6.12) and the background music toggle.
export function BottomBar() {
  const musicOn = useHQ((s) => s.musicOn);
  const setMusicOn = useHQ((s) => s.setMusicOn);

  // Ambience plays only while the toggle is on. Turning it off, or leaving the page, stops it.
  useEffect(() => {
    if (!musicOn) return;
    const ambient = startAmbient();
    if (!ambient) {
      setMusicOn(false);
      return;
    }
    return () => ambient.stop();
  }, [musicOn, setMusicOn]);

  // Status from the crew server: relayer writes, Tatum reads, and the write queue. Refreshed every 15 s.
  const health = useApi(() => api.health(), []);
  const reload = health.reload;
  useEffect(() => {
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [reload]);
  const h = health.data;
  const walrus = !h ? "unknown" : h.relayer.writes;

  return (
    <footer className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20 flex h-10 items-center gap-4 border-t border-line-decor bg-surface/95 px-4 font-mono text-[13px] text-fg-2">
      <span>
        Walrus{" "}
        <span className={walrus === "ok" ? "text-ok" : "text-warn"}>
          ● {walrus === "ok" ? "writes ok" : walrus}
        </span>
      </span>
      <span>Tatum {h?.tatum.ok ? <span className="text-ok">● epoch {h.tatum.epoch}</span> : <span className="text-warn">● off</span>}</span>
      <span>Queue {h ? `${h.queue.queued} queued · ${h.queue.pending} pending` : "—"}</span>
      <span>{h?.mode === "mock" ? <span className="text-warn">MOCK: not on Walrus</span> : "Mainnet"}</span>
      <button
        type="button"
        aria-pressed={musicOn}
        title={musicOn ? "Turn music off" : "Turn music on"}
        onClick={() => setMusicOn(!musicOn)}
        className="ml-auto rounded-sm border border-line px-2 py-0.5 font-sans text-xs text-fg-2 enabled:hover:border-mem focus-visible:outline-focus"
      >
        {musicOn ? "Music on" : "Music off"}
      </button>
    </footer>
  );
}
