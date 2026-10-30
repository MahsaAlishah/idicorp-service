# IDICorp Service Console

IDICorp Service Console is a standalone React front end for signing in to the IDICorp service, managing tasks, and using its calculator, text echo, and streaming echo features. The app serves its own built assets; it does not depend on the backend to host the front end.

The intended package and GitHub repository name is `idicorp-service`. The application title remains **IDICorp Service Console**.

## Requirements

- Node.js `22.13.0`
- npm `10.9.2`

These are the versions used to build this project. The app uses JavaScript, React, Vite, and Tailwind CSS.

## Install and run locally

From the repository root, install the locked dependencies:

```sh
npm ci
```

Copy the environment template to a local environment file:

```powershell
Copy-Item .env.example .env.local
```

Set `VITE_API_BASE_URL` in `.env.local` to the service API's public HTTP(S) origin. The checked-in example uses `https://ts.idicorp.ir`. Do not put passwords, tokens, cookies, or other secrets in Vite environment variables: values prefixed with `VITE_` are included in browser code.

Start the development server:

```sh
npm run dev
```

Vite serves the app at `http://127.0.0.1:5173`. In development, `/api/*` requests are proxied to `VITE_API_BASE_URL`, and the Echo relay is started by the Vite configuration.

## Build and preview

Create the production files in `dist/`:

```sh
npm run build
```

To preview the static build locally:

```sh
npm run preview
```

`vite preview` serves the static front end only. It does not run the Echo relay or configure the production API and WebSocket routes.

## Application features

- **Sign in:** fetches the CAPTCHA and salt, then submits the username, password, salt, and CAPTCHA answer. Credentials are entered in the form and are not stored in project files.
- **Tasks:** lists and searches tasks, filters by completion, and supports create, detail, edit, completion updates, and delete.
- **Calculator:** connects to the service WebSocket and supports add, subtract, multiply, and divide.
- **Text echo:** connects through the frontend's same-origin Node relay and supports multiple messages and reconnecting.
- **Streaming echo:** sends text or a file and displays the response as it arrives; binary responses can be downloaded.
- The interface includes responsive navigation, keyboard-accessible controls, visible focus states, and loading, empty, and error states.

## Environment configuration

`.env.example` contains the public `VITE_API_BASE_URL` setting and no credentials. `.env.local` is for local overrides and is ignored by Git. For a local development server, set the variable to the service API origin, such as `https://ts.idicorp.ir`.

For a production deployment behind a same-origin reverse proxy, build the front end with `VITE_API_BASE_URL` set to the front-end origin so browser API and calculator requests use the proxy. For example, in PowerShell:

```powershell
$env:VITE_API_BASE_URL = 'https://console.example.com'
npm run build
```

The production Echo relay is a separate Node process. Configure it with the upstream service API origin, the public front-end origin, and optionally a port (default `8787`), then start it:

```powershell
$env:VITE_API_BASE_URL = 'https://ts.idicorp.ir'
$env:ECHO_RELAY_ORIGIN = 'https://console.example.com'
$env:ECHO_RELAY_PORT = '8787'
npm run echo:relay
```

The relay serves no static assets. The frontend host or reverse proxy must route `/__echo/*` HTTP requests and WebSocket upgrades to this process. The ticket-creation POST and its corresponding WebSocket upgrade must reach the same relay instance. Use HTTPS in production; plain HTTP is accepted by the relay only for loopback development.

## Backend API assumptions and deployment

The front end uses the service contract described below. Deployments must provide the matching routes and cookie behavior; a static file host alone is not sufficient.

### HTTP API

- `GET /api/auth/login` returns a CAPTCHA and the salt used for the login request.
- `POST /api/auth/login` accepts `username`, `password`, `salt`, and `captcha_answer`; success returns `access_token` and `token_type`, and sets HTTP-only `session` and `task_session` cookies.
- Protected HTTP calls send the access token as a Bearer token and include cookies. Task calls require both `session` and `task_session`.
- `GET /api/tasks` lists tasks and accepts optional `q` and `completed=true|false` filters. The app also uses `GET /api/tasks/{id}`, `POST /api/tasks`, `PUT /api/tasks/{id}`, `PATCH /api/tasks/{id}`, and `DELETE /api/tasks/{id}` for task operations.
- Task objects use `id`, `title`, `description`, `completed`, `created_at`, and `updated_at`. The service limits titles to 120 characters and descriptions to 2,000 characters. Task data expires one hour after creation or its latest update.
- `POST /api/echo/stream` returns the submitted bytes as a stream. The app uses the response content type to display text or download binary data.

### WebSockets and Echo relay

- The calculator endpoint is `/ws/calculator`. The browser sends `{"token":"<access_token>"}` as its first JSON message within one second and waits for a `{"type":"ready"}` response before sending calculations.
- The text echo service endpoint is `/ws/echo`. The current frontend assumes this endpoint requires a Bearer header during the WebSocket upgrade, based on a project Postman observation. The browser WebSocket API cannot set that header, so the frontend-owned Node relay at `/__echo/*` performs a same-origin ticket exchange and adds the Bearer header upstream. The token and one-time ticket are not placed in the WebSocket URL or echo messages.
- In production, route `/ws/calculator` to the service's WebSocket endpoint and `/__echo/*` to the Node relay over the same HTTPS origin used by the app. A static-only deployment cannot provide the relay. The development Vite relay is not included in `vite preview`.

### Proxy, cookies, and streaming

The recommended deployment serves the built assets from a front-end/static host and reverse-proxies `/api/*`, `/ws/calculator`, and `/__echo/*` on that same origin. The API proxy must preserve request methods, paths, query strings, bodies, authorization headers, and session cookies. The service cookies must be scoped to the deployed host and API path so the browser can send them. Direct cross-origin API access additionally depends on the service's CORS and cookie policy; the front end cannot guarantee those settings. Disable response buffering on `/api/echo/stream` so chunks reach the browser as they arrive.

The Echo relay uses `VITE_API_BASE_URL` as its upstream API origin and `ECHO_RELAY_ORIGIN` as the allowed public front-end origin. It validates the origin and keeps temporary tickets in memory, so the POST and WebSocket upgrade for one connection must be routed to the same relay instance.

## Repository exclusions

Local environment files, installed dependencies, and generated output are excluded from Git. Keep `.env.example` as the shareable configuration template; do not commit `.env.local`, `node_modules/`, `dist/`, or production credentials.
