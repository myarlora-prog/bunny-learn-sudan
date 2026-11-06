import { createFileRoute, redirect } from "@tanstack/react-router";

// The home page was removed; the Library is the default page.
export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    throw redirect({ to: "/curriculum", replace: true });
  },
});
