import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Terminal, Rocket, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sua-url.lovable.app';
  const apiUrl = `${baseUrl}/api/public/activate`;

  const curlExample = `curl -X POST ${apiUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"key": "123456"}'`;

  const dartExample = `import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> activateLicense(String key) async {
  final response = await http.post(
    Uri.parse('${apiUrl}'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'key': key}),
  );

  if (response.statusCode == 200) {
    // Conteúdo bruto retornado
    print('Conteúdo: \${response.body}');
  } else {
    print('Erro: \${response.body}');
  }
}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6 space-y-12">
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          License Pro API
        </h1>
        <p className="text-slate-400 text-lg md:text-xl">
          Sistema de ativação e gestão de licenças para Android e TV Box com entrega de conteúdo bruto.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link to="/auth">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Rocket className="mr-2 h-5 w-5" /> Acessar Painel
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-400" /> Endpoint de Ativação
            </CardTitle>
            <CardDescription className="text-slate-400">
              Documentação técnica para integração no seu aplicativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">URL do Endpoint</h3>
              <div className="bg-slate-950 p-3 rounded-md border border-slate-800 font-mono text-sm break-all text-blue-300">
                POST {apiUrl}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Estrutura Exata</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span><strong>Payload:</strong> JSON {"{ \"key\": \"123456\" }"}</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span><strong>Resposta:</strong> Conteúdo bruto original (text/plain)</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span><strong>Lógica:</strong> Valida status "active" e uses_remaining {">"} 0</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-indigo-400" /> Exemplos de Implementação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-slate-500">cURL</h3>
              <pre className="bg-slate-950 p-4 rounded-md border border-slate-800 text-xs overflow-x-auto text-indigo-300">
                {curlExample}
              </pre>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Flutter / Dart</h3>
              <pre className="bg-slate-950 p-4 rounded-md border border-slate-800 text-xs overflow-x-auto text-indigo-300 max-h-[200px] overflow-y-auto">
                {dartExample}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="text-slate-600 text-sm">
        © 2026 License Pro System. Todos os direitos reservados.
      </footer>
    </div>
  );
}



