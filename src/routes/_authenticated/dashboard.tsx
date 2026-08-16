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
  deleteExhaustedLicenses,
  deleteReseller,
  getUnassignedLicenses,
  assignLicense,
  deleteLicense,
  updateUploadPermission
} from "@/lib/licenses.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { 
  Copy, Upload, CheckCircle2, XCircle, Clock, Database, 
  Users, UserPlus, Phone, Lock, Unlock, Send, MessageSquare, ShieldAlert,
  RefreshCw, Eye, EyeOff, Cloud, Key, Trash2
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
      return { total: 0, active: 0, assigned: 0, unassigned: 0 };
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

const unassignedQueryOptions = queryOptions({
  queryKey: ["unassigned-licenses"],
  queryFn: async () => {
    try {
      return await getUnassignedLicenses();
    } catch (error) {
      console.error("Unassigned Licenses error:", error);
      return [];
    }
  },
});

function licenseStatusLabel(license: any) {
  if (license.status === "blocked") return "Bloqueada";
  if (license.status !== "active" || (license.uses_remaining ?? 0) <= 0) return "Usada";
  return "Disponível";
}

function licenseStatusVariant(license: any): "default" | "destructive" | "secondary" {
  const label = licenseStatusLabel(license);
  if (label === "Disponível") return "default";
  if (label === "Bloqueada") return "secondary";
  return "destructive";
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    try {
      await Promise.allSettled([
        context.queryClient.ensureQueryData(statsQueryOptions),
        context.queryClient.ensureQueryData(licensesQueryOptions),
        context.queryClient.ensureQueryData(resellersQueryOptions),
        context.queryClient.ensureQueryData(unassignedQueryOptions),
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
  const unassignedQuery = useSuspenseQuery(unassignedQueryOptions);
  
  // Pegar dados do contexto da rota carregados no loader
  const context = Route.useRouteContext() as any;
  const currentUser = context.profile;
  const isMasterAdmin = currentUser?.phone?.includes('11921009176') || currentUser?.is_admin === true;
  const isAdmin = isMasterAdmin;
  const isMaster = isMasterAdmin;
  const isSubAdmin = false; // Removido suporte a Sub-Admin




  const updateLastSeenFn = useServerFn(updateLastSeen);

  const createLicensesFn = useServerFn(createLicenses);
  const createResellerFn = useServerFn(createReseller);
  const updateStatusFn = useServerFn(updateProfileStatus);
  const transferFn = useServerFn(transferLicenses);
  const toggleAdminFn = useServerFn(toggleAdminStatus);
  const deleteExhaustedFn = useServerFn(deleteExhaustedLicenses);
  const deleteResellerFn = useServerFn(deleteReseller);
  const assignLicenseFn = useServerFn(assignLicense);
  const deleteLicenseFn = useServerFn(deleteLicense);
  const updateUploadPermissionFn = useServerFn(updateUploadPermission);

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resellerForm, setResellerForm] = useState({ phone: "", password: "", full_name: "", whatsapp: "", credits: 0 });
  const [transferData, setTransferData] = useState({ resellerId: "", amount: 1 });
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [showResellerPassword, setShowResellerPassword] = useState(false);
  const [isCreatingReseller, setIsCreatingReseller] = useState(false);
  const [isResellerModalOpen, setIsResellerModalOpen] = useState(false);
  const [assignData, setAssignData] = useState({ licenseId: "", resellerId: "" });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");


  // Fallback data para evitar quebras se a query retornar undefined/null
  const stats = statsQuery.data || { total: 0, active: 0, assigned: 0, unassigned: 0 };
  const licenses = licensesQuery.data || [];
  const resellers = resellersQuery.data || [];

  // Atualiza last_seen apenas uma vez no dashboard
  useState(() => {
    updateLastSeenFn();
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
            content: fileText,
            uses_remaining: 3,
            status: "active",
            owner_id: null
          });
        } catch (fileError: any) {
          console.error(`Erro ao ler arquivo ${file.name}:`, fileError);
          toast.error(`Erro no arquivo ${file.name}: ${fileError?.message || "Erro de leitura"}`);
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("licenses")
          .insert(itemsToInsert);

        if (insertError) throw insertError;

        toast.success(`${itemsToInsert.length} arquivos importados com sucesso!`);
        
        // Refetch de tudo para sincronizar
        await Promise.all([
          licensesQuery.refetch(),
          statsQuery.refetch(),
          unassignedQuery.refetch()
        ]);
      }
    } catch (error: any) {
      console.error("Erro exato do upload:", error);
      const errorMsg = error?.message || "Erro desconhecido durante o upload";
      toast.error(`Falha no upload: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [supabase, licensesQuery, statsQuery, unassignedQuery]);

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
    if (isCreatingReseller) return;
    
    setIsCreatingReseller(true);
    try {
      const cleanLogin = resellerForm.phone.replace(/\D/g, '');
      if (!cleanLogin) throw new Error("Número de telefone inválido.");

      const parentIdValue = null;

      const payload = {
        ...resellerForm,
        phone: cleanLogin,
        credits: Number(resellerForm.credits) || 0,
        parent_id: parentIdValue
      };

      await createResellerFn({ data: payload });
      
      toast.success("Revendedor cadastrado com sucesso!");
      setResellerForm({ phone: "", password: "", full_name: "", whatsapp: "", credits: 0 });
      setShowResellerPassword(false);
      setIsResellerModalOpen(false);
      
      // Refetch imediato
      await Promise.all([
        resellersQuery.refetch(),
        statsQuery.refetch(),
        licensesQuery.refetch()
      ]);
    } catch (error: any) {
      console.error("Erro ao cadastrar revendedor:", error);
      toast.error(error.message || "Erro ao cadastrar revendedor.");
    } finally {
      setIsCreatingReseller(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    const length = Math.floor(Math.random() * 3) + 8; // 8-10 caracteres
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResellerForm({ ...resellerForm, password });
    toast.info("Senha gerada!");
  };

  const copyPassword = () => {
    if (!resellerForm.password) return;
    navigator.clipboard.writeText(resellerForm.password);
    toast.success("Senha copiada!");
  };


  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      await updateStatusFn({ data: { userId, isBlocked: !currentStatus } });
      toast.success(currentStatus ? "Desbloqueado!" : "Bloqueado!");
      await resellersQuery.refetch();
    } catch (error) {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleTransfer = async () => {
    try {
      if (!isMasterAdmin && currentUser?.credits < transferData.amount) {
        toast.error("Saldo de créditos insuficiente!");
        return;
      }
      await transferFn({ data: transferData });
      toast.success("Licenças transferidas!");
      setIsTransferOpen(false);
      await Promise.all([licensesQuery.refetch(), statsQuery.refetch(), resellersQuery.refetch()]);
    } catch (error: any) {
      toast.error(error.message || "Erro na transferência.");
    }
  };


  const handleDeleteReseller = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este revendedor? Esta ação é irreversível.")) return;
    
    try {
      await deleteResellerFn({ data: { userId } });
      toast.success("Revendedor excluído!");
      await resellersQuery.refetch();
      await statsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir revendedor.");
    }
  };

  const handleDeleteExhausted = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsProcessing(true);
    try {
      const { error } = await (isMasterAdmin 
        ? supabase.from("licenses").delete().or("uses_remaining.lte.0,status.eq.exhausted")
        : supabase.from("licenses").delete().eq("owner_id", currentUser?.id).or("uses_remaining.lte.0,status.eq.exhausted")
      );

      if (error) throw error;

      toast.success("Licenças usadas removidas com sucesso!");
      await Promise.all([licensesQuery.refetch(), statsQuery.refetch()]);
    } catch (error: any) {
      console.error("Erro ao deletar licenças:", error);
      toast.error(error.message || "Erro ao remover licenças.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignLicense = async () => {
    if (!assignData.licenseId || !assignData.resellerId) {
      toast.error("Selecione um revendedor");
      return;
    }
    
    setIsProcessing(true);
    try {
      await assignLicenseFn({ data: assignData });
      toast.success("Licença atribuída com sucesso!");
      setIsAssignModalOpen(false);
      await Promise.all([
        unassignedQuery.refetch(),
        statsQuery.refetch(),
        resellersQuery.refetch()
      ]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atribuir licença.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLicense = async (licenseId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta licença do estoque?")) return;
    
    setIsProcessing(true);
    try {
      await deleteLicenseFn({ data: { licenseId } });
      toast.success("Licença excluída!");
      await Promise.all([
        unassignedQuery.refetch(),
        statsQuery.refetch()
      ]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir licença.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleUpload = async (userId: string, currentStatus: boolean | null | undefined) => {
    // Se for falso, vira true. Se for true/null/undefined, vira falso.
    const novoStatus = currentStatus === false;
    
    const { error } = await supabase
      .from('profiles')
      .update({ can_upload: novoStatus })
      .eq('id', userId);

    if (error) {
      toast.error("Erro ao salvar no banco: " + error.message);
    } else {
      toast.success(novoStatus ? "Upload Liberado!" : "Upload Bloqueado!");
      resellersQuery.refetch(); // Recarrega a lista de revendedores
    }
  };

  const filteredUnassigned = (unassignedQuery.data || []).filter((l: any) => 
    l.key.includes(searchTerm) || l.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.info("Chave copiada!");
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] p-4 md:p-8 space-y-8 dark">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isMasterAdmin ? "Painel Administrativo" : "Painel do Revendedor"}
          </h1>
          <p className="text-muted-foreground">
            {isMasterAdmin ? "Bem-vindo à gestão centralizada da rede." : `Olá, ${currentUser?.full_name || "Revendedor"}. Gerencie suas licenças.`}
          </p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}>
          Sair
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {isMasterAdmin && (
          <>
            <Card className="bg-[#1E293B] border-white/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estoque Geral</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Licenças no sistema</p>
              </CardContent>
            </Card>

            <Card className="bg-[#1E293B] border-white/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repassadas</CardTitle>
                <Send className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.assigned}</div>
                <p className="text-xs text-muted-foreground">Distribuídas na rede</p>
              </CardContent>
            </Card>

            <Card className="bg-[#1E293B] border-white/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Configs Livres</CardTitle>
                <Unlock className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unassigned}</div>
                <p className="text-xs text-muted-foreground">Sem dono no estoque</p>
              </CardContent>
            </Card>
          </>
        )}
        
        {!isMasterAdmin && (
          <Card className="bg-[#1E293B] border-white/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Minhas Licenças Ativas</CardTitle>
              <Unlock className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unassigned}</div>
              <p className="text-xs text-muted-foreground">Disponíveis para uso</p>
            </CardContent>
          </Card>
        )}
        
        
        <Card className="bg-[#1E293B] border-white/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Créditos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser?.credits || 0}</div>
            <p className="text-xs text-muted-foreground">Saldo atual disponível</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1E293B] border-white/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revendedores</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.length}</div>
            <p className="text-xs text-muted-foreground">
              {isMaster ? "Gestão da rede" : "Meus Revendedores"}
            </p>
          </CardContent>
        </Card>
      </div>

      {currentUser?.credits === 0 && !isMasterAdmin && (
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

      <Tabs
        defaultValue="licenses"
        className="w-full"
        onValueChange={(value) => {
          if (value === "resellers") resellersQuery.refetch();
          if (value === "licenses") licensesQuery.refetch();
          if (value === "unassigned") unassignedQuery.refetch();
        }}
      >
        <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="licenses" className="px-6 py-2">
            {isMasterAdmin ? "Licenças" : "Minhas Licenças"}
          </TabsTrigger>
          {isMasterAdmin && (
            <>
              <TabsTrigger value="resellers" className="px-6 py-2">Revendedores</TabsTrigger>
              <TabsTrigger value="upload" className="px-6 py-2">Gerar Licenças</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="licenses" className="mt-6">
          <Card className="bg-[#1E293B] border-white/5">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle>{isMasterAdmin ? "Estoque de Licenças" : "Minhas Chaves de Licença"}</CardTitle>
                <CardDescription>
                  {isMasterAdmin
                    ? "Gerencie suas licenças e remova as já esgotadas."
                    : "Copie suas chaves e acompanhe o status de cada uma."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isMasterAdmin && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files) {
                          onDrop(Array.from(e.target.files));
                        }
                      }}
                      multiple
                      accept=".config,.txt"
                      className="hidden"
                    />
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-all"
                        disabled={isProcessing}
                      >
                        <Upload className="w-4 h-4"/>
                        {isProcessing ? "Enviando..." : "Upload Configs"}
                      </Button>
                      <p className="text-[10px] text-amber-500 mt-1 max-w-[150px]">
                        Somente admin pode usar. Se você usar vai tudo pro painel master
                      </p>
                    </div>
                  </>
                )}
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDeleteExhausted}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                  type="button"
                >
                  <XCircle className="h-4 w-4 mr-2" /> 
                  {isProcessing ? "Apagando..." : "Apagar Licenças"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <div className="hidden md:block">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="border-white/5">
                      <TableHead>Chave</TableHead>
                      <TableHead>Arquivo</TableHead>
                      {isMasterAdmin && <TableHead>Dono</TableHead>}
                      <TableHead>Usos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isMasterAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">
                          Nenhuma licença encontrada.
                        </TableCell>
                      </TableRow>
                    ) : licenses.map((license: any) => (
                      <TableRow key={license.id} className="border-white/5">
                        <TableCell className="font-mono font-bold">{license.key}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{license.filename}</TableCell>
                        {isMasterAdmin && (
                          <TableCell>
                            {license.owner?.full_name || <Badge variant="outline">Livre</Badge>}
                          </TableCell>
                        )}
                        <TableCell>{license.uses_remaining}/3</TableCell>
                        <TableCell>
                          <Badge variant={licenseStatusVariant(license)}>
                            {licenseStatusLabel(license)}
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
              </div>

              {/* Mobile View - Licenses Cards */}
              <div className="md:hidden space-y-4 p-4">
                {licenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma licença encontrada.
                  </div>
                ) : licenses.map((license: any) => (
                  <Card key={license.id} className="bg-[#0F172A] border-white/5 overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-lg">{license.key}</span>
                        <Badge variant={licenseStatusVariant(license)}>
                          {licenseStatusLabel(license)}
                        </Badge>
                      </div>
                      <CardDescription className="truncate text-xs">{license.filename}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Usos: {license.uses_remaining}/3</span>
                        <span>{format(new Date(license.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      {isMasterAdmin && (
                        <div className="text-xs">
                          Dono: {license.owner?.full_name || "Livre"}
                        </div>
                      )}
                      <Button variant="secondary" size="sm" className="w-full mt-2" onClick={() => copyToClipboard(license.key)}>
                        <Copy className="h-4 w-4 mr-2" /> Copiar Chave
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resellers" className="mt-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Gestão de Acessos</h2>
              <Dialog open={isResellerModalOpen} onOpenChange={setIsResellerModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="h-4 w-4 mr-2" /> Novo Revendedor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] w-[95vw] bg-[#1E293B] border-white/5 text-white">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Revendedor</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Crie uma nova conta de acesso para revendedor ou sub-admin.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateReseller} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input 
                        value={resellerForm.full_name}
                        onChange={e => setResellerForm({...resellerForm, full_name: e.target.value})}
                        required 
                        className="bg-[#0F172A] border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número de Acesso (Login)</Label>
                      <Input 
                        value={resellerForm.phone}
                        onChange={e => setResellerForm({...resellerForm, phone: e.target.value.replace(/\D/g, "")})}
                        placeholder="ex: 11999998888" 
                        required 
                        className="bg-[#0F172A] border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha Inicial</Label>
                      <div className="relative">
                        <Input 
                          type={showResellerPassword ? "text" : "password"}
                          value={resellerForm.password}
                          onChange={e => setResellerForm({...resellerForm, password: e.target.value})}
                          required 
                          className="bg-[#0F172A] border-white/10"
                        />
                        <div className="absolute right-0 top-0 h-full flex items-center pr-2 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => setShowResellerPassword(!showResellerPassword)}
                          >
                            {showResellerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          className="text-[10px] h-7 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                          onClick={generateRandomPassword}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Gerar
                        </Button>
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          className="text-[10px] h-7 px-2 bg-green-500/10 hover:bg-green-500/20 text-green-400"
                          onClick={copyPassword}
                          disabled={!resellerForm.password}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp de Suporte (Opcional)</Label>
                      <Input 
                        value={resellerForm.whatsapp}
                        onChange={e => setResellerForm({...resellerForm, whatsapp: e.target.value})}
                        placeholder="Ex: 5511999998888" 
                        className="bg-[#0F172A] border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Créditos Iniciais</Label>
                      <Input 
                        type="number"
                        min="0"
                        value={resellerForm.credits}
                        onChange={e => setResellerForm({...resellerForm, credits: parseInt(e.target.value) || 0})}
                        className="bg-[#0F172A] border-white/10"
                      />
                    </div>
                    <DialogFooter className="pt-4">
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isCreatingReseller}>
                        {isCreatingReseller ? "Cadastrando..." : "Confirmar Cadastro"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Card className="bg-[#1E293B] border-white/5">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="border-white/5">
                        <TableHead>Revendedor</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Visto por último</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Upload</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resellers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            Nenhum revendedor cadastrado.
                          </TableCell>
                        </TableRow>
                      ) : resellers.map((reseller: any) => (
                        <TableRow key={reseller.id} className="border-white/5">
                          <TableCell className="font-medium">{reseller.full_name}</TableCell>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto gap-1 text-blue-400" onClick={() => openWhatsApp(reseller.phone)}>
                              <MessageSquare className="h-3 w-3" /> {reseller.phone}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {reseller.last_seen ? format(new Date(reseller.last_seen), "dd/MM HH:mm") : "Nunca"}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                              {reseller.credits || 0} unid.
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {reseller.is_blocked ? (
                                <Badge variant="destructive">Bloqueado</Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-500/10 text-green-400">Ativo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={reseller.can_upload ? "default" : "secondary"} className={reseller.can_upload ? "bg-green-500/10 text-green-400" : ""}>
                              {reseller.can_upload ? "Liberado" : "Bloqueado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-white/10 hover:bg-white/5"
                              onClick={() => {
                                setTransferData({ ...transferData, resellerId: reseller.id });
                                setIsTransferOpen(true);
                              }}
                            >
                              <Send className="h-3 w-3 mr-1" /> Créditos
                            </Button>
                            {isMasterAdmin && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className={`border-white/10 ${reseller.can_upload ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                                  onClick={() => handleToggleUpload(reseller.id, reseller.can_upload)}
                                  title={reseller.can_upload ? "Bloquear Upload" : "Liberar Upload"}
                                >
                                  {reseller.can_upload ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                                  {reseller.can_upload ? "Bloquear" : "Liberar"}
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="hover:bg-white/5"
                              onClick={() => handleToggleBlock(reseller.id, reseller.is_blocked)}
                            >
                              {reseller.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4 text-destructive" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteReseller(reseller.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-4">
              {resellers.length === 0 ? (
                <Card className="bg-[#1E293B] border-white/5 p-8 text-center text-slate-500">
                  Nenhum revendedor cadastrado.
                </Card>
              ) : resellers.map((reseller: any) => (
                <Card key={reseller.id} className="bg-[#1E293B] border-white/5 overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{reseller.full_name}</CardTitle>
                        <CardDescription className="text-blue-400 flex items-center gap-1 mt-1" onClick={() => openWhatsApp(reseller.phone)}>
                          <Phone className="h-3 w-3" /> {reseller.phone}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {reseller.is_blocked ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500/10 text-green-400">Ativo</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4">
                    <div className="flex justify-between items-center text-sm border-t border-white/5 pt-4">
                      <span className="text-slate-400">Saldo Atual:</span>
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        {reseller.credits || 0} unid.
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Visto por último:</span>
                      <span>{reseller.last_seen ? format(new Date(reseller.last_seen), "dd/MM HH:mm") : "Nunca"}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full border-white/10"
                        onClick={() => {
                          setTransferData({ ...transferData, resellerId: reseller.id });
                          setIsTransferOpen(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" /> + Créditos
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={`w-full border-white/10 ${reseller.can_upload === false ? 'bg-amber-600/20 text-amber-400 border-amber-500/30 hover:bg-amber-600/30' : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
                        onClick={() => handleToggleUpload(reseller.id, reseller.can_upload)}
                      >
                        {reseller.can_upload === false ? '⛔ Upload Bloqueado' : '☁️ Bloquear Upload'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={`w-full border-white/10 ${reseller.is_blocked ? "text-green-400" : "text-destructive"}`}
                        onClick={() => handleToggleBlock(reseller.id, reseller.is_blocked)}
                      >
                        {reseller.is_blocked ? <><Unlock className="h-3 w-3 mr-1" /> Desbloquear</> : <><Lock className="h-3 w-3 mr-1" /> Bloquear</>}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full border-white/10"
                        onClick={() => openWhatsApp(reseller.phone)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full border-white/10 text-destructive col-span-2"
                        onClick={() => handleDeleteReseller(reseller.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Excluir
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

        <TabsContent value="unassigned" className="mt-6">
          <Card className="bg-[#1E293B] border-white/5">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle>{isMasterAdmin ? "Estoque de Configs Livres" : "Minhas Configs Livres"}</CardTitle>
                <CardDescription>
                  {isMasterAdmin ? "Visualizar e atribuir licenças que ainda não possuem dono." : "Gerencie licenças prontas para repasse aos seus revendedores."}
                </CardDescription>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Buscar por chave ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0F172A] border-white/10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead>Chave</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Importado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnassigned.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nenhuma config livre encontrada.
                      </TableCell>
                    </TableRow>
                  ) : filteredUnassigned.map((license: any) => (
                    <TableRow key={license.id} className="border-white/5">
                      <TableCell className="font-mono font-bold">{license.key}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{license.filename}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-500/10 text-green-400">
                          Livre
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(license.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(license.key)} title="Copiar Chave">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-blue-600/30"
                          onClick={() => {
                            setAssignData({ ...assignData, licenseId: license.id });
                            setIsAssignModalOpen(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" /> Atribuir
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteLicense(license.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isMasterAdmin && (
          <TabsContent value="upload" className="mt-6">
            <Card className="bg-[#1E293B] border-white/5">
              <CardHeader>
                <CardTitle>Upload de Configs / Importar em Lote</CardTitle>
                <CardDescription>Apenas o Admin Master pode gerar novas licenças para o estoque geral.</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                      <p>Processando arquivos...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg font-medium">Arraste e solte múltiplos arquivos aqui</p>
                      <p className="text-sm text-muted-foreground">ou clique para selecionar (máx 212 KB por arquivo)</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-[#1E293B] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>Atribuir Licença</DialogTitle>
            <DialogDescription className="text-slate-400">
              Selecione o revendedor para vincular esta licença.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Revendedor</Label>
              <Select onValueChange={(val) => setAssignData({...assignData, resellerId: val})}>
                <SelectTrigger className="bg-[#0F172A] border-white/10">
                  <SelectValue placeholder="Selecione um revendedor" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E293B] border-white/5 text-white">
                  {resellers.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name} ({r.phone})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAssignLicense} disabled={isProcessing}>
              Confirmar Atribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
