import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware().client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (token) {
    // O TanStack Start usará o token da sessão se configurado corretamente
  }
  return next();
});
