import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { 
  getLicenseStats, 
  getLicenses, 
  createLicenses, 
  getResellers, 
  createReseller, 
  updateProfileStatus, 
  transferLicenses,
  toggleAdminStatus,
  updateLastSeen,
  deleteExhaustedLicenses
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
  Users, UserPlus, Phone, Lock, Unlock, Send, MessageSquare, ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statsQueryOptions = queryOptions({
  queryKey: ["license-stats"],
  queryFn: async () => {
    try {
      return await getLicenseStats();
    } catch (error) {
      console.error("Stats error:", error);
      return { total: 0, active: 0 };
    }
  },
});

const licensesQueryOptions = queryOptions({
  queryKey: ["licenses"],
  queryFn: async () => {
    try {
      return await getLicenses();
    } catch (error) {
      console.error("Licenses error:", error);
      return [];
    }
  },
});

const resellersQueryOptions = queryOptions({
  queryKey: ["resellers"],
  queryFn: async () => {
    try {
      return await getResellers();
    } catch (error) {
      console.error("Resellers error:", error);
      return [];
    }
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    try {
      await Promise.allSettled([
        context.queryClient.ensureQueryData(statsQueryOptions),
        context.queryClient.ensureQueryData(licensesQueryOptions),
        context.queryClient.ensureQueryData(resellersQueryOptions),
      ]);
    } catch (e) {
      console.error("Loader failed, continuing to component", e);
    }
    return {};
  },
  component: DashboardPage,
  errorComponent: ({ error }) => {
    console.error("Dashboard error boundary:", error);
    return <DashboardPage />;
  }
});

function DashboardPage() {
  const statsQuery = useSuspenseQuery(statsQueryOptions);
  const licensesQuery = useSuspenseQuery(licensesQueryOptions);
  const resellersQuery = useSuspenseQuery(resellersQueryOptions);
  
  const createLicensesFn = useServerFn(createLicenses);
  const createResellerFn = useServerFn(createReseller);
  const updateStatusFn = useServerFn(updateProfileStatus);
  const transferFn = useServerFn(transferLicenses);
  const toggleAdminFn = useServerFn(toggleAdminStatus);
  const updateLastSeenFn = useServerFn(updateLastSeen);
  const deleteExhaustedFn = useServerFn(deleteExhaustedLicenses);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resellerForm, setResellerForm] = useState({ phone: "", password: "", full_name: "", whatsapp: "" });
  const [transferData, setTransferData] = useState({ resellerId: "", amount: 1 });
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Fallback data para evitar quebras se a query retornar undefined/null
  const stats = statsQuery.data || { total: 0, active: 0 };
  const licenses = licensesQuery.data || [];
  const resellers = resellersQuery.data || [];

  // Verificar se o usuário é admin
  useSuspenseQuery({
    queryKey: ["current-user-data"],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();
            
          setCurrentUser(profile);
          
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();
            
          setIsAdmin(roleData?.role === "admin" || !!(profile as any)?.is_admin);
          
          // Atualiza last_seen
          updateLastSeenFn();
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
    const MAX_SIZE = 212 * 1024; // 212 KB
    
    try {
      const itemsToInsert = [];
      
      for (const file of acceptedFiles) {
        try {
          if (file.size > MAX_SIZE) {
            toast.warning(`Arquivo ${file.name} ignorado: excede 212 KB`);
            continue;
          }

          const fileText = await file.text();
          const key = Math.floor(100000 + Math.random() * 900000).toString();
          
          itemsToInsert.push({
            key,
            filename: file.name,
            content: fileText
          });
        } catch (fileError: any) {
          console.error(`Erro ao ler arquivo ${file.name}:`, fileError);
          toast.error(`Erro no arquivo ${file.name}: ${fileError?.message || "Erro de leitura"}`);
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("licenses")
          .insert(itemsToInsert.map(l => ({
            ...l,
            uses_remaining: 3,
            status: "active"
          })));

        if (insertError) throw insertError;

        toast.success(`${itemsToInsert.length} licenças geradas com sucesso!`);
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Erro exato do upload:", error);
      const errorMsg = error?.message || "Erro desconhecido durante o upload";
      toast.error(`Falha no upload: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [createLicensesFn]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
    noKeyboard: false,
    accept: {
      '*/*': []
    }
  });

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createResellerFn({ data: resellerForm });
      toast.success("Revendedor cadastrado!");
      setResellerForm({ phone: "", password: "", full_name: "", whatsapp: "" });
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

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    try {
      await toggleAdminFn({ data: { userId, isAdmin: !currentAdmin } });
      toast.success(!currentAdmin ? "Promovido a Admin!" : "Removido status de Admin!");
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao alterar privilégios.");
    }
  };

  const handleDeleteExhausted = async () => {
    try {
      await deleteExhaustedFn();
      toast.success("Licenças esgotadas removidas!");
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao remover licenças.");
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? "Painel Administrativo" : "Painel do Revendedor"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Bem-vindo à gestão centralizada da rede." : `Olá, ${currentUser?.full_name || "Revendedor"}. Gerencie suas licenças.`}
          </p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}>
          Sair
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Geral</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Licenças cadastradas no sistema</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Créditos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser?.credits || 0}</div>
            <p className="text-xs text-muted-foreground">Disponíveis para uso</p>
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
              <p className="text-xs text-muted-foreground">Gestão de Sub-Admins e Revendedores</p>
            </CardContent>
          </Card>
        )}
      </div>

      {currentUser?.credits === 0 && !isAdmin && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-8 rounded-lg text-center animate-pulse">
          <h2 className="text-2xl font-bold mb-2">Renove seus créditos</h2>
          <p>Você não possui licenças disponíveis em seu saldo.</p>
        </div>
      )}

      {currentUser?.is_blocked && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive">
            <CardHeader className="text-center">
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                <XCircle className="h-6 w-6" /> Acesso Bloqueado
              </CardTitle>
              <CardDescription>
                Sua conta está temporariamente suspensa. Entre em contato com o suporte.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {currentUser.support_whatsapp && (
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => openWhatsApp(currentUser.support_whatsapp)}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Falar com Suporte
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Estoque de Licenças</CardTitle>
                <CardDescription>Gerencie suas licenças e remova as já esgotadas.</CardDescription>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDeleteExhausted}>
                <XCircle className="h-4 w-4 mr-2" /> Apagar Licenças Usadas
              </Button>
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
                  {licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">
                        Nenhuma licença encontrada.
                      </TableCell>
                    </TableRow>
                  ) : licenses
                    .filter((l: any) => isAdmin || l.owner_id === currentUser?.id)
                    .map((license: any) => (
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
                      <div className="space-y-2">
                        <Label>WhatsApp (Suporte)</Label>
                        <Input 
                          value={resellerForm.whatsapp}
                          onChange={e => setResellerForm({...resellerForm, whatsapp: e.target.value})}
                          placeholder="Ex: 5511999999999" 
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
                        <TableHead>Visto por último</TableHead>
                        <TableHead>Saldo [Usadas/Total]</TableHead>
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
                          <TableCell className="text-xs text-muted-foreground">
                            {reseller.last_seen ? format(new Date(reseller.last_seen), "dd/MM HH:mm") : "Nunca"}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              {reseller.credits || 0} unid.
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {reseller.is_blocked ? (
                                <Badge variant="destructive">Bloqueado</Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-500/10 text-green-500">Ativo</Badge>
                              )}
                              {reseller.is_admin && (
                                <Badge variant="outline" className="text-[10px] h-4">Sub-Admin</Badge>
                              )}
                            </div>
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
                              variant="outline" 
                              size="sm"
                              onClick={() => handleToggleAdmin(reseller.id, reseller.is_admin)}
                              className={reseller.is_admin ? "text-blue-500" : ""}
                            >
                              {reseller.is_admin ? "Remover Admin" : "Tornar Admin"}
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
          {!isAdmin && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-8 rounded-lg text-center mb-6">
              <ShieldAlert className="mx-auto h-12 w-12 mb-4" />
              <h2 className="text-xl font-bold">Acesso Restrito</h2>
              <p>Apenas administradores podem gerar novas licenças no sistema.</p>
            </div>
          )}
          <Card className={`bg-card border-border ${!isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
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
                {isProcessing ? <p>Processando...</p> : <p>Solte qualquer arquivo aqui (máx 212 KB)</p>}
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
