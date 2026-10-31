
# IDICorp Service Console

A React-based service console for the IDICorp API, featuring authentication, task management, real-time WebSocket tools, and streaming responses.

**Live demo:** https://idicorp-service.onrender.com  
**Source code:** https://github.com/MahsaAlishah/idicorp-service  
**API documentation:** https://ts.idicorp.ir/docs

## Tech Stack

- React, JavaScript, Vite, Tailwind CSS

## Features

- **Authentication:** CAPTCHA-based login, session handling, and logout.
- **Task management:** Create, view, edit, complete, search, filter, and delete tasks.
- **Calculator:** Real-time calculations over WebSocket.
- **Text Echo:** WebSocket messaging through a frontend-owned Node.js relay.
- **Streaming Echo:** Stream text or file responses, with cancellation support.
- **Responsive UI:** Dashboard layout with loading, error, and empty states.

## Run Locally

**Requirements:** Node.js 22.13.0 and npm 10.9.2 (or compatible versions).

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

The tracked `.env` provides the public upstream API URL (`VITE_API_BASE_URL=https://ts.idicorp.ir`), so no additional environment file is required for the default setup.

Vite proxies `/api` requests and Calculator WebSocket traffic and starts the Text Echo relay for local development.

To build the production assets:

```bash
npm run build
```

To run the production Node server locally after building:

```bash
npm start
```

The production server reads `PORT` from the environment (and otherwise uses its configured default).

## Live Deployment (Render)

The application is deployed as a **Render Web Service**, not a static site. A single Node.js server serves the React build and forwards API and WebSocket traffic to the IDICorp backend.

**Live URL:** https://idicorp-service.onrender.com

To deploy from this repository:

1. Create a **Web Service** in Render and connect `MahsaAlishah/idicorp-service`, branch `main`, with the repository root as the root directory.
2. Choose the **Node** runtime and configure:

   | Setting | Value |
   | --- | --- |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/healthz` |
   | Environment Variable | `VITE_API_BASE_URL=https://ts.idicorp.ir` |

3. Deploy the service and open the HTTPS URL provided by Render.

**Free-tier note:** Render's free web services may spin down when idle, so the first request after inactivity can take longer. This is a hosting limitation, not necessarily an application error.

## API and WebSocket Integration

The application uses the IDICorp backend as an API only; the React assets are hosted by the frontend service.

- **HTTP API:** Browser requests use same-origin `/api/*` routes. The Node server proxies them to `https://ts.idicorp.ir`, preserving streamed responses and handling session cookies.
- **Calculator WebSocket:** The browser connects to same-origin `/ws/calculator`, which is proxied to the upstream Calculator WebSocket.
- **Text Echo WebSocket:** A frontend-owned Node.js relay handles the upstream authentication header requirement and exposes same-origin `/__echo/*` endpoints.
- **Streaming Echo:** Responses are forwarded incrementally rather than buffered by the frontend server.

Do not store credentials, bearer tokens, or secrets in `VITE_` environment variables: Vite can embed those values into client-side JavaScript.
