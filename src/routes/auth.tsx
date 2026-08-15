import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      // O Supabase Auth permite login com e-mail ou telefone.
      // Como o requisito pede Telefone/Usuário, usaremos o telefone como identificador.
      // Observação: O Supabase exige que o telefone esteja no formato E.164.
      // Vamos tentar normalizar caso falte o prefixo +55 (Brasil).
      let normalizedPhone = phone.trim();
      if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = `+55${normalizedPhone.replace(/\D/g, "")}`;
      }

      const { error } = await supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password: password,
      });

      if (error) {
        // Fallback para tentar por e-mail caso o usuário tenha inserido o e-mail no campo telefone
        const { error: emailError } = await supabase.auth.signInWithPassword({
          email: phone,
          password: password,
        });
        
        if (emailError) {
          throw new Error("Credenciais inválidas");
        }
      }

      toast.success("Login realizado com sucesso!");
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
                placeholder="11921009176"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
