import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface CommitChartProps {
  dailyCommits: number[];
  period: string;
}

function barColor(count: number, max: number): string {
  if (count === 0) return "#21262D";
  const r = count / max;
  if (r < 0.25) return "#0E4429";
  if (r < 0.5) return "#006D32";
  if (r < 0.75) return "#26A641";
  return "#39D353";
}

export function CommitChart({ dailyCommits, period }: CommitChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const max = Math.max(...dailyCommits, 1);

  const [year, month] = period.split("-");
  const monthName = new Date(
    parseInt(year),
    parseInt(month) - 1,
  ).toLocaleString("en-US", { month: "long" });

  useEffect(() => {
    if (!rootRef.current) return;

    const ctx = gsap.context(() => {
      const bars = rootRef.current!.querySelectorAll<HTMLElement>("[data-bar]");
      // Fast mode: short stagger, power4.out — PRD §4.1
      gsap.fromTo(
        bars,
        { scaleY: 0, transformOrigin: "bottom" },
        { scaleY: 1, duration: 0.45, ease: "power4.out", stagger: 0.012 },
      );
    }, rootRef);

    return () => ctx.revert();
  }, []); // runs once per mount — period change forces remount via key prop in Dashboard

  return (
    <div
      ref={rootRef}
      className="rounded-xl p-5"
      style={{ background: "#161B22", border: "1px solid #21262D" }}
    >
      <div className="flex items-end justify-between mb-5">
        <div>
          <div
            className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
            style={{ color: "#484F58", letterSpacing: "0.08em" }}
          >
            Daily Commits
          </div>
          <div className="font-mono text-[13px]" style={{ color: "#8B949E" }}>
            {monthName} {year}
          </div>
        </div>
        <div className="font-mono text-[11px]" style={{ color: "#484F58" }}>
          peak: {max}
        </div>
      </div>

      <div
        className="flex items-end gap-[3px]"
        style={{ height: 80 }}
        role="img"
        aria-label={`Daily commit frequency for ${monthName} ${year}`}
      >
        {dailyCommits.map((count, i) => {
          const heightPct = count === 0 ? 4 : Math.max(8, (count / max) * 100);
          return (
            <div
              key={i}
              data-bar
              className="flex-1 rounded-[2px] min-w-[6px]"
              style={{
                height: `${heightPct}%`,
                background: barColor(count, max),
                transformOrigin: "bottom",
              }}
              title={`Day ${i + 1}: ${count} commit${count !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-2">
        {[1, 8, 15, 22, dailyCommits.length].map((day) => (
          <span
            key={day}
            className="font-mono text-[9px]"
            style={{ color: "#484F58" }}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}
