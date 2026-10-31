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

### 2. Configure the environment

Create `.env.local` from `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

Set the API base URL:

```env
VITE_API_BASE_URL=https://ts.idicorp.ir
```

### 3. Run the application

```bash
npm run dev
```

Open `http://localhost:5173` or the local URL displayed by Vite.

### 4. Build the application

```bash
npm run build
```

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

Text Echo uses a Node.js relay to support the service's WebSocket authentication requirements.

**API Documentation:** https://ts.idicorp.ir/docs
