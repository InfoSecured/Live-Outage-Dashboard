# Live Outage Dashboard

A real-time operations dashboard that provides a unified view of system status by aggregating data from multiple sources. Built for IT, NOC, and incident-response teams who need a single-pane-of-glass view of their operational environment.

The dashboard integrates with ServiceNow for outages, change controls, and tickets; SolarWinds for monitoring alerts; vendor status APIs for external service health; and Microsoft Teams Bridges for collaboration calls. The entire application runs on Cloudflare Workers with React for the frontend, providing a fast, globally distributed, and highly available platform.

## ✨ Key Features

* 🔴 **Active Outages Panel** - Real-time ServiceNow outages with impact level, ETA, and direct bridge links
* 📊 **Vendor Status Aggregator** - Polls JSON APIs and dynamically evaluates operational status
* 🛠️ **Monitoring Alerts Feed** - Displays SolarWinds alerts with filtering and caption exclusion support
* 📁 **ServiceNow Tickets** - Lists current tickets with quick navigation links
* 📞 **Collaboration Bridges** - Shows Teams bridges created for active incidents
* 📈 **Outage Trends** - Aggregates outage history from ServiceNow for pattern analysis
* 🔄 **Change Control Overview** - Displays scheduled and implementing changes for the current day
* 🌙 **Dark-Mode Design** - Built specifically for 24/7 operations environments

## 🛠️ Technology Stack

* **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
* **Backend**: Hono (TypeScript) running on Cloudflare Workers
* **Storage**: Cloudflare Durable Objects + KV Namespace
* **Visualization**: Recharts
* **State Management**: Zustand
* **Animations**: Framer Motion
* **Icons**: Lucide React
* **Utilities**: date-fns for time logic

## 📋 Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `SERVICENOW_USERNAME` | ServiceNow API username |
| `SERVICENOW_PASSWORD` | ServiceNow API password |
| `SOLARWINDS_USERNAME` | SolarWinds API username |
| `SOLARWINDS_PASSWORD` | SolarWinds API password |
| `GlobalDurableObject` | Durable Object binding (auto-created) |
| `KV` | Cloudflare KV binding (manual) |

### Optional

| Variable | Description |
|----------|-------------|
| `ENABLE_MANAGEMENT` | Enables management UI when `true` |
| `SOLARWINDS_UI_BASE` | Override base URL for SolarWinds alerts |
| `SOLARWINDS_EXCLUDE_CAPTIONS` | CSV list of captions to filter out |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | Optional Cloudflare Access credentials |
| `SERVICENOW_TICKET_URL_PREFIX` | Overrides ticket deep link format |

## 🚀 Installation Instructions

### 1. Clone the repository

```bash
git clone https://github.com/InfoSecured/Live-Outage-Dashboard.git
cd Live-Outage-Dashboard
```

### 2. Install dependencies (using Bun)

```bash
bun install
```

### 3. Run locally (frontend + backend)

```bash
bun dev
```

The app runs on `http://localhost:3000`.

## ☁️ Deployment Guide

### 8.1 Build locally

```bash
bun run build
```

### 8.2 Deploy via Wrangler

```bash
bun run deploy
```

**Ensure authentication:**

```bash
npx wrangler login
```

### 8.3 Continuous Deployment (Cloudflare Pages)

* Connect the GitHub repo to Cloudflare Pages
* Cloudflare automatically detects the Worker backend in `/worker/`
* The included button should link directly to your repo:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/InfoSecured/Live-Outage-Dashboard)

## 🔧 KV Namespace Setup

Create a KV namespace for configuration storage:

```bash
npx wrangler kv:namespace create "status-page-env"
```

Then modify `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "KV", "id": "<your_namespace_id>" }
  ]
}
```

Populate KV keys via Cloudflare Dashboard → **Workers & Pages** → **KV** → **status-page-env** → **Add Key**.

**Example:**

```bash
ENABLE_MANAGEMENT = true
SOLARWINDS_EXCLUDE_CAPTIONS = "heartbeat, test alert"
```

## 📂 Project Structure

```
src/        → React frontend (UI components, pages)
worker/     → Cloudflare Worker backend (Hono routes, Durable Objects)
shared/     → Shared TypeScript types and mock data
```

### Highlight:

* `worker/user-routes.ts` — main API routes
* `worker/core-utils.ts` — KV + Durable Object definitions
* `wrangler.jsonc` — Worker configuration

## 🔐 Backend (Cloudflare Worker)

The backend is built with the **Hono framework** for Cloudflare Workers.

### Key Routes:

* `/api/vendors` - Vendor status aggregation
* `/api/outages` - ServiceNow outages
* `/api/monitoring/alerts` - SolarWinds monitoring feed
* `/api/servicenow/*` - ServiceNow ticket and change control data
* `/api/changes/today` - Today's change schedule

### Storage:

* **Durable Object** (`GlobalDurableObject`) for entity storage and indexing
* **KV Namespace** for configuration values like UI settings or exclusions

### Logging:

Includes robust logging (`logServiceNowInteraction`) for debugging.

### Secrets:

Set secrets using:

```bash
npx wrangler secret put SERVICENOW_USERNAME
npx wrangler secret put SERVICENOW_PASSWORD
```

## 💻 Frontend Overview

* **Framework**: React + Vite
* **UI Library**: Tailwind CSS + shadcn/ui
* **Charts**: Recharts
* **State**: Zustand
* **Animations**: Framer Motion
* **API Layer**: `/src/lib/api-client.ts` uses Hono endpoints
* **Theme**: Dark mode optimized for NOC dashboards

## 📜 License

This project is licensed under the MIT License.

---

**Built with ☁️ Cloudflare Workers | 🚀 React + Vite | 🎨 Tailwind CSS**
