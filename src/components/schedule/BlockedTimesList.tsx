import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, User, Calendar, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Professional = Tables<"professionals">;

interface BlockedTime {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface Closure {
  id: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_recurring: boolean;
}

interface BlockedTimesListProps {
  establishmentId: string;
  professionals: Professional[];
  onRefresh: () => void;
  refreshKey?: number;
}

export function BlockedTimesList({
  establishmentId,
  professionals,
  onRefresh,
  refreshKey = 0,
}: BlockedTimesListProps) {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: "block" | "closure" } | null>(null);

  useEffect(() => {
    fetchData();
  }, [establishmentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const professionalIds = professionals.map(p => p.id);
      
      // Fetch blocked times
      if (professionalIds.length > 0) {
        const { data: blocks } = await supabase
          .from("professional_blocked_times")
          .select("*")
          .in("professional_id", professionalIds)
          .gte("end_time", new Date().toISOString())
          .order("start_time");

        setBlockedTimes(blocks || []);
      }

      // Fetch closures
      const { data: closureData } = await supabase
        .from("establishment_closures")
        .select("*")
        .eq("establishment_id", establishmentId)
        .gte("end_date", format(new Date(), "yyyy-MM-dd"))
        .order("start_date");

      setClosures(closureData || []);
    } catch (error) {
      console.error("Error fetching blocked times:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "block") {
        const { error } = await supabase
          .from("professional_blocked_times")
          .delete()
          .eq("id", itemToDelete.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("establishment_closures")
          .delete()
          .eq("id", itemToDelete.id);

        if (error) throw error;
      }

      toast.success("Bloqueio removido");
      fetchData();
      onRefresh();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao remover bloqueio");
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const getProfessionalName = (id: string) => {
    const prof = professionals.find(p => p.id === id);
    return prof?.name || "Profissional";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-muted-foreground text-center">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const hasItems = blockedTimes.length > 0 || closures.length > 0;

  if (!hasItems) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum bloqueio agendado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Bloqueios Ativos</CardTitle>
          <CardDescription>
            Horários bloqueados e fechamentos programados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1 p-4 pt-0">
              {/* Closures */}
              {closures.map((closure) => (
                <div
                  key={closure.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-destructive/20">
                      <Calendar className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Estabelecimento Fechado</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {format(parseISO(closure.start_date), "dd/MM/yyyy", { locale: ptBR })}
                          {closure.end_date !== closure.start_date && (
                            <> a {format(parseISO(closure.end_date), "dd/MM/yyyy", { locale: ptBR })}</>
                          )}
                        </span>
                        {closure.start_time && closure.end_time && (
                          <>
                            <span>•</span>
                            <span>{closure.start_time} - {closure.end_time}</span>
                          </>
                        )}
                      </div>
                      {closure.reason && (
                        <p className="text-xs text-muted-foreground mt-1">{closure.reason}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setItemToDelete({ id: closure.id, type: "closure" });
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Professional Blocks */}
              {blockedTimes.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <User className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{getProfessionalName(block.professional_id)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(block.start_time), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <span>•</span>
                        <span>
                          {format(parseISO(block.start_time), "HH:mm")} - {format(parseISO(block.end_time), "HH:mm")}
                        </span>
                      </div>
                      {block.reason && (
                        <p className="text-xs text-muted-foreground mt-1">{block.reason}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
                    onClick={() => {
                      setItemToDelete({ id: block.id, type: "block" });
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Bloqueio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este bloqueio? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
