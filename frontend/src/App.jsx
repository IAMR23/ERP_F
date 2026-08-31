import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import { restoreSession } from "./utils/auth";

export default function App() {
  const [session, setSession] = useState(() => restoreSession());

  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

  return (
    <Dashboard
      onLogout={() => {
        setSession(null);
      }}
      session={session}
    />
  );
}
