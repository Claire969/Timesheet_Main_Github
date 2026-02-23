import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const applySession = (s: Session | null) => {
      if (!alive) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    const init = async () => {
      console.log("[auth] init getSession()");
      const hardTimeout = setTimeout(() => {
        if (!alive) return;
        console.warn("[auth] getSession timeout -> stop loading");
        setLoading(false);
      }, 8000);

      try {
        const { data, error } = await supabase.auth.getSession();
        clearTimeout(hardTimeout);
        if (error) console.error("[auth] getSession error:", error);
        console.log("[auth] getSession ok, user:", data.session?.user?.email ?? null);
        applySession(data.session ?? null);
      } catch (e) {
        clearTimeout(hardTimeout);
        console.error("[auth] getSession threw:", e);
        if (alive) setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[auth] onAuthStateChange:", event, "user:", s?.user?.email ?? null);
      applySession(s ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
