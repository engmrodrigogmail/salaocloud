import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users, ShieldCheck, ShieldAlert, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProfessionalFormDialog } from "@/components/professionals/ProfessionalFormDialog";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialties: string[] | null;
  is_active: boolean;
  is_manager: boolean | null;
  user_id: string | null;
  must_change_password: boolean | null;
}

export default function PortalProfessionals() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { establishmentId, guard } = useOwnerEstablishment(slug);
  const { toast } = useToast();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    if (establishmentId) fetchProfessionals();
  }, [establishmentId]);

  const fetchProfessionals = async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, email, phone, specialties, is_active, is_manager, user_id, must_change_password")
        .eq("establishment_id", establishmentId)
        .order("name");

      if (error) throw error;
      setProfessionals((data as any) || []);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este profissional? Esta ação não pode ser desfeita.")) return;
    try {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Profissional removido!" });
      fetchProfessionals();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  };

  const openEditDialog = (professional: Professional) => {
    setEditingProfessional(professional);
    setIsDialogOpen(true);
  };

  const filteredProfessionals = professionals.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAccessBadge = (p: Professional) => {
    if (p.user_id && p.must_change_password) {
      return (
        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/50">
          <ShieldAlert className="h-3 w-3" /> Senha provisória
        </Badge>
      );
    }
    if (p.user_id) {
      return (
        <Badge variant="outline" className="gap-1 text-success border-success/40">
          <ShieldCheck className="h-3 w-3" /> Com acesso
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <ShieldAlert className="h-3 w-3" /> Sem acesso
      </Badge>
    );
  };

  if (guard) {
    return (
      <PortalLayout>
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Profissionais</h1>
            <p className="text-muted-foreground mt-1">Gerencie sua equipe e os acessos ao app</p>
          </div>
          <Button
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => {
              setEditingProfessional(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Profissional
          </Button>
        </div>

        {establishmentId && (
          <ProfessionalFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingProfessional(null);
            }}
            establishmentId={establishmentId}
            editingProfessional={editingProfessional as any}
            onSuccess={fetchProfessionals}
          />
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar profissional..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* MOBILE: cards */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">Nenhum profissional cadastrado</p>
              <Button variant="link" onClick={() => setIsDialogOpen(true)} className="mt-2">
                Adicionar profissional
              </Button>
            </div>
          ) : (
            filteredProfessionals.map((p) => (
              <div key={p.id} className="bg-card rounded-xl border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      {p.is_manager && <Badge variant="secondary" className="text-xs">Gerente</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.is_active ? (
                        <Badge className="bg-success/10 text-success text-xs">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Inativo</Badge>
                      )}
                      {renderAccessBadge(p)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(p)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar / Acesso
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {(p.email || p.phone) && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-13">
                    {p.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{p.email}</div>}
                    {p.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{p.phone}</div>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* DESKTOP: tabela */}
        <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Especialidades</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">Carregando...</TableCell>
                </TableRow>
              ) : filteredProfessionals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Nenhum profissional cadastrado</p>
                    <Button variant="link" onClick={() => setIsDialogOpen(true)} className="mt-2">
                      Adicionar profissional
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfessionals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.is_manager && (
                            <Badge variant="secondary" className="text-xs mt-0.5">Gerente</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.email && <div>{p.email}</div>}
                        {p.phone && <div className="text-muted-foreground">{p.phone}</div>}
                        {!p.email && !p.phone && <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.specialties && p.specialties.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.specialties.slice(0, 2).map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                          {p.specialties.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{p.specialties.length - 2}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <Badge className="bg-success/10 text-success">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>{renderAccessBadge(p)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(p)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar / Acesso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PortalLayout>
  );
}
