import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }: { next: any }) => {
  await supabase.auth.getSession();
  return next();
});
