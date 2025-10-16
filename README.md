# Live Outage Dashboard

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/J-Lazerus_Ebank/infrastructure.status-page)

Aegis is a sophisticated, real-time command center dashboard designed for enterprise infrastructure and security teams. It provides a unified, single-pane-of-glass view of system health by aggregating data from critical sources including ServiceNow for incident management, various vendor status pages for third-party service health, and SolarWinds for internal monitoring alerts. The dashboard is structured into modular, information-dense panels, allowing operators to quickly assess active outages, monitor vendor stability, triage alerts, and track related ServiceNow tickets.

## Key Features

-   **🔴 Active Outages Panel:** Displays real-time outage information from ServiceNow, including impact, start time, and collaboration links.
-   **📊 Vendor Status Aggregator:** Color-coded status summaries from key third-party vendors.
-   **🛠️ Monitoring Alerts Feed:** A live feed of alerts from monitoring tools like SolarWinds.
-   **📁 Recent ServiceNow Tickets:** A view of recent outage-related tickets with quick links.
-   **📞 Active Collaboration Bridges:** Lists active Teams calls related to ongoing incidents.
-   **📈 Outage Trends & History:** Visualizes historical outage data for trend analysis and reporting.
-   **🔍 Powerful Search & Filtering:** Comprehensive search and filtering across all data panels.
-   **🌙 Dark-Theme First:** A modern, professional, and data-centric UI optimized for operations centers.

## Technology Stack

-   **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
-   **Backend:** Hono on Cloudflare Workers
-   **State Management:** Zustand
-   **Data Visualization:** Recharts
-   **UI/UX:** Framer Motion, Lucide React
-   **Utilities:** date-fns, TypeScript

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Bun](https://bun.sh/) installed on your machine.
-   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for interacting with the Cloudflare platform.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone <repository-url>
    cd aegis_outage_dashboard
    ```

2.  **Install dependencies:**
    This project uses Bun as the package manager.
    ```sh
    bun install
    ```

### Running the Development Server

To start the local development server, which includes both the Vite frontend and the Hono backend worker, run:

```sh
bun dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

The project is organized into three main directories:

-   `src/`: Contains the React frontend application code, including pages, components, hooks, and styles.
-   `worker/`: Contains the Hono backend code that runs on Cloudflare Workers. This is where API routes and data logic reside.
-   `shared/`: Contains TypeScript types and mock data shared between the frontend and the backend to ensure type safety.

## Development

### Frontend

The frontend is a standard React application built with Vite. Components are primarily built using **shadcn/ui** and styled with **Tailwind CSS**.

-   **Pages:** Located in `src/pages/`. The main entry point is `HomePage.tsx`.
-   **Components:** Reusable components are located in `src/components/`.
-   **API Calls:** A simple API client is provided in `src/lib/api-client.ts` for making requests to the backend.

### Backend (Cloudflare Worker)

The backend is a Hono application running on a Cloudflare Worker.

-   **API Routes:** New API endpoints should be added in `worker/user-routes.ts`.
-   **Data Persistence:** The template uses a single Durable Object for data persistence, abstracted via entity classes in `worker/entities.ts`.
-   **Mock Data:** Initial data for development is located in `shared/mock-data.ts`.

## Deployment

This application is designed to be deployed to Cloudflare Pages with a Functions backend.

1.  **Build the project:**
    ```sh
    bun run build
    ```

2.  **Deploy to Cloudflare:**
    Run the deploy command using the Wrangler CLI. Make sure you are logged in (`wrangler login`).
    ```sh
    bun run deploy
    ```

Alternatively, you can connect your GitHub repository to Cloudflare Pages for continuous deployment.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/J-Lazerus_Ebank/infrastructure.status-page)

## License

This project is licensed under the MIT License.
