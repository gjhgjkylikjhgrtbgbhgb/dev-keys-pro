import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    
    // Identificação imediata do Master Admin no loader para evitar flicker
    const MASTER_PHONE = "11921009176";
    const userPhone = (data.user as any).phone?.replace(/\D/g, "") || "";
    const isMaster = userPhone === MASTER_PHONE;

    // Buscar perfil e roles antecipadamente
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const isAdmin = isMaster || roleData?.role === "admin" || !!(profile as any)?.is_admin;

    return { 
      user: data.user,
      profile,
      isAdmin,
      isMasterAdmin: isMaster
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAdmin } = Route.useRouteContext();

  if (isAdmin === undefined || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center dark">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Verificando permissões...</p>
      </div>
    );
  }

  return <Outlet />;
}
