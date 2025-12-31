import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Scissors } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ServiceFormDialog } from "@/components/services/ServiceFormDialog";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

export default function PortalServices() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}/servicos`);
      return;
    }

    if (slug && user) {
      fetchEstablishmentAndServices();
    }
  }, [slug, user, authLoading]);

  const fetchEstablishmentAndServices = async () => {
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
        .from("services")
        .select("*")
        .eq("establishment_id", est.id)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Serviço removido!" });
      fetchEstablishmentAndServices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Serviços</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os serviços que você oferece
            </p>
          </div>
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => {
              setEditingService(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>

        {establishmentId && (
          <ServiceFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingService(null);
            }}
            establishmentId={establishmentId}
            editingService={editingService}
            onSuccess={fetchEstablishmentAndServices}
          />
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Preço</TableHead>
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
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Scissors className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum serviço cadastrado
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setIsDialogOpen(true)}
                      className="mt-2"
                    >
                      Adicionar primeiro serviço
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-muted-foreground">
                            {service.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{service.duration_minutes} min</TableCell>
                    <TableCell>R$ {service.price.toFixed(2)}</TableCell>
                    <TableCell>
                      {service.is_active ? (
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
                          <DropdownMenuItem onClick={() => openEditDialog(service)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
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