import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLicenseStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    // Master vê tudo; Revendedor vê apenas as suas
    const MASTER_PHONE = "11921009176";
    const identifiers = [
      user.phone || "",
      (user.user_metadata as any)?.phone || "",
      (user.email || "").split("@")[0] || "",
    ].map(v => String(v).replace(/\D/g, ""));
    const isMaster = identifiers.includes(MASTER_PHONE);

    // Buscar perfil para verificar se é admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, credits, can_upload")
      .eq("id", user.id)
      .single();

    const isAdmin = isMaster || profile?.is_admin;

    // Contagens para os cards
    let totalCount = 0;
    let activeCount = 0;
    let assignedCount = 0;
    let unassignedCount = 0;

    if (isMaster) {
      // Master vê tudo
      const { count: total } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true });
      const { count: active } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).eq("status", "active");
      const { count: assigned } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).not("owner_id", "is", null);
      const { count: unassigned } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).is("owner_id", null);
      
      totalCount = total || 0;
      activeCount = active || 0;
      assignedCount = assigned || 0;
      unassignedCount = unassigned || 0;
    } else if (isAdmin) {
      // Sub-Admin vê apenas o que é dele ou de seus revendedores
      // 1. Configs Livres dele
      const { count: unassigned } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active");
      unassignedCount = unassigned || 0;

      // 2. Licenças Repassadas (estão com revendedores que ele cadastrou)
      const { data: myResellers } = await supabaseAdmin.from("profiles").select("id").eq("parent_id", user.id);
      const resellerIds = (myResellers || []).map(r => r.id);
      
      if (resellerIds.length > 0) {
        const { count: assigned } = await supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).in("owner_id", resellerIds);
        assignedCount = assigned || 0;
      }
    }

    return {
      total: totalCount,
      active: activeCount,
      assigned: assignedCount,
      unassigned: unassignedCount,
      credits: profile?.credits || 0
    };
  });

export const getLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const MASTER_PHONE = "11921009176";
    const identifiers = [
      user.phone || "",
      (user.user_metadata as any)?.phone || "",
      (user.email || "").split("@")[0] || "",
    ].map(v => String(v).replace(/\D/g, ""));
    const isMaster = identifiers.includes(MASTER_PHONE);

    let query = supabaseAdmin
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false });

    // Master vê tudo; qualquer outro usuário (sub-admin ou revendedor) vê apenas as suas
    if (!isMaster) {
      query = query.eq("owner_id", user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    const licenses = data || [];

    const ownerIds = [...new Set(licenses.map(l => l.owner_id).filter(Boolean))] as string[];
    let ownersMap = new Map<string, { full_name: string | null }>();

    if (ownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const MASTER_PHONE = "11921009176";
    const identifiers = [
      user.phone || "",
      (user.user_metadata as any)?.phone || "",
      (user.email || "").split("@")[0] || "",
    ].map(v => String(v).replace(/\D/g, ""));
    const isMaster = identifiers.includes(MASTER_PHONE);

    // Usamos o client admin para garantir a leitura completa (evita bloqueio de RLS),
    // mas o escopo é decidido no servidor conforme a hierarquia do usuário.
    let query = supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (isMaster) {
      // Master vê todos, exceto ele mesmo
      query = query.neq("id", user.id);
    } else {
      // Sub-Admin vê apenas seus vinculados
      query = query.eq("parent_id", user.id);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    // Nunca expor o Master Admin na listagem
    return (profiles || []).filter(p => {
      const phone = (p.phone || "").replace(/\D/g, "");
      return phone !== MASTER_PHONE;
    });
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
    parent_id: z.string().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;
    const { phone, password, full_name, whatsapp, credits = 0, parent_id = null } = data;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const userPhone = user.phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === "11921009176";
    // Usar o parent_id vindo do frontend ou decidir pelo contexto
    const finalParentId = parent_id !== undefined ? parent_id : (isMaster ? null : user.id);

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
        parent_id: finalParentId,
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
    const { supabase } = context;
    const { resellerId, amount } = data;

    const { data: { user: sender } } = await supabase.auth.getUser();
    if (!sender) throw new Error("Não autorizado");

    // 1. Chamar RPC segura que valida saldo
    const { error: rpcError } = await supabaseAdmin.rpc("transfer_credits_safe", {
      sender_id: sender.id,
      receiver_id: resellerId,
      transfer_amount: amount
    });

    if (rpcError) {
      console.error("RPC transfer_credits_safe error:", rpcError);
      throw new Error(rpcError.message || "Falha na transferência de créditos.");
    }

    // 2. Tentar vincular licenças físicas se for o Master
    const userPhone = sender.phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === "11921009176";

    if (isMaster) {
      const { data: availableLicenses } = await supabaseAdmin
        .from("licenses")
        .select("id")
        .is("owner_id", null)
        .eq("status", "active")
        .limit(amount);

      if (availableLicenses && availableLicenses.length >= amount) {
        await supabaseAdmin
          .from("licenses")
          .update({ owner_id: resellerId })
          .in("id", availableLicenses.map(l => l.id));
      }
    } else {
      // Se for Sub-Admin, ele transfere o saldo dele para o revendedor
      // As licenças físicas dele (owner_id = sub_admin.id) passam para o revendedor
      const { data: subAdminLicenses } = await supabaseAdmin
        .from("licenses")
        .select("id")
        .eq("owner_id", sender.id)
        .eq("status", "active")
        .limit(amount);

      if (subAdminLicenses && subAdminLicenses.length > 0) {
        await supabaseAdmin
          .from("licenses")
          .update({ owner_id: resellerId })
          .in("id", subAdminLicenses.map(l => l.id));
      }
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

export const getUnassignedLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const MASTER_PHONE = "11921009176";
    const userPhone = user.phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === MASTER_PHONE;
    
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = isMaster || profile?.is_admin;
    if (!isAdmin) throw new Error("Acesso negado");

    let query = supabaseAdmin.from("licenses").select("*").order("created_at", { ascending: false });

    if (isMaster) {
      // Master Admin: busca licenças sem dono ou com status de estoque livre
      // Garantimos que 'owner_id is null' capture o estoque global
      query = query.or('owner_id.is.null,status.eq.livre,status.eq.disponivel,status.eq.available,status.eq.active');
    } else {
      // Sub-Admin: busca configs atribuídas a ele que ainda estão livres para repassar
      query = query
        .eq('owner_id', user.id)
        .or('status.eq.livre,status.eq.disponivel,status.eq.available,status.eq.active');
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erro na query de licenças livres:", error);
      throw error;
    }
    return data || [];
  });

export const assignLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    licenseId: z.string(),
    resellerId: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context;
    const { licenseId, resellerId } = data;

    const { data: { user: sender } } = await supabase.auth.getUser();
    if (!sender) throw new Error("Não autorizado");

    const MASTER_PHONE = "11921009176";
    const userPhone = sender.phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === MASTER_PHONE;

    const { data: license } = await supabaseAdmin
      .from("licenses")
      .select("*")
      .eq("id", licenseId)
      .single();

    if (!license) throw new Error("Licença não encontrada");
    if (!isMaster && license.owner_id !== sender.id) {
      throw new Error("Você não tem permissão para atribuir esta licença");
    }

    const { error: updateError } = await supabaseAdmin
      .from("licenses")
      .update({ owner_id: resellerId })
      .eq("id", licenseId);

    if (updateError) throw updateError;

    if (!isMaster) {
      await supabaseAdmin.rpc("transfer_credits_safe", {
        sender_id: sender.id,
        receiver_id: resellerId,
        transfer_amount: 1
      });
    } else {
      await supabaseAdmin.rpc("increment_credits", {
        row_id: resellerId,
        amount: 1
      });
    }

    return { success: true };
  });

export const updateUploadPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    userId: z.string(),
    canUpload: z.boolean(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ can_upload: data.canUpload })
      .eq("id", data.userId);

    if (error) throw error;
    return { success: true };
  });

export const deleteLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    licenseId: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { licenseId } = data;

    const { error } = await supabaseAdmin
      .from("licenses")
      .delete()
      .eq("id", licenseId);

    if (error) throw error;
    return { success: true };
  });

const createLicensesSchema = z.object({
  licenses: z.array(z.object({
    key: z.string().length(6),
    filename: z.string(),
    content: z.string(),
  }))
});
