import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getLicenseStats, getLicenses, createLicenses } from "@/lib/licenses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Copy, Upload, CheckCircle2, XCircle, Clock, Database } from "lucide-react";
import { format } from "date-fns";
import { queryOptions } from "@tanstack/react-query";

const statsQueryOptions = queryOptions({
  queryKey: ["license-stats"],
  queryFn: () => getLicenseStats(),
});

const licensesQueryOptions = queryOptions({
  queryKey: ["licenses"],
  queryFn: () => getLicenses(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(statsQueryOptions),
      context.queryClient.ensureQueryData(licensesQueryOptions),
    ]);
  },
  component: DashboardPage,
});

function DashboardPage() {
  const statsQuery = useSuspenseQuery(statsQueryOptions);
  const licensesQuery = useSuspenseQuery(licensesQueryOptions);
  const createLicensesFn = useServerFn(createLicenses);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsProcessing(true);
    try {
      const newLicenses = await Promise.all(
        acceptedFiles.map(async (file) => {
          const content = await file.text();
          const key = Math.floor(100000 + Math.random() * 900000).toString();
          return {
            key,
            filename: file.name,
            content,
          };
        })
      );

      await createLicensesFn({ data: { licenses: newLicenses } });
      toast.success(`${newLicenses.length} licenças geradas com sucesso!`);
      // Invalidação manual simplificada para o exemplo
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error("Falha ao processar arquivos.");
    } finally {
      setIsProcessing(false);
    }
  }, [createLicensesFn]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/octet-stream': ['.config']
    }
  });

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.info("Chave copiada!");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-8 dark">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gestão de licenças e ativações.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Licenças</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.data.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.data.active}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Upload em Lote</CardTitle>
          <CardDescription>Arraste arquivos .txt ou .config para gerar licenças automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isProcessing ? (
              <p>Processando e gerando licenças...</p>
            ) : isDragActive ? (
              <p>Solte os arquivos aqui...</p>
            ) : (
              <p>Clique ou arraste arquivos aqui para processar</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Lista de Licenças</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licensesQuery.data.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-mono font-bold text-lg">{license.key}</TableCell>
                  <TableCell>{license.filename}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${(license.uses_remaining / 3) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {license.uses_remaining}/3
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {license.status === "active" ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Esgotado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {license.created_at && format(new Date(license.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(license.key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {licensesQuery.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma licença encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
