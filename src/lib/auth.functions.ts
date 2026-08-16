import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const MASTER_PHONE = "11921009176";
export const MASTER_PASSWORD = "Robson123";

export function phoneToEmail(phone: string) {
  const digits = phone.trim().replace(/\D/g, "");
  return `${digits}@app.local`;
}

/**
 * Garante que a conta Master Admin exista com a senha correta.
 * Idempotente: cria o usuário se não existir, ou redefine a senha se existir.
 */
export const ensureMasterAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string(), password: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    if (data.phone.replace(/\D/g, "") !== MASTER_PHONE || data.password !== MASTER_PASSWORD) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = phoneToEmail(MASTER_PHONE);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let user = list?.users?.find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: MASTER_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Admin Master", phone: MASTER_PHONE },
      });
      if (error) throw error;
      user = created.user;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: MASTER_PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { 
          id: user!.id, 
          phone: MASTER_PHONE, 
          full_name: "Admin Master", 
          is_blocked: false,
          is_admin: true
        } as any,
        { onConflict: "id" },
      );

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user!.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: user!.id, role: "admin" });
    }

    return { ok: true as const, email };
  });
