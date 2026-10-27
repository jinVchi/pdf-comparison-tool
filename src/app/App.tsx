import { useCallback, useEffect, useState } from "react";
import HomePage from "../auth/HomePage";
import { initialize, SESSION_EXPIRED_EVENT } from "../shared/api";
import type { Session } from "../shared/api";
import Workspace from "./Workspace";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const refreshSession = useCallback(async () => {
    setChecking(true);
    setSession(null);
    try {
      setSession(await initialize());
      setConnectionError("");
    } catch (e) {
      setConnectionError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
    const expired = () => { void refreshSession(); };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, [refreshSession]);

  useEffect(() => {
    if (checking) return;
    let cancelled = false;
    const accountId = session?.user?.id;
    function checkIdentity() {
      if (document.visibilityState === "hidden") return;
      void initialize().then((current) => {
        if (!cancelled && accountId !== current.user?.id) setSession(current);
      }).catch(() => { /* A later action or reconnect will show network errors. */ });
    }
    window.addEventListener("focus", checkIdentity);
    document.addEventListener("visibilitychange", checkIdentity);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", checkIdentity);
      document.removeEventListener("visibilitychange", checkIdentity);
    };
  }, [checking, session?.user?.id]);

  if (checking || !session?.user)
    return <HomePage ready={!checking && session !== null} checking={checking}
      error={connectionError} retry={() => void refreshSession()} />;
  return <Workspace key={session.user.id} user={session.user} />;
}

export default App;
