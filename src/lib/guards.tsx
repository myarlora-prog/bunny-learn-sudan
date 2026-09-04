import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/app-state";

/** Redirects to the sign-in screen when there is no authenticated session. */
export function useRequireAuth() {
  const { session, hydrated } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (hydrated && !session) void navigate({ to: "/auth", replace: true });
  }, [hydrated, session, navigate]);
  return { session, hydrated };
}

/** Redirects non-admin users home. Admin status comes from the database. */
export function useRequireAdmin() {
  const { session, isAdmin, hydrated } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!hydrated) return;
    if (!session) void navigate({ to: "/auth", replace: true });
    else if (!isAdmin) void navigate({ to: "/home", replace: true });
  }, [hydrated, session, isAdmin, navigate]);
  return { isAdmin, hydrated };
}
