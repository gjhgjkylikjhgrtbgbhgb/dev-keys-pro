import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { 
  getLicenseStats, 
  getLicenses, 
  createLicenses, 
  getResellers, 
  createReseller, 
  updateProfileStatus, 
  transferLicenses 
} from "@/lib/licenses.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { 
  Copy, Upload, CheckCircle2, XCircle, Clock, Database, 
  Users, UserPlus, Phone, Lock, Unlock, Send, MessageSquare 
} from "lucide-react";
import { format } from "date-fns";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statsQueryOptions = queryOptions({
  queryKey: ["license-stats"],
  queryFn: () => getLicenseStats(),
});

const licensesQueryOptions = queryOptions({
  queryKey: ["licenses"],
  queryFn: () => getLicenses(),
});

const resellersQueryOptions = queryOptions({
  queryKey: ["resellers"],
  queryFn: () => getResellers(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(statsQueryOptions),
      context.queryClient.ensureQueryData(licensesQueryOptions),
      context.queryClient.ensureQueryData(resellersQueryOptions),
    ]);
  },
  component: DashboardPage,
});

function DashboardPage() {
  const statsQuery = useSuspenseQuery(statsQueryOptions);
  const licensesQuery = useSuspenseQuery(licensesQueryOptions);
  const resellersQuery = useSuspenseQuery(resellersQueryOptions);
  
  const createLicensesFn = useServerFn(createLicenses);
  const createResellerFn = useServerFn(createReseller);
  const updateStatusFn = useServerFn(updateProfileStatus);
  const transferFn = useServerFn(transferLicenses);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resellerForm, setResellerForm] = useState({ phone: "", password: "", full_name: "" });
  const [transferData, setTransferData] = useState({ resellerId: "", amount: 1 });
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Fallback data para evitar quebras se a query retornar undefined/null
  const stats = statsQuery.data || { total: 0, active: 0 };
  const licenses = licensesQuery.data || [];
  const resellers = resellersQuery.data || [];

  // Verificar se o usuário é admin
  useSuspenseQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();
          setIsAdmin(data?.role === "admin");
        }
      } catch (err) {
        console.error("Erro ao verificar admin:", err);
      }
      return true;
    }
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const newLicenses = await Promise.all(
        acceptedFiles.map(async (file) => {
          const content = await file.text();
          const key = Math.floor(100000 + Math.random() * 900000).toString();
          return { key, filename: file.name, content };
        })
      );
      await createLicensesFn({ data: { licenses: newLicenses } });
      toast.success(`${newLicenses.length} licenças geradas!`);
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao processar arquivos.");
    } finally {
      setIsProcessing(false);
    }
  }, [createLicensesFn]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/octet-stream': ['.config'] }
  });

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createResellerFn({ data: resellerForm });
      toast.success("Revendedor cadastrado!");
      setResellerForm({ phone: "", password: "", full_name: "" });
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao cadastrar revendedor.");
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      await updateStatusFn({ data: { userId, isBlocked: !currentStatus } });
      toast.success(currentStatus ? "Desbloqueado!" : "Bloqueado!");
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleTransfer = async () => {
    try {
      await transferFn({ data: transferData });
      toast.success("Licenças transferidas!");
      setIsTransferOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro na transferência.");
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.info("Chave copiada!");
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-8 dark">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Bem-vindo à gestão centralizada.</p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}>
          Sair
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revendedores</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resellers.length}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="licenses" className="w-full">
        <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="licenses" className="px-6 py-2">Licenças</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="resellers" className="px-6 py-2">Revendedores</TabsTrigger>
          )}
          <TabsTrigger value="upload" className="px-6 py-2">Gerar Licenças</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Estoque de Licenças</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave</TableHead>
                    <TableHead>Arquivo</TableHead>
                    {isAdmin && <TableHead>Dono</TableHead>}
                    <TableHead>Usos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((license: any) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-mono font-bold">{license.key}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{license.filename}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {license.owner?.full_name || <Badge variant="outline">Livre</Badge>}
                        </TableCell>
                      )}
                      <TableCell>{license.uses_remaining}/3</TableCell>
                      <TableCell>
                        <Badge variant={license.status === "active" ? "default" : "destructive"}>
                          {license.status === "active" ? "Ativo" : "Esgotado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(license.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(license.key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="resellers" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" /> Novo Revendedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateReseller} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input 
                        value={resellerForm.full_name}
                        onChange={e => setResellerForm({...resellerForm, full_name: e.target.value})}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input 
                        value={resellerForm.phone}
                        onChange={e => setResellerForm({...resellerForm, phone: e.target.value})}
                        placeholder="11921009176" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha Inicial</Label>
                      <Input 
                        type="password"
                        value={resellerForm.password}
                        onChange={e => setResellerForm({...resellerForm, password: e.target.value})}
                        required 
                      />
                    </div>
                    <Button type="submit" className="w-full">Cadastrar</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Gestão de Acessos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Revendedor</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resellers.map((reseller: any) => (
                        <TableRow key={reseller.id}>
                          <TableCell className="font-medium">{reseller.full_name}</TableCell>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto gap-1" onClick={() => openWhatsApp(reseller.phone)}>
                              <MessageSquare className="h-3 w-3" /> {reseller.phone}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              {reseller.license_inventory} unid.
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {reseller.is_blocked ? (
                              <Badge variant="destructive">Bloqueado</Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-500/10 text-green-500">Ativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setTransferData({ ...transferData, resellerId: reseller.id });
                                setIsTransferOpen(true);
                              }}
                            >
                              <Send className="h-3 w-3 mr-1" /> Transferir
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleToggleBlock(reseller.id, reseller.is_blocked)}
                            >
                              {reseller.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4 text-destructive" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="upload" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Upload em Lote</CardTitle>
              <CardDescription>Apenas o Admin Master pode gerar novas licenças para o estoque geral.</CardDescription>
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
                {isProcessing ? <p>Processando...</p> : <p>Solte arquivos .txt ou .config aqui</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Licenças</DialogTitle>
            <DialogDescription>
              Retire do estoque livre e envie para o revendedor selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input 
                type="number" 
                min="1" 
                value={transferData.amount}
                onChange={e => setTransferData({...transferData, amount: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransfer}>Confirmar Envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
