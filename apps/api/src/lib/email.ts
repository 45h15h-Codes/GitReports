/**
 * Email delivery via Resend (PRD §7.8)
 *
 * Lazy-initialised singleton client — never constructed until first send.
 * FROM address: RESEND_FROM_EMAIL env var, falls back to Resend's shared
 * sandbox address which works without domain verification (dev only).
 *
 * Two public functions:
 *   sendReportReadyEmail    — P0, fired from narrativeWorker after complete
 *   sendChallengeReceivedEmail — P1, fired from challenge link creation route
 *
 * Both are designed for fire-and-forget callers: they throw on Resend error so
 * the caller can catch and log without crashing the job or request.
 */

import { Resend } from 'resend'

// ── Client singleton ──────────────────────────────────────────────────────────

let _client: Resend | null = null

function getEmailClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _client = new Resend(key)
  }
  return _client
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// ── Parameter interfaces ──────────────────────────────────────────────────────

export interface SendReportReadyParams {
  to:           string
  username:     string
  displayName:  string
  period:       string   // 'YYYY-MM'
  persona:      string
  totalCommits: number
  reportUrl:    string
}

export interface SendChallengeReceivedParams {
  to:                 string
  displayName:        string
  challengerUsername: string
  period:             string
  challengeUrl:       string
}

// ── Report ready email ────────────────────────────────────────────────────────

export async function sendReportReadyEmail(params: SendReportReadyParams): Promise<void> {
  const {
    to, username, displayName, period,
    persona, totalCommits, reportUrl,
  } = params

  const [year, month] = period.split('-')
  const monthName = new Date(parseInt(year!), parseInt(month!) - 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const { error } = await getEmailClient().emails.send({
    from:    FROM,
    to,
    subject: `Your ${monthName} GitReport is ready`,
    html:    buildReportReadyHtml({ displayName, monthName, persona, totalCommits, reportUrl, username }),
    text:    buildReportReadyText({ displayName, monthName, persona, totalCommits, reportUrl }),
  })

  if (error) {
    throw new Error(`Resend failed for report-ready email to ${to}: ${error.message}`)
  }
}

// ── Challenge received email ──────────────────────────────────────────────────

export async function sendChallengeReceivedEmail(
  params: SendChallengeReceivedParams,
): Promise<void> {
  const { to, displayName, challengerUsername, period, challengeUrl } = params

  const [year, month] = period.split('-')
  const monthName = new Date(parseInt(year!), parseInt(month!) - 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const { error } = await getEmailClient().emails.send({
    from:    FROM,
    to,
    subject: `${challengerUsername} challenged you on GitReport`,
    html:    buildChallengeHtml({ displayName, challengerUsername, monthName, challengeUrl }),
    text:    buildChallengeText({ displayName, challengerUsername, monthName, challengeUrl }),
  })

  if (error) {
    throw new Error(`Resend failed for challenge email to ${to}: ${error.message}`)
  }
}

// ── HTML builders ─────────────────────────────────────────────────────────────
// Plain table-based HTML — renders correctly in Gmail, Outlook, Apple Mail.
// No external CSS dependencies.

function buildReportReadyHtml(p: {
  displayName:  string
  monthName:    string
  persona:      string
  totalCommits: number
  reportUrl:    string
  username:     string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'Helvetica Neue',Arial,sans-serif;color:#E6EDF3">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161B22;border-radius:12px;border:1px solid #21262D;overflow:hidden">

        <!-- Header bar -->
        <tr><td style="background:#58A6FF;height:3px;font-size:0">&nbsp;</td></tr>

        <!-- Logo -->
        <tr><td style="padding:28px 32px 0">
          <span style="font-size:15px;font-weight:700;color:#E6EDF3;letter-spacing:-0.3px">&#9889; GitReport</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px 32px">
          <p style="margin:0 0 8px;font-size:13px;color:#484F58;text-transform:uppercase;letter-spacing:0.08em">Monthly Report</p>
          <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#E6EDF3;line-height:1.2">
            Your ${p.monthName} report is ready, ${p.displayName}.
          </h1>

          <!-- Stat pills -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="padding-right:8px">
                <span style="display:inline-block;background:#1F3450;border:1px solid #58A6FF33;border-radius:20px;padding:6px 14px;font-size:12px;color:#58A6FF;font-family:monospace">
                  ${p.totalCommits} commits
                </span>
              </td>
              <td>
                <span style="display:inline-block;background:#0D2340;border:1px solid #185FA533;border-radius:20px;padding:6px 14px;font-size:12px;color:#7BAFD4;font-family:monospace">
                  ${p.persona}
                </span>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <a href="${p.reportUrl}"
             style="display:inline-block;background:#58A6FF;color:#0D1117;font-size:13px;font-weight:600;font-family:monospace;padding:12px 24px;border-radius:8px;text-decoration:none">
            View your ${p.monthName} report &#8594;
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #21262D">
          <p style="margin:0;font-size:11px;color:#484F58;font-family:monospace">
            &#128274; This report uses your public GitHub activity only. Private repos are never included.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#484F58;font-family:monospace">
            gitreport.dev &middot; <a href="${p.reportUrl}" style="color:#484F58">unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildReportReadyText(p: {
  displayName:  string
  monthName:    string
  persona:      string
  totalCommits: number
  reportUrl:    string
}): string {
  return `Your ${p.monthName} GitReport is ready, ${p.displayName}.

${p.totalCommits} commits · ${p.persona}

View your report: ${p.reportUrl}

---
GitReport uses your public GitHub activity only. Private repos are never included.`
}

function buildChallengeHtml(p: {
  displayName:        string
  challengerUsername: string
  monthName:          string
  challengeUrl:       string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'Helvetica Neue',Arial,sans-serif;color:#E6EDF3">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161B22;border-radius:12px;border:1px solid #21262D;overflow:hidden">

        <tr><td style="background:#D85A30;height:3px;font-size:0">&nbsp;</td></tr>

        <tr><td style="padding:28px 32px 0">
          <span style="font-size:15px;font-weight:700;color:#E6EDF3">&#9889; GitReport</span>
        </td></tr>

        <tr><td style="padding:24px 32px 32px">
          <p style="margin:0 0 8px;font-size:13px;color:#484F58;text-transform:uppercase;letter-spacing:0.08em">Challenge</p>
          <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#E6EDF3;line-height:1.2">
            ${p.challengerUsername} is challenging you.
          </h1>
          <p style="margin:0 0 24px;font-size:14px;color:#8B949E;line-height:1.6">
            They've shared their ${p.monthName} stats and want to see if you can beat them.
            Connect your GitHub to reveal your numbers.
          </p>

          <a href="${p.challengeUrl}"
             style="display:inline-block;background:#D85A30;color:#fff;font-size:13px;font-weight:600;font-family:monospace;padding:12px 24px;border-radius:8px;text-decoration:none">
            Accept the challenge &#8594;
          </a>
        </td></tr>

        <tr><td style="padding:20px 32px;border-top:1px solid #21262D">
          <p style="margin:0;font-size:11px;color:#484F58;font-family:monospace">
            gitreport.dev &middot; <a href="${p.challengeUrl}" style="color:#484F58">unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildChallengeText(p: {
  displayName:        string
  challengerUsername: string
  monthName:          string
  challengeUrl:       string
}): string {
  return `${p.challengerUsername} is challenging you on GitReport.

They've shared their ${p.monthName} stats. Accept the challenge: ${p.challengeUrl}

---
gitreport.dev`
}
