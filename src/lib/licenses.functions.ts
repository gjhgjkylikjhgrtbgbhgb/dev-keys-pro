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
    return data;
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

const createLicensesSchema = z.object({
  licenses: z.array(z.object({
    key: z.string().length(6),
    filename: z.string(),
    content: z.string(),
  }))
});
