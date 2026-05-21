import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Carrega mapas de categorias (serviço e produto) por estabelecimento.
 * Retorna funções para obter o nome da categoria a partir do category_id.
 */
export function useCatalogCategories(establishmentId: string | null | undefined) {
  const [serviceCats, setServiceCats] = useState<Record<string, string>>({});
  const [productCats, setProductCats] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!establishmentId) return;
    let cancelled = false;
    (async () => {
      const [sRes, pRes] = await Promise.all([
        supabase
          .from("service_categories")
          .select("id, name")
          .eq("establishment_id", establishmentId),
        supabase
          .from("product_categories")
          .select("id, name")
          .eq("establishment_id", establishmentId),
      ]);
      if (cancelled) return;
      const sMap: Record<string, string> = {};
      (sRes.data || []).forEach((c: any) => {
        sMap[c.id] = c.name;
      });
      const pMap: Record<string, string> = {};
      (pRes.data || []).forEach((c: any) => {
        pMap[c.id] = c.name;
      });
      setServiceCats(sMap);
      setProductCats(pMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  return {
    getServiceCategory: (id?: string | null) =>
      (id && serviceCats[id]) || "Sem categoria",
    getProductCategory: (id?: string | null) =>
      (id && productCats[id]) || "Sem categoria",
    serviceCats,
    productCats,
  };
}
