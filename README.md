# IDICorp Service Console

A standalone React application built to interact with the IDICorp service API, featuring authentication, task management, WebSocket communication, and streaming capabilities.

## Tech Stack

React · JavaScript · Vite · Tailwind CSS

## Getting Started

**Requirements:** Node.js 22.13.0 and npm 10.9.2

### 1. Install dependencies

```bash
npm ci
```

### 2. Run the application

```bash
npm run dev
```

The tracked `.env` file supplies the public API base URL, so no `.env.local` setup is needed. Vite uses it for the `/api` proxy and starts the Text Echo relay with the same upstream. Keep passwords, tokens, cookies, and other secrets out of Vite environment variables because `VITE_` values are included in browser code. Open `http://localhost:5173` or the local URL displayed by Vite.

### 3. Build the application

```bash
npm run build
```

## Production on Railway

The production Node server serves the built React files independently of IDICorp, proxies `/api/*` (including streaming responses), proxies the Calculator WebSocket at `/ws/calculator`, and runs the Text Echo relay at `/__echo/*`. Browser requests stay on the Railway origin. Upstream session cookies are scoped to `/api`, made host-only, and marked `HttpOnly` and `Secure` on public HTTPS requests.

1. In Railway, create a project with **Deploy from GitHub Repo** and select `MahsaAlishah/idicorp-service` at the repository root.
2. In the service's **Build** settings, set the Build Command to `npm ci --include=dev && npm run build`. Set the Start Command to `npm start`.
3. Set the Healthcheck Path to `/healthz`. The service reads Railway's assigned `PORT` and binds to `0.0.0.0`.
4. Keep `VITE_API_BASE_URL` set to `https://ts.idicorp.ir`. The tracked `.env` provides this public origin; it is also safe to add the same value in Railway's Variables tab. Do not add credentials or tokens to `VITE_` variables.
5. After deployment is healthy, open **Settings → Networking → Public Networking → Generate Domain**. Railway provides the public HTTPS domain; use that URL for the evaluator.

Railway references: [build and start commands](https://docs.railway.com/builds/build-and-start-commands), [health checks](https://docs.railway.com/deployments/healthchecks), [public domains and TLS](https://docs.railway.com/networking/domains/working-with-domains).

## Features

- **Authentication:** Login with CAPTCHA, session management, and logout.
- **Task Management:** Create, view, edit, complete, search, filter, and delete tasks.
- **Calculator:** Real-time arithmetic operations using WebSocket.
- **Text Echo:** Send and receive messages over a WebSocket connection.
- **Streaming Echo:** Send text or files and receive streamed responses with cancellation support.
- **Responsive UI:** Modern dashboard with accessible controls, loading states, and error handling.

## API Integration

The frontend communicates with the IDICorp service API independently of backend asset hosting.

During local development, Vite handles API requests through its proxy and starts the frontend-owned Text Echo relay automatically.

Calculator uses a same-origin WebSocket proxy. Text Echo uses a Node.js relay to support the service's WebSocket authentication requirements. Streaming Echo is passed through as a stream without buffering the response in the frontend server.

**API Documentation:** https://ts.idicorp.ir/docs
