# Allbridge on Algorand — USDC Volume Dashboard

A live analytics dashboard tracking **USDC bridging activity** through [Allbridge](https://allbridge.io/) on the Algorand blockchain. The dashboard surfaces monthly KPIs and charts for transactions, active users, and USDC volume (source vs. destination), with data refreshed automatically every day via GitHub Actions.

---

## 📊 Dashboard Overview

The dashboard is built with **React + Vite** and displays the following metrics, all scoped to the **last 12 months**:

| KPI | Description |
|-----|-------------|
| **Transactions (MTD)** | Number of bridge transactions in the current month to date |
| **Users (MTD)** | Unique active wallets that bridged in the current month to date |
| **Volume (MTD)** | Total USDC volume bridged in the current month to date |

Each KPI card shows a **month-over-month delta** (MTD vs. previous month MTD) and acts as a tab selector for the chart below.

### Charts

- **Transactions** — Monthly bar chart of total bridge transactions
- **Users** — Monthly bar chart of unique active users
- **Volume** — Stacked bar chart splitting USDC volume into:
  - 🟣 **Source Volume** — USDC sent *from* Algorand
  - 🔵 **Destination Volume** — USDC received *on* Algorand
  - Hover tooltip shows the breakdown and grand total

The dashboard supports **light and dark mode**, toggled via the button in the header.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                           │
│                                                                 │
│  ① dbt Run (daily 00:00 UTC)          ② Data Fetch (01:00 UTC) │
│     Transforms raw on-chain data  →      Exports mart to CSV   │
│     in ClickHouse via dbt models         → public/allbridge.csv │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                     ┌────────────────────┐
                     │  React Dashboard   │
                     │  (Vite + Recharts) │
                     │  reads allbridge.csv│
                     └────────────────────┘
```

### Data Pipeline

1. **Raw data** — On-chain Algorand transaction data is stored in **ClickHouse** (database: `c_algorand`), provided by [Nodely](https://nodely.io/) and queried by the Algorand Foundation.
2. **dbt models** — SQL transformations in `allbridge/models/` clean and aggregate the raw data into a mart table (`mart_bridge__monthly`).
3. **Fetch script** — `scripts/fetchData.js` queries the mart table from ClickHouse and writes the result to `public/allbridge.csv`.
4. **Dashboard** — The React app reads `allbridge.csv` at runtime and renders KPI cards and charts.

---

## 🗂️ Project Structure

```
algorand-allbridge/
├── .github/
│   └── workflows/
│       ├── dbt_run.yaml        # Daily dbt model run (00:00 UTC)
│       └── fetch_data.yaml     # Daily CSV export from ClickHouse (01:00 UTC)
│
├── allbridge/                  # dbt project
│   ├── models/
│   │   ├── staging/            # Raw source models
│   │   ├── intermediates/      # Cleaned & aggregated intermediate models
│   │   │   ├── int_bridge__src_transfers.sql
│   │   │   ├── int_bridge__dst_transfers.sql
│   │   │   ├── int_bridge__monthly_txns.sql        # MTD transactions
│   │   │   ├── int_bridge__monthly_txns_full.sql   # Full-month transactions
│   │   │   ├── int_bridge__monthly_users.sql       # MTD users
│   │   │   ├── int_bridge__monthly_users_full.sql  # Full-month users
│   │   │   ├── int_bridge__monthly_volume.sql      # MTD volume (src + dst)
│   │   │   ├── int_bridge__monthly_volume_full.sql # Full-month volume
│   │   │   ├── int_bridge__user_first_seen.sql
│   │   │   └── int_bridge__user_monthly_activity.sql
│   │   └── marts/
│   │       └── mart_bridge__monthly.sql            # Final mart (last 12 months)
│   └── dbt_project.yml
│
├── scripts/
│   └── fetchData.js            # Exports mart_bridge__monthly → public/allbridge.csv
│
├── public/
│   └── allbridge.csv           # Auto-generated data file (do not edit manually)
│
└── src/
    ├── components/
    │   └── Dashboard/
    │       ├── Dashboard.jsx   # Main dashboard component
    │       └── Dashboard.css   # Dashboard styles
    ├── App.jsx
    └── index.css
```

---

## 📐 dbt Data Model

### `mart_bridge__monthly`

The final mart table, materialized as a **ClickHouse table**, covering the **last 12 months**:

| Column | Type | Description |
|--------|------|-------------|
| `month` | Date | First day of the month |
| `monthly_transactions` | Int | Total bridge transactions for the full month |
| `monthly_active_users` | Int | Unique wallets for the full month |
| `monthly_src_usdc` | Float | USDC sent from Algorand (full month) |
| `monthly_dst_usdc` | Float | USDC received on Algorand (full month) |
| `monthly_usdc` | Float | Total USDC volume (full month) |
| `transactions_mtd` | Int | Transactions month-to-date |
| `active_users_mtd` | Int | Unique wallets month-to-date |
| `volume_mtd` | Float | Total USDC volume month-to-date |

> **MTD columns** are filtered to `day_of_month <= today()` so the current month's KPIs are always comparable to the same point in the previous month.

---

## ⚙️ GitHub Actions Automation

Two workflows run automatically every day:

### 1. `dbt_run.yaml` — dbt Model Refresh (00:00 UTC)
- Sets up Python and installs dbt with the ClickHouse adapter
- Dynamically creates `~/.dbt/profiles.yml` from GitHub Secrets
- Runs `dbt run --project-dir ./allbridge` to refresh all models

### 2. `fetch_data.yaml` — CSV Export (01:00 UTC)
- Runs after the dbt refresh
- Executes `npm run fetch-data` (`scripts/fetchData.js`)
- Queries `mart_bridge__monthly` from ClickHouse and writes `public/allbridge.csv`
- Commits and pushes the updated CSV back to the repository

Both workflows can also be triggered manually from the **Actions** tab.

---

## 🚀 Local Development

### Prerequisites

- Node.js ≥ 22
- Python ≥ 3.13 (for dbt)
- Access to the ClickHouse instance

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file at the project root:

```env
DB_HOST=<clickhouse_host>
DB_PORT=<clickhouse_port>
DB_USER=<username>
DB_PASS=<password>
```

### 3. Fetch the latest data

```bash
npm run fetch-data
```

This queries ClickHouse and writes `public/allbridge.csv`.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7 |
| Charts | Recharts |
| Icons | Lucide React |
| Data warehouse | ClickHouse |
| Data transformation | dbt (ClickHouse adapter) |
| CI/CD | GitHub Actions |
| Data source | Nodely / Algorand Foundation |

---

## 📄 Data Disclaimer

> ⚠️ Data is provided by **Nodely**, queried by the **Algorand Foundation**. Volume figures represent USDC bridged through Allbridge Core on the Algorand network and may not reflect all cross-chain activity.
