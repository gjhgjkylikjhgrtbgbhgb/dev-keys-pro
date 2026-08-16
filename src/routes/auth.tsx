import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.trim().replace(/\D/g, "");
      const isMaster = cleanPhone === "11921009176" && password === "Robson123";

      if (isMaster) {
        const { ensureMasterAdmin } = await import("@/lib/auth.functions");
        const result = await ensureMasterAdmin({ data: { phone: cleanPhone, password } });

        if (result.ok) {
          const { error } = await supabase.auth.signInWithPassword({
            email: result.email,
            password: password,
          });
          if (error) throw error;
        } else {
          throw new Error("Falha ao sincronizar Master Admin");
        }
      } else {
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith("+")) {
          normalizedPhone = `+55${normalizedPhone.replace(/\D/g, "")}`;
        }

        const { error } = await supabase.auth.signInWithPassword({
          phone: normalizedPhone,
          password: password,
        });

        if (error) {
          const { error: emailError } = await supabase.auth.signInWithPassword({
            email: phone,
            password: password,
          });
          
          if (emailError) {
            throw new Error("Credenciais inválidas");
          }
        }
      }

      toast.success("Login realizado com sucesso!");
      
      // Salva estado de autenticação para redundância e estabilidade
      localStorage.setItem('auth_status', JSON.stringify({ 
        phone: cleanPhone, 
        role: isMaster ? 'admin' : 'reseller', 
        authenticated: true 
      }));

      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Erro ao realizar login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 dark">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Login Administrativo</CardTitle>
          <CardDescription>
            Insira suas credenciais para acessar o painel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / Usuário</Label>
              <Input
                id="phone"
                type="text"
                placeholder="DDD + Número"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                "Entrando..."
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
