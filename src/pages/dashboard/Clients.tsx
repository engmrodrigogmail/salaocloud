import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Search, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  created_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;

      try {
        const { data: est } = await supabase
          .from("establishments")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!est) return;

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("establishment_id", est.id)
          .order("name");

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [user]);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Todos os clientes que já agendaram com você
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cliente desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "Nenhum cliente encontrado"
                        : "Nenhum cliente cadastrado ainda"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os clientes aparecem aqui quando fazem um agendamento
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {client.name.charAt(0)}
                        </div>
                        <div className="font-medium">{client.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>
                      {client.email || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {format(new Date(client.created_at), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
