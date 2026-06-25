import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CreditCard } from "lucide-react";

export default function SubscriptionExpired() {
  const [params] = useSearchParams();
  const slug = params.get("slug") || "";
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">
              Período de experiência encerrado
            </h1>
            <p className="text-muted-foreground">
              O acesso ao salão <strong>{slug}</strong> está suspenso. Para continuar
              utilizando o sistema, ative uma assinatura.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate("/assinatura")} className="bg-gradient-primary">
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar agora
            </Button>
            <Button variant="outline" asChild>
              <Link to="/hub">Voltar ao hub</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
