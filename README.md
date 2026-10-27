# Pulse Pro — Autopilot-style Congress trading research, free on iPhone

Pulse Pro is a lightweight, installable **web app (PWA)** based on Capitol Pulse, extended for the feature list you asked for. It is **not** Autopilot, and it is unaffiliated with Autopilot, congressional offices, or GitHub.

**Cost:** $0/month for personal, noncommercial use on GitHub Free while within GitHub's public-repository usage limits. No paid API keys, no broker connection, no server, no database — which is what keeps it low-maintenance.

## What it does

- **Leaderboard, improved:** Top 10 by recent performance, with consistency (share of priced buys that were positive) and vs-SPY excess shown for every person. Rank by best return, most consistent, or best vs SPY. Performance across 30D / 90D / 180D side by side.
- **Portfolio tracking:** Follow people, and the app aggregates *their disclosed buys only* into a hypothetical portfolio, with holdings by ticker, a cumulative chart, and a hypothetical $1,000 value. This is **not** their real portfolio: disclosures give amount brackets, not exact shares, and do not confirm current ownership.
- **Market comparison:** Every person's mean return is compared with SPY measured from the *same* entry dates, plus a calendar SPY return for the lookback.
- **Simulator:** $100 / $500 / $1,000 presets or a custom amount, per person, with the SPY equivalent on the same entry dates. Excludes costs, taxes, and slippage.
- **Stock signals:** Transparent, rule-based Lean Buy / Neutral / Lean Avoid signals from net Congressional buying plus 30-day momentum, with a volatility-based risk level (Low / Medium / High). These are **research signals, not recommendations** and not financial advice.
- **Watchlists:** People and stocks, saved on your device only (local storage).
- **Charts:** Cumulative hypothetical portfolio/person charts built from the daily price series in the snapshot. No chart library or server needed.
- **Alerts, honestly:** No true iPhone push notifications — a free GitHub Pages PWA cannot do that without a backend and push service. You get a daily snapshot (02:17 UTC workflow) plus a "new since your last visit" banner and NEW markers on trades.

## What it deliberately does NOT claim

- **Accurate real holdings:** Impossible from STOCK Act disclosures alone. Anyone claiming exact holdings from these filings is inventing data.
- **Hedge funds / professional investors / AI strategies as live holdings:** 13F holdings are quarterly, delayed, and stored by CUSIP, not ticker. Inventing them would be misleading and high-maintenance. The app instead shows simulated strategies built only from disclosed Congress trades, plus SPY, and labels them as simulated. No real AI fund is tracked.
- **Real-time alerts:** See above. The daily workflow is the free, low-maintenance substitute.

## Publish it for free (one-time setup)

1. Create a free GitHub account if needed.
2. Create a **public** repository named `pulse-pro` (use a new repo so you don't overwrite Capitol Pulse, unless you want to replace it) with the default branch **main**.
3. Upload **the contents** of this project folder — not the ZIP itself. Preserve `.github/workflows/update-and-deploy.yml`, `scripts/`, `site/`, and `requirements.txt`. This is easier from a computer for the first setup.
4. Under **Settings → Actions → General**, ensure actions are enabled and workflows have **Read and write permissions**. Save.
5. Under **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
6. Open **Actions → Update Capitol Pulse and publish → Run workflow** (choose `main`). Wait for it to finish successfully; read the log if any data service fails.
7. Open `https://YOUR-GITHUB-USERNAME.github.io/pulse-pro/`.
8. On your iPhone, open that URL in **Safari → Share → Add to Home Screen → Add**.

The schedule triggers each day at **02:17 UTC**. GitHub disables scheduled workflows in public repositories after 60 days with no repository activity; if updates stop, re-enable the workflow in Actions and run it manually.

## How rankings work

Politicians need at least **two verifiable purchases** in the lookback. Returns are equal-weight, from the market close **strictly after** the filing date to the latest available close, using adjusted closes where available. SPY returns use the same entry dates. Simulations exclude costs, taxes, slippage, and timing effects.

## Free data feeds and limitations

- MacroWombat Congressional trades JSON: public House disclosures with deep links to PDFs; 5,000 latest rows.
- Austin Starks congressional event dataset: normalized, versioned Senate rows from 2025–2026. Use only for lawful, personal/noncommercial research.
- Daily prices: Yahoo Finance chart endpoint, no key, not officially guaranteed. When prices cannot be verified, returns show "—" rather than fabricated data.
- Coverage is roughly the most recent 190 days, capped at 1,800 trades and 120 priced tickers plus SPY in the snapshot.

## Files

`site/index.html`, `site/styles.css`, `site/app.js`, `site/manifest.webmanifest`, `site/sw.js`, and icons implement the app. `scripts/update.py` fetches, filters, calculates, and writes `site/data.json` (now including SPY). `.github/workflows/update-and-deploy.yml` schedules the daily refresh, commits validated snapshots, and deploys to GitHub Pages.

No financial advice. No paid API keys or broker connection.
