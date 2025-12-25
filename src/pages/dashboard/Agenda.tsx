import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Agenda() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Agenda</h1>
          <p className="text-muted-foreground mt-1">
            Visualize e gerencie seus agendamentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Calendário de Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-16 text-muted-foreground">
              <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="font-semibold text-lg mb-2">Calendário em breve!</h3>
              <p className="max-w-md mx-auto">
                O calendário visual com todos os agendamentos será implementado em breve.
                Por enquanto, os agendamentos aparecem no Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
