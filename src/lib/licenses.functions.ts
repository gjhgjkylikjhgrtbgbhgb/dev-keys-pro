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
    
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .neq("phone", MASTER_PHONE);

    if (profileError) throw profileError;
    
    // Filtramos apenas aqueles que têm a role 'reseller' no user_roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "reseller");
    
    const resellerIds = new Set((roles || []).map(r => r.user_id));
    
    return (profiles || []).filter(p => resellerIds.has(p.id));
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

    // 1. Desvincular ou deletar licenças
    await supabaseAdmin
      .from("licenses")
      .delete()
      .eq("owner_id", userId);

    // 2. Deletar roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // 3. Deletar perfil
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    // 4. Deletar do Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Auth deletion error:", authError);
      // Mesmo que o auth falhe (ex: usuário já removido), consideramos sucesso se o perfil foi removido
    }

    return { success: true };
  });

export const createReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    phone: z.string(),
    password: z.string(),
    full_name: z.string(),
    whatsapp: z.string().optional(),
    credits: z.number().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phone, password, full_name, whatsapp, credits = 0 } = data;

    if (!phone || !password || !full_name) {
      throw new Error("Campos obrigatórios ausentes");
    }

    const cleanLogin = phone.trim().replace(/\D/g, "");
    const email = `${cleanLogin}@painel.local`;

    // Tenta encontrar se já existe no auth via admin para evitar erro de duplicidade
    const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
    const foundUser = listUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    let userId: string;

    if (foundUser) {
      userId = foundUser.id;
    } else {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name, whatsapp, phone: cleanLogin }
      });

      if (authError) throw authError;
      userId = authUser.user.id;
    }

    // Garante a role de reseller (upsert para evitar erros se já existir)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "reseller" }, { onConflict: 'user_id,role' });
    
    if (roleError) throw roleError;

    // Garante o perfil completo (upsert)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        phone: cleanLogin,
        full_name,
        credits: credits,
        is_blocked: false,
        is_admin: false,
        support_whatsapp: whatsapp || "",
        last_seen: new Date().toISOString()
      } as any, { onConflict: 'id' });

    if (profileError) throw profileError;

    // Se houver créditos iniciais, vincular licenças se disponíveis
    if (credits > 0) {
      try {
        const { data: availableLicenses } = await supabaseAdmin
          .from("licenses")
          .select("id")
          .is("owner_id", null)
          .eq("status", "active")
          .limit(credits);
        
        if (availableLicenses && availableLicenses.length > 0) {
          await supabaseAdmin
            .from("licenses")
            .update({ owner_id: userId })
            .in("id", availableLicenses.map(l => l.id));
        }
      } catch (e) {
        console.error("Erro ao transferir créditos iniciais:", e);
      }
    }

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resellerId, amount } = data;

    // 1. Buscar licenças disponíveis (livres e ativas)
    const { data: availableLicenses, error: fetchError } = await supabaseAdmin
      .from("licenses")
      .select("id")
      .is("owner_id", null)
      .eq("status", "active")
      .limit(amount);

    if (fetchError) throw fetchError;
    if (!availableLicenses || availableLicenses.length < amount) {
      throw new Error(`Estoque insuficiente de licenças livres. Disponível: ${availableLicenses?.length || 0}`);
    }

    const licenseIds = availableLicenses.map(l => l.id);

    // 2. Vincular as licenças ao revendedor
    const { error: updateError } = await supabaseAdmin
      .from("licenses")
      .update({ owner_id: resellerId })
      .in("id", licenseIds);

    if (updateError) throw updateError;

    // 3. Incrementar créditos no perfil usando o RPC com service_role
    const { error: profileError } = await supabaseAdmin.rpc("increment_credits", {
      row_id: resellerId,
      amount: amount
    });

    if (profileError) {
      console.error("RPC increment_credits error:", profileError);
      // Fallback: update direto se o RPC falhar ou não for encontrado
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", resellerId)
        .single();
      
      const newCredits = (currentProfile?.credits || 0) + amount;
      
      const { error: updateCreditsError } = await supabaseAdmin
        .from("profiles")
        .update({ credits: newCredits } as any)
        .eq("id", resellerId);
        
      if (updateCreditsError) throw updateCreditsError;
    }

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
