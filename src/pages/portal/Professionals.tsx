import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialties: string[] | null;
  is_active: boolean;
}

export default function PortalProfessionals() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialties: "",
    is_active: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}/profissionais`);
      return;
    }

    if (slug && user) {
      fetchEstablishmentAndProfessionals();
    }
  }, [slug, user, authLoading]);

  const fetchEstablishmentAndProfessionals = async () => {
    try {
      const { data: est, error: estError } = await supabase
        .from("establishments")
        .select("id, owner_id")
        .eq("slug", slug)
        .single();

      if (estError || !est || est.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishmentId(est.id);

      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("establishment_id", est.id)
        .order("name");

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!establishmentId) return;

    const specialtiesArray = formData.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingProfessional) {
        const { error } = await supabase
          .from("professionals")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
            is_active: formData.is_active,
          })
          .eq("id", editingProfessional.id);

        if (error) throw error;
        toast({ title: "Profissional atualizado!" });
      } else {
        const { error } = await supabase.from("professionals").insert({
          establishment_id: establishmentId,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast({ title: "Profissional adicionado!" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEstablishmentAndProfessionals();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Profissional removido!" });
      fetchEstablishmentAndProfessionals();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      specialties: "",
      is_active: true,
    });
    setEditingProfessional(null);
  };

  const openEditDialog = (professional: Professional) => {
    setEditingProfessional(professional);
    setFormData({
      name: professional.name,
      email: professional.email || "",
      phone: professional.phone || "",
      specialties: professional.specialties?.join(", ") || "",
      is_active: professional.is_active,
    });
    setIsDialogOpen(true);
  };

  const filteredProfessionals = professionals.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Profissionais</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua equipe
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Novo Profissional
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProfessional ? "Editar Profissional" : "Novo Profissional"}
                </DialogTitle>
                <DialogDescription>
                  {editingProfessional
                    ? "Atualize as informações do profissional"
                    : "Adicione um novo membro à sua equipe"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Nome completo"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Especialidades</Label>
                  <Input
                    placeholder="Corte, Coloração, Manicure..."
                    value={formData.specialties}
                    onChange={(e) =>
                      setFormData({ ...formData, specialties: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Separe por vírgulas
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Profissional ativo</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} className="bg-gradient-primary">
                  {editingProfessional ? "Salvar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar profissional..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Especialidades</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredProfessionals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum profissional cadastrado
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setIsDialogOpen(true)}
                      className="mt-2"
                    >
                      Adicionar profissional
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfessionals.map((professional) => (
                  <TableRow key={professional.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {professional.name.charAt(0)}
                        </div>
                        <div className="font-medium">{professional.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {professional.email && <div>{professional.email}</div>}
                        {professional.phone && (
                          <div className="text-muted-foreground">{professional.phone}</div>
                        )}
                        {!professional.email && !professional.phone && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {professional.specialties && professional.specialties.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {professional.specialties.slice(0, 2).map((specialty) => (
                            <Badge key={specialty} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                          {professional.specialties.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{professional.specialties.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {professional.is_active ? (
                        <Badge className="bg-success/10 text-success">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(professional)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(professional.id)}
                            className="text-destructive"
                          >
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
