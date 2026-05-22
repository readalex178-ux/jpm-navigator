import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  status: "loading" | "authed" | "unauthed";
  user: User | null;
  session: Session | null;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    session: null,
  });

  useEffect(() => {
    // Set up listener FIRST, then read session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        status: session ? "authed" : "unauthed",
        user: session?.user ?? null,
        session,
      });
    });

    supabase.auth.getSession().then(({ data }) => {
      setState({
        status: data.session ? "authed" : "unauthed",
        user: data.session?.user ?? null,
        session: data.session,
      });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
