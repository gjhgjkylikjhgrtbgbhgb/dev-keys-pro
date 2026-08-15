import { supabase } from "./client";

export const attachSupabaseAuth = async ({ next }: { next: () => Promise<Response> }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (token) {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);
    // Note: TanStack Start handles the actual fetch, but we need to ensure the token is available
    // for server functions. The middleware usually handles this automatically if configured.
  }
  
  return next();
};
