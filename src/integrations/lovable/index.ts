import { supabase } from "../supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: 'google', options: { redirect_uri: string }) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options.redirect_uri,
        },
      });
      if (error) throw error;
    },
  },
};
