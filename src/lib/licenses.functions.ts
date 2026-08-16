import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLicenseStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { count: total, error: totalError } = await supabase
      .from("licenses")
      .select("*", { count: "exact", head: true });

    const { count: active, error: activeError } = await supabase
      .from("licenses")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (totalError || activeError) {
      throw new Error("Falha ao buscar estatísticas");
    }

    return {
      total: total || 0,
      active: active || 0,
    };
  });

export const getLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const licenses = data || [];

    const ownerIds = [...new Set(licenses.map(l => l.owner_id).filter(Boolean))] as string[];
    let ownersMap = new Map<string, { full_name: string | null }>();

    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      ownersMap = new Map((owners || []).map(o => [o.id, { full_name: o.full_name }]));
    }

    return licenses.map(l => ({
      ...l,
      owner: l.owner_id ? ownersMap.get(l.owner_id) ?? null : null,
    }));
  });

export const createLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof createLicensesSchema>) => createLicensesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { licenses } = data;

    const { data: inserted, error } = await supabase
      .from("licenses")
      .insert(licenses.map(l => ({
        ...l,
        uses_remaining: 3,
        status: "active"
      })))
      .select();

    if (error) throw error;
    return inserted;
  });

export const getResellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    
    const MASTER_PHONE = "+5511921009176";
    
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "reseller");

    if (rolesError) throw rolesError;

    const ids = (roles || []).map(r => r.user_id);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids)
      .neq("phone", MASTER_PHONE);

    if (error) throw error;
    return data || [];
  });

export const deleteReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    userId: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = data;

    // Não permitir deletar o master
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .single();

    if (profile?.phone === "+5511921009176") {
      throw new Error("Não é possível excluir o administrador master");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return { success: true };
  });

export const createReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    phone: z.string(),
    password: z.string(),
    full_name: z.string(),
    whatsapp: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phone, password, full_name, whatsapp } = data;

    if (!phone || !password || !full_name) {
      throw new Error("Campos obrigatórios ausentes");
    }

    let normalizedPhone = phone.trim();
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = `+55${normalizedPhone.replace(/\D/g, "")}`;
    }

    // Tenta encontrar se já existe para dar erro amigável
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingProfiles) {
      throw new Error("Já existe um revendedor com este telefone");
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: normalizedPhone,
      password: password,
      phone_confirm: true,
      user_metadata: { full_name, whatsapp }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        throw new Error("Este telefone já está registrado no sistema");
      }
      throw authError;
    }


    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUser.user.id, role: "reseller" });

    if (roleError) throw roleError;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        phone: normalizedPhone,
        full_name,
        credits: 0,
        is_blocked: false,
        is_admin: false,
        support_whatsapp: data.whatsapp || "",
        last_seen: new Date().toISOString()
      } as any);

    if (profileError) throw profileError;

    return { success: true };
  });

export const updateProfileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    userId: z.string(),
    isBlocked: z.boolean(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: data.isBlocked })
      .eq("id", data.userId);

    if (error) throw error;
    return { success: true };
  });

export const transferLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    resellerId: z.string(),
    amount: z.number().positive(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { resellerId, amount } = data;

    const { data: availableLicenses, error: fetchError } = await supabase
      .from("licenses")
      .select("id")
      .is("owner_id", null)
      .eq("status", "active")
      .limit(amount);

    if (fetchError) throw fetchError;
    if (!availableLicenses || availableLicenses.length < amount) {
      throw new Error("Estoque insuficiente de licenças livres");
    }

    const licenseIds = availableLicenses.map(l => l.id);

    const { error: updateError } = await supabase
      .from("licenses")
      .update({ owner_id: resellerId })
      .in("id", licenseIds);

    if (updateError) throw updateError;

    const { error: profileError } = await supabase.rpc("increment_inventory", {
      row_id: resellerId,
      amount: amount
    });

    if (profileError) throw profileError;

    // Também atualiza a coluna credits para manter sincronia
    await (supabase as any).rpc("increment_credits", {
      row_id: resellerId,
      amount: amount
    });

    return { success: true };
  });

export const toggleAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    userId: z.string(),
    isAdmin: z.boolean(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_admin: data.isAdmin } as any)
      .eq("id", data.userId);

    if (error) throw error;
    return { success: true };
  });

export const updateSupportWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    userId: z.string(),
    whatsapp: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ support_whatsapp: data.whatsapp } as any)
      .eq("id", data.userId);

    if (error) throw error;
    return { success: true };
  });

export const deleteExhaustedLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Não autorizado");

    // Identifica se é o Master Admin pelo telefone
    const MASTER_PHONE = "11921009176";
    const userPhone = user.phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === MASTER_PHONE;

    let query = supabase.from("licenses").delete();

    if (isMaster) {
      // Master deleta todas as esgotadas do sistema
      query = query.or("uses_remaining.lte.0,status.eq.exhausted");
    } else {
      // Revendedor deleta apenas as suas esgotadas
      query = query
        .eq("owner_id", user.id)
        .or("uses_remaining.lte.0,status.eq.exhausted");
    }

    const { error } = await query;

    if (error) throw error;
    return { success: true };
  });

export const updateLastSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() } as any)
        .eq("id", user.id);
    }
    return { success: true };
  });

const createLicensesSchema = z.object({
  licenses: z.array(z.object({
    key: z.string().length(6),
    filename: z.string(),
    content: z.string(),
  }))
});
