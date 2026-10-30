import { useState, useSyncExternalStore } from 'react';
import LoginPage from './features/auth/LoginPage.jsx';
import { getAccessToken, removeAccessToken, subscribeToSession } from './features/auth/authSession.js';
import TasksPage from './features/tasks/TasksPage.jsx';
import CalculatorPage from './features/calculator/CalculatorPage.jsx';
import EchoPage from './features/echo/EchoPage.jsx';
import StreamingPage from './features/streaming/StreamingPage.jsx';
import AppShell from './components/AppShell.jsx';

function AuthenticatedApp({ accessToken }) {
  const [view, setView] = useState('tasks');

  return (
    <AppShell view={view} onNavigate={setView} onLogout={removeAccessToken}>
      {view === 'tasks' && <TasksPage onSignInRequired={removeAccessToken} />}
      {view === 'calculator' && <CalculatorPage accessToken={accessToken} onSignInRequired={removeAccessToken} />}
      {view === 'echo' && <EchoPage accessToken={accessToken} />}
      {view === 'streaming' && <StreamingPage onSignInRequired={removeAccessToken} />}
    </AppShell>
  );
}

export default function App() {
  const accessToken = useSyncExternalStore(subscribeToSession, getAccessToken);

  if (accessToken) {
    return <AuthenticatedApp key={accessToken} accessToken={accessToken} />;
  }

  return <LoginPage onAuthenticated={() => {}} />;
}
