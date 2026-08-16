import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const MASTER_PHONE = "11921009176";
        const userPhone = (user as any).phone?.replace(/\D/g, "") || "";
        
        // Immediate check for master admin via phone or metadata
        const isActuallyMaster = userPhone === MASTER_PHONE || 
                                (user as any).user_metadata?.phone?.replace(/\D/g, "") === MASTER_PHONE;


        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);
        setIsAdmin(isActuallyMaster || roleData?.role === "admin" || !!(profileData as any)?.is_admin);
      } catch (err) {
        console.error("Error loading authenticated context:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center dark">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Carregando permissões...</p>
      </div>
    );
  }

  return <Outlet /> ;
}
