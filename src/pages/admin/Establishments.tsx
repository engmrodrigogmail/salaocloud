import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Building2,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Establishment {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "pending" | "active" | "suspended";
  subscription_plan: string;
  created_at: string;
  owner_id: string;
}

export default function AdminEstablishments() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const fetchEstablishments = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEstablishments(data || []);
    } catch (error) {
      console.error("Error fetching establishments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstablishments();
  }, []);

  const updateStatus = async (id: string, status: "active" | "suspended") => {
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: `Estabelecimento ${status === "active" ? "ativado" : "suspenso"} com sucesso.`,
      });

      fetchEstablishments();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o status.",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Suspenso
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      trial: "bg-muted text-muted-foreground",
      basic: "bg-primary/10 text-primary",
      professional: "bg-secondary/10 text-secondary",
      premium: "bg-accent/10 text-accent",
    };
    return (
      <Badge className={colors[plan] || colors.trial}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  const filteredEstablishments = establishments.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Estabelecimentos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os salões e barbearias cadastrados
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Cadastro</TableHead>
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
              ) : filteredEstablishments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum estabelecimento encontrado
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEstablishments.map((establishment) => (
                  <TableRow key={establishment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{establishment.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {establishment.email || "Sem email"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(establishment.status)}</TableCell>
                    <TableCell>
                      {getPlanBadge(establishment.subscription_plan)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(establishment.created_at), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          {establishment.status !== "active" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(establishment.id, "active")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Ativar
                            </DropdownMenuItem>
                          )}
                          {establishment.status !== "suspended" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(establishment.id, "suspended")}
                              className="text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Suspender
                            </DropdownMenuItem>
                          )}
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
    </AdminLayout>
  );
}
