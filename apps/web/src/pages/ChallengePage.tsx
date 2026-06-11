import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "@phosphor-icons/react";
import { ChallengeCard } from "../components/ChallengeCard";
import { SocialShare } from "../components/SocialShare";
import { getPublicReport } from "../lib/api";
import { ApiError } from "../lib/api";
import { formatPeriod } from "../utils/persona";
import { useAuth } from "../context/AuthContext";
import { useMonthlyReport } from "../hooks/useMonthlyReport";
import { GenerateReportButton } from "../components/GenerateReportButton";
import type { AiPayload } from "../types/api";

// PRD §5.3: challenge links expire after 30 days
const CHALLENGE_TTL_DAYS = 30;

function isExpired(period: string): boolean {
  const [year, month] = period.split("-").map(Number);
  // Base the expiration on the start of the NEXT month (when the period officially ends)
  // e.g. for 2026-05, the base date is 2026-06-01.
  const expiryDate = new Date(year!, month!, 1);
  expiryDate.setDate(expiryDate.getDate() + CHALLENGE_TTL_DAYS);
  return new Date() > expiryDate;
}

function determineWinner(
  challengerCommits: number,
  challengedCommits: number,
): "challenger" | "challenged" | "tie" {
  if (challengerCommits > challengedCommits) return "challenger";
  if (challengedCommits > challengerCommits) return "challenged";
  return "tie";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChallengeSkeleton() {
  return (
    <div
      className="min-h-screen pb-16 animate-pulse"
      style={{ background: "#0D1117" }}
    >
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #21262D" }}
      >
        <div className="h-5 w-24 rounded" style={{ background: "#21262D" }} />
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        <div className="h-8 w-64 rounded" style={{ background: "#21262D" }} />
        <div className="flex gap-8">
          <div
            className="w-56 h-80 rounded-xl"
            style={{ background: "#161B22" }}
          />
          <div
            className="w-56 h-80 rounded-xl"
            style={{ background: "#161B22" }}
          />
        </div>
      </main>
    </div>
  );
}

// ── ChallengePage ─────────────────────────────────────────────────────────────

export function ChallengePage() {
  const { username, period } = useParams<{
    username: string;
    period: string;
  }>();
  const { user, isAuthenticated, login } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const isValidPeriod = period && /^\d{4}-\d{2}$/.test(period);

  // Fetch challenged user's report (own report) if they've accepted
  const { data: challengedReportObj, isLoading: challengedLoading } =
    useMonthlyReport(accepted && isValidPeriod ? period : undefined);

  // Fetch challenger's public report
  const { data, isLoading, error } = useQuery({
    queryKey: ["public", username, period],
    queryFn: () => getPublicReport(username!, period!),
    enabled: !!username && !!isValidPeriod && !isExpired(period ?? ""),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Expiry / validity check
  if (!username || !isValidPeriod || isExpired(period!)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D1117" }}
      >
        <div className="text-center">
          <div
            className="font-display font-bold text-[24px] mb-2"
            style={{ color: "#E6EDF3" }}
          >
            Challenge expired
          </div>
          <div
            className="font-mono text-[13px] mb-6"
            style={{ color: "#8B949E" }}
          >
            Challenge links expire after {CHALLENGE_TTL_DAYS} days.
          </div>
          <Link
            to="/"
            className="font-mono text-[12px]"
            style={{ color: "#58A6FF" }}
          >
            ← Generate your own report
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <ChallengeSkeleton />;

  if (error) {
    const msg =
      error instanceof ApiError && error.status === 404
        ? "Challenger's report is private or doesn't exist."
        : "Failed to load challenge. Please try again.";
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D1117" }}
      >
        <div className="text-center">
          <div
            className="font-display font-bold text-[24px] mb-2"
            style={{ color: "#E6EDF3" }}
          >
            Challenge unavailable
          </div>
          <div
            className="font-mono text-[13px] mb-6"
            style={{ color: "#8B949E" }}
          >
            {msg}
          </div>
          <Link
            to="/"
            className="font-mono text-[12px]"
            style={{ color: "#58A6FF" }}
          >
            ← Generate your own report
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { user: challengerUser, report: challengerReport } = data;
  const challengerPayload = challengerReport.payload;

  // Build a compatible profile shape for ChallengeCard
  const challengerProfile = {
    username: challengerUser.username,
    avatar_url: challengerUser.avatarUrl,
    display_name: challengerUser.displayName,
  };

  // Challenged user — authenticated user's own data (if they've accepted)
  const challengedProfile =
    isAuthenticated && user
      ? {
          username: user.username,
          avatar_url: user.avatarUrl,
          display_name: user.displayName ?? user.username,
        }
      : null;

  // Compute winner once accepted and challenged report is available
  const winner =
    accepted && challengedProfile && challengedReportObj?.payload
      ? determineWinner(
          challengerPayload.total_commits,
          challengedReportObj.payload.total_commits,
        )
      : null;

  const challengeUrl = `${window.location.origin}/challenge/${username}/${period}`;
  const socialCaption = `I shipped ${challengerPayload.total_commits} commits in ${formatPeriod(period!)} as ${challengerPayload.developer_persona}. Think you can beat that?`;

  function handleAccept() {
    if (!isAuthenticated) {
      // Not logged in — redirect to GitHub OAuth
      login();
    } else {
      setAccepted(true);
    }
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0D1117" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #21262D" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "#58A6FF" }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 13 13"
              fill="none"
              aria-hidden="true"
            >
              <polygon
                points="7.5,1 2,7.5 6.5,7.5 5.5,12 11,5.5 6.5,5.5"
                fill="#0D1117"
              />
            </svg>
          </div>
          <span
            className="font-display font-bold text-[14px]"
            style={{ color: "#E6EDF3" }}
          >
            GitReport
          </span>
        </div>
        <Link
          to="/"
          className="font-mono text-[12px] px-4 py-2 rounded-lg transition-all duration-150"
          style={{
            background: "#161B22",
            color: "#8B949E",
            border: "1px solid #21262D",
            textDecoration: "none",
          }}
        >
          Generate yours →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Challenge header */}
        <div className="text-center mb-10">
          <div
            className="font-mono text-[11px] uppercase tracking-widest mb-3"
            style={{ color: "#484F58", letterSpacing: "0.1em" }}
          >
            Challenge
          </div>
          <h1
            className="font-display font-bold text-[28px] leading-tight mb-2"
            style={{ color: "#E6EDF3" }}
          >
            {username} is challenging you
          </h1>
          <p className="font-mono text-[13px]" style={{ color: "#8B949E" }}>
            {formatPeriod(period!)} · Can you beat{" "}
            {challengerPayload.total_commits} commits?
          </p>
        </div>

        {/* Winner banner */}
        <AnimatePresence>
          {winner && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center gap-3 mb-8 px-6 py-4 rounded-xl"
              style={{
                background: winner === "tie" ? "#1C2128" : "#0F2D1A",
                border: `1px solid ${winner === "tie" ? "#30363D" : "#3FB95044"}`,
              }}
            >
              <Trophy
                size={20}
                weight="duotone"
                color={winner === "tie" ? "#8B949E" : "#3FB950"}
              />
              <span
                className="font-mono text-[13px] font-medium"
                style={{ color: winner === "tie" ? "#8B949E" : "#3FB950" }}
              >
                {winner === "tie"
                  ? "It's a tie — both shipped the same commits"
                  : winner === "challenged"
                    ? "You win! You shipped more commits this month."
                    : `${username} wins this one. Ship more next month.`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two-card layout */}
        <div className="flex items-start justify-center gap-8 flex-wrap mb-10">
          {/* Challenger — left */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "#484F58" }}
            >
              Challenger
            </div>
            <ChallengeCard
              state="filled"
              payload={
                challengerPayload as unknown as AiPayload & {
                  ai_summary: string;
                  lines_added_total: number;
                  prs_merged_total: number;
                  repos_touched: number;
                  daily_commits: number[];
                }
              }
              profile={challengerProfile}
              label={username!}
            />
          </div>

          {/* VS divider */}
          <div
            className="flex items-center justify-center font-display font-bold text-[20px] self-center"
            style={{ color: "#30363D", minWidth: 32 }}
          >
            vs
          </div>

          {/* Challenged — right */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "#484F58" }}
            >
              {accepted ? "You" : "Your Stats"}
            </div>
            <AnimatePresence mode="wait">
              {accepted && challengedProfile && challengedReportObj?.payload ? (
                <motion.div
                  key="filled"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ChallengeCard
                    state="filled"
                    payload={
                      challengedReportObj.payload as unknown as AiPayload & {
                        ai_summary: string;
                        lines_added_total: number;
                        prs_merged_total: number;
                        repos_touched: number;
                        daily_commits: number[];
                      }
                    }
                    profile={challengedProfile}
                    label="you"
                  />
                </motion.div>
              ) : accepted &&
                challengedProfile &&
                !challengedReportObj &&
                !challengedLoading ? (
                <motion.div
                  key="generate"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center gap-4"
                >
                  <ChallengeCard
                    state="blank"
                    label="Generate your report"
                    onAccept={() => {}} // Handled by GenerateReportButton
                  />
                  <div className="absolute mt-36">
                    <GenerateReportButton period={period!} variant="primary" />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="blank" exit={{ opacity: 0, scale: 0.95 }}>
                  <ChallengeCard
                    state="blank"
                    label={
                      isAuthenticated
                        ? "Generate your report"
                        : "Connect GitHub"
                    }
                    onAccept={handleAccept}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Social share */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#161B22", border: "1px solid #21262D" }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-widest mb-3"
            style={{ color: "#484F58", letterSpacing: "0.08em" }}
          >
            Share this challenge
          </div>
          <p
            className="font-mono text-[12px] mb-4 p-3 rounded-lg"
            style={{
              color: "#8B949E",
              background: "#0D1117",
              border: "1px solid #21262D",
            }}
          >
            "{socialCaption}"
          </p>
          <SocialShare caption={socialCaption} url={challengeUrl} />
        </div>
      </main>
    </div>
  );
}
