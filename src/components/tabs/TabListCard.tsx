import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Clock, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TabWithDetails } from "@/types/tabs";

interface TabListCardProps {
  tab: TabWithDetails;
  onClick: () => void;
}

export function TabListCard({ tab, onClick }: TabListCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">{tab.client_name}</span>
              <Badge 
                variant={tab.status === "open" ? "default" : tab.status === "closed" ? "secondary" : "destructive"}
                className="flex-shrink-0"
              >
                {tab.status === "open" ? "Aberta" : tab.status === "closed" ? "Fechada" : "Cancelada"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(parseISO(tab.opened_at), "dd/MM HH:mm", { locale: ptBR })}
              </div>
              {tab.professionals?.name && (
                <span className="truncate">{tab.professionals.name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-bold text-lg">{formatCurrency(tab.total)}</div>
              {tab.subtotal !== tab.total && (
                <div className="text-xs text-muted-foreground line-through">
                  {formatCurrency(tab.subtotal)}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
