import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Trophy, Flame, Check } from "lucide-react";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (videoRef.current) {
        const scrollY = window.scrollY;
        // Assume 300vh scroll space as per prompt (3 * window.innerHeight)
        const maxScroll = window.innerHeight * 2; // actual scrollable distance for the 300vh container
        if (maxScroll > 0) {
          const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
          // Only update if video has duration and is loaded
          if (videoRef.current.duration) {
            videoRef.current.currentTime = progress * videoRef.current.duration;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen text-[var(--ink)] font-['Inter_Variable',sans-serif]"
      style={{ backgroundColor: "var(--canvas)" }}
    >
      {/* 1. Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8"
        style={{
          height: "56px",
          backgroundColor: "var(--canvas)",
          borderBottom: "1px solid var(--hairline-soft)",
        }}
      >
        <div className="font-bold text-[18px] tracking-tight">GitReport</div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-[15px] py-[10px] rounded-[100px] text-[14px] font-medium leading-[1]"
              style={{ backgroundColor: "var(--ink)", color: "var(--canvas)" }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-[15px] py-[10px] rounded-[100px] text-[14px] font-medium leading-[1] transition-colors"
                style={{
                  backgroundColor: "var(--surface-1)",
                  color: "var(--ink)",
                }}
              >
                Sign in
              </Link>
              <Link
                to="/login"
                className="px-[15px] py-[10px] rounded-[100px] text-[14px] font-medium leading-[1] transition-transform hover:scale-[0.98]"
                style={{
                  backgroundColor: "var(--ink)",
                  color: "var(--canvas)",
                }}
              >
                Connect GitHub
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* 2. Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <h1
          className="mx-auto font-medium leading-[0.85] tracking-[-5.5px] max-w-5xl"
          style={{ fontSize: "110px", fontFeatureSettings: '"ss02"' }}
        >
          Your GitHub story, automated.
        </h1>
        <p
          className="mx-auto mt-8 text-[24px] font-normal leading-[1.3] tracking-[-0.01px] max-w-2xl"
          style={{ color: "var(--ink-muted)", fontFeatureSettings: '"cv11"' }}
        >
          GitReport connects to GitHub to generate AI-written monthly developer
          activity reports, achievement badges, and cinematic views.
        </p>
        <div className="mt-12 flex justify-center">
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            className="px-[24px] py-[16px] rounded-[100px] text-[16px] font-medium leading-[1] hover:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--ink)", color: "var(--canvas)" }}
          >
            Generate your first report
          </Link>
        </div>
      </section>

      {/* Hero Video (Scroll Scrub) */}
      <section style={{ height: "300vh", position: "relative" }}>
        <div className="sticky top-0 h-screen flex items-center justify-center p-8 overflow-hidden">
          <div
            className="w-full max-w-6xl aspect-video rounded-[20px] overflow-hidden shadow-2xl relative"
            style={{ backgroundColor: "var(--surface-1)" }}
          >
            <video
              ref={videoRef}
              src="/demo-scroll.mp4"
              muted
              playsInline
              className="w-full h-full object-cover"
              preload="auto"
            />
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="py-32 px-8 max-w-6xl mx-auto">
        <h2
          className="text-center font-medium leading-[0.95] tracking-[-4.25px] mb-20"
          style={{ fontSize: "85px" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Connect GitHub",
              desc: "Secure OAuth. We only read your public commit activity by default.",
            },
            {
              step: "2",
              title: "Generate Report",
              desc: "Our AI processes your diffs, commits, and PRs into a narrative.",
            },
            {
              step: "3",
              title: "Share or Download",
              desc: "Get a public link or export to a beautiful cinematic PDF.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-[32px] rounded-[20px]"
              style={{ backgroundColor: "var(--surface-1)" }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-6 text-[22px] font-bold"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--ink)",
                }}
              >
                {item.step}
              </div>
              <h3 className="text-[24px] font-normal leading-[1.3] mb-4">
                {item.title}
              </h3>
              <p
                className="text-[15px] leading-[1.3] tracking-[-0.15px]"
                style={{ color: "var(--ink-muted)" }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Feature bento grid */}
      <section className="py-32 px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="md:col-span-2 p-[32px] rounded-[30px] flex flex-col justify-end min-h-[400px]"
            style={{ backgroundColor: "var(--gradient-violet)" }}
          >
            <h3 className="text-[32px] font-medium tracking-[-1px] leading-[1.13] mb-2">
              AI-Written Narratives
            </h3>
            <p className="text-[18px] opacity-90 max-w-md leading-[1.3]">
              Stop guessing what you did last month. The LLM reads your commits
              and writes a crisp summary of your impact.
            </p>
          </div>
          <div
            className="p-[32px] rounded-[20px] flex flex-col justify-end"
            style={{ backgroundColor: "var(--surface-1)" }}
          >
            <h3 className="text-[24px] font-normal mb-2">Commit Analytics</h3>
            <p className="text-[15px] color-[var(--ink-muted)]">
              Daily punchcards and language breakdowns.
            </p>
          </div>
          <div
            className="p-[32px] rounded-[20px] flex flex-col justify-end min-h-[300px]"
            style={{ backgroundColor: "var(--surface-1)" }}
          >
            <h3 className="text-[24px] font-normal mb-2">Achievements</h3>
            <p className="text-[15px] color-[var(--ink-muted)]">
              Unlock badges for late-night ships and massive refactors.
            </p>
          </div>
          <div
            className="md:col-span-2 p-[32px] rounded-[20px] flex flex-col justify-end"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <h3 className="text-[32px] font-medium tracking-[-1px] mb-2">
              Cinematic Mode
            </h3>
            <p className="text-[18px] color-[var(--ink-muted)]">
              A full-screen, scroll-driven presentation of your month's work.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Sample report preview */}
      <section className="py-32 px-8 max-w-5xl mx-auto">
        <h2
          className="text-center font-medium leading-[0.95] tracking-[-4.25px] mb-16"
          style={{ fontSize: "85px" }}
        >
          The Output
        </h2>
        <div
          className="p-12 rounded-[20px] border"
          style={{
            backgroundColor: "var(--surface-1)",
            borderColor: "var(--hairline)",
          }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-[#1c1c1c]" />
            <div>
              <div className="text-[22px] font-bold">@developer</div>
              <div className="text-[15px] text-[var(--ink-muted)]">
                May 2026
              </div>
            </div>
          </div>
          <p className="text-[18px] leading-[1.5] text-[var(--ink-muted)] mb-8">
            "You shipped 142 commits this month, primarily focused on
            modernizing the frontend architecture and removing technical debt.
            The highlight was the migration to the new auth provider, which
            involved touching 14 distinct repositories."
          </p>
          <div className="flex gap-4">
            <div className="flex items-center px-4 py-2 rounded-lg bg-[#1c1c1c] text-[14px]">
              <Trophy className="w-4 h-4 mr-2 text-yellow-400" /> Weekend
              Warrior
            </div>
            <div className="flex items-center px-4 py-2 rounded-lg bg-[#1c1c1c] text-[14px]">
              <Flame className="w-4 h-4 mr-2 text-orange-500" /> 10-Day Streak
            </div>
          </div>
        </div>
      </section>

      {/* 6. Social proof */}
      <section className="py-32 px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              quote:
                "The easiest way to write my performance review self-eval.",
              name: "Sarah L.",
              handle: "@sarahcodes",
            },
            {
              quote: "The cinematic mode is legitimately gorgeous.",
              name: "James T.",
              handle: "@jamestech",
            },
            {
              quote: "I just share my public link with recruiters now.",
              name: "Alex M.",
              handle: "@alexdev",
            },
          ].map((t, i) => (
            <div key={i} className="flex flex-col gap-6">
              <p className="text-[24px] font-normal leading-[1.3]">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-1)]" />
                <div>
                  <div className="text-[15px]">{t.name}</div>
                  <div className="text-[13px] text-[var(--ink-muted)]">
                    {t.handle}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Pricing */}
      <section className="py-32 px-8 max-w-4xl mx-auto">
        <h2
          className="text-center font-medium leading-[1] tracking-[-3.1px] mb-16"
          style={{ fontSize: "62px" }}
        >
          Simple pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="p-[32px] rounded-[20px] flex flex-col"
            style={{ backgroundColor: "var(--surface-1)" }}
          >
            <div className="text-[22px] font-bold mb-2">Free</div>
            <div className="text-[62px] font-medium tracking-[-3.1px] mb-8">
              $0
            </div>
            <ul className="space-y-4 mb-12 flex-1 text-[15px] text-[var(--ink-muted)]">
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Public
                repository analysis
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Monthly AI
                summary
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Basic
                shareable link
              </li>
            </ul>
            <Link
              to="/login"
              className="w-full py-[10px] text-center rounded-[100px] text-[14px] font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--ink)",
              }}
            >
              Get started
            </Link>
          </div>
          <div
            className="p-[32px] rounded-[20px] flex flex-col relative"
            style={{
              backgroundColor: "var(--surface-2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div className="absolute top-0 right-8 -translate-y-1/2 px-4 py-1 bg-[var(--gradient-violet)] rounded-full text-[12px] font-bold">
              PRO
            </div>
            <div className="text-[22px] font-bold mb-2">Pro</div>
            <div className="text-[62px] font-medium tracking-[-3.1px] mb-8">
              $9<span className="text-[24px] text-[var(--ink-muted)]">/mo</span>
            </div>
            <ul className="space-y-4 mb-12 flex-1 text-[15px]">
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Private
                repository analysis
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Cinematic view
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> PDF Exports
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-400" /> Historical
                backfill
              </li>
            </ul>
            <Link
              to="/login"
              className="w-full py-[10px] text-center rounded-[100px] text-[14px] font-medium hover:scale-[0.98] transition-transform"
              style={{ backgroundColor: "var(--ink)", color: "var(--canvas)" }}
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer
        className="py-16 px-8 mt-16"
        style={{
          borderTop: "1px solid var(--hairline-soft)",
          backgroundColor: "var(--canvas)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="font-bold text-[18px] tracking-tight mb-2">
              GitReport
            </div>
            <div className="text-[13px] text-[var(--ink-muted)]">
              © 2026 GitReport. All rights reserved.
            </div>
          </div>
          <div className="flex gap-16 text-[13px]">
            <div className="flex flex-col gap-3">
              <span className="font-bold">Product</span>
              <a
                href="#"
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Features
              </a>
              <a
                href="#"
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Pricing
              </a>
              <a
                href="#"
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Changelog
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-bold">Legal</span>
              <a
                href="#"
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
