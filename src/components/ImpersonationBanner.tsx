import { useNavigate } from "react-router-dom";
import { X, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedRole, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = () => {
    stopImpersonation();
    navigate("/admin");
  };

  const roleLabels = {
    establishment: "Estabelecimento",
    client: "Cliente",
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-amber-950 py-2 px-4 z-[60] flex items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Eye size={18} />
        <span className="font-medium">
          Visualizando como: <strong>{roleLabels[impersonatedRole!]}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        className="bg-amber-600 border-amber-700 text-white hover:bg-amber-700 hover:text-white"
      >
        <Shield size={14} className="mr-1" />
        Voltar ao Admin
        <X size={14} className="ml-1" />
      </Button>
    </div>
  );
}
