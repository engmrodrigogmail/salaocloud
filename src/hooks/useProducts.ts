import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Product } from "@/types/tabs";

export function useProducts(establishmentId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!establishmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  const createProduct = async (productData: {
    name: string;
    price: number;
    description?: string;
    category?: string;
  }) => {
    if (!establishmentId) return null;

    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          establishment_id: establishmentId,
          name: productData.name,
          price: productData.price,
          description: productData.description,
          category: productData.category,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Produto criado com sucesso");
      await fetchProducts();
      return data as Product;
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Erro ao criar produto");
      return null;
    }
  };

  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", productId);

      if (error) throw error;
      toast.success("Produto atualizado");
      await fetchProducts();
      return true;
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Erro ao atualizar produto");
      return false;
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", productId);

      if (error) throw error;
      toast.success("Produto removido");
      await fetchProducts();
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao remover produto");
      return false;
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchProducts();
    }
  }, [establishmentId, fetchProducts]);

  return {
    products,
    loading,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
