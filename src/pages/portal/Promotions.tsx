import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, Loader2 } from "lucide-react";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";

export default function PortalPromotions() {
  const { slug } = useParams<{ slug: string }>();
  const { guard } = useOwnerEstablishment(slug);

  if (guard) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Promoções</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas promoções
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5" />
              Em construção
            </CardTitle>
            <CardDescription>
              Esta funcionalidade será implementada em breve
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Aqui você poderá criar e gerenciar promoções para seus serviços.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
