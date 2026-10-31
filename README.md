# IDICorp Service Console

A standalone React application for interacting with the IDICorp service API, featuring authentication, task management, WebSocket tools, and streaming capabilities.

## Tech Stack

React · JavaScript · Vite · Tailwind CSS · Node.js

## Getting Started

**Requirements:** Node.js 22.13.0 and npm 10.9.2 (tested versions).

**1. Install dependencies**

```bash
npm ci
```

**2. Configure the environment**

Create `.env.local` from `.env.example` and set:

```env
VITE_API_BASE_URL=https://ts.idicorp.ir
```

**3. Start the application**

```bash
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

**4. Build for production**

```bash
npm run build
```

The generated files are placed in `dist/`.

## Features

- **Authentication:** Login with CAPTCHA, session management, and logout.
- **Task Management:** Create, view, edit, complete, search, filter, and delete tasks.
- **Calculator:** Real-time arithmetic operations using WebSocket.
- **Text Echo:** Send and receive multiple messages over a WebSocket connection.
- **Streaming Echo:** Stream text or files with progress and cancellation support.
- **Responsive UI:** Accessible dashboard with loading and error states.

## Configuration & Deployment

The frontend is independently hosted and does not require the backend to serve its assets.

During local development, Vite proxies API requests and starts the Text Echo relay automatically.

For production, the frontend requires:

- A same-origin proxy for `/api/*` and `/ws/calculator`.
- A standalone Node.js Echo relay for `/__echo/*`.
- HTTPS and correctly configured session cookies.

The Echo relay is required because the observed Text Echo API expects Bearer authentication during the WebSocket handshake, which browser JavaScript cannot directly provide.

Start the production relay using:

```powershell
$env:VITE_API_BASE_URL = 'https://ts.idicorp.ir'
$env:ECHO_RELAY_ORIGIN = 'https://your-frontend-domain.com'
npm run echo:relay
```

When using the same-origin production proxy, build with `VITE_API_BASE_URL` set to the frontend's public origin.

A static-only hosting service cannot run the Echo relay. The full HTTPS deployment has not yet been verified.

## API Assumptions

- Protected requests use Bearer authentication and session cookies.
- Tasks are session-scoped and expire one hour after creation or update.
- Calculator authentication occurs through the first WebSocket message.
- Text Echo requires an Authorization header during the handshake, based on observed service behavior.
- Streaming Echo supports text and binary responses.

**API Documentation:** [https://ts.idicorp.ir/docs](https://ts.idicorp.ir/docs)

## Repository

The repository contains the complete application source, configuration, dependency manifests, lockfile, and `.env.example`.

Local secrets, `node_modules/`, and generated `dist/` files are excluded from version control.
