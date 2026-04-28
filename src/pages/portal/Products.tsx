import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Package, Tag, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { CategoryManagerDialog } from "@/components/categories/CategoryManagerDialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  stock_quantity: number | null;
  price: number;
  is_active: boolean;
}

interface ProductCategory {
  id: string;
  name: string;
}

export default function PortalProducts() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}/produtos`);
      return;
    }

    if (slug && user) {
      fetchAll();
    }
  }, [slug, user, authLoading]);

  const fetchAll = async () => {
    try {
      const { data: est, error: estError } = await supabase
        .from("establishments")
        .select("id, owner_id")
        .eq("slug", slug)
        .single();

      if (estError || !est || est.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishmentId(est.id);

      const [{ data: prodData, error: prodError }, { data: catData }] = await Promise.all([
        supabase.from("products").select("*").eq("establishment_id", est.id).order("name"),
        supabase
          .from("product_categories")
          .select("id, name")
          .eq("establishment_id", est.id)
          .order("name"),
      ]);

      if (prodError) throw prodError;
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const refetchAfterCategoryChange = async () => {
    if (!establishmentId) return;
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase.from("products").select("*").eq("establishment_id", establishmentId).order("name"),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .order("name"),
    ]);
    setProducts(prodData || []);
    setCategories(catData || []);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Produto removido!" });
      fetchAll();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "none" ? !p.category : p.category === categoryFilter);
    return matchesQuery && matchesCategory;
  });

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os produtos para venda no seu estabelecimento
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
              <FolderTree className="h-4 w-4 mr-2" />
              Categorias
            </Button>
            <Button
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => {
                setEditingProduct(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {establishmentId && (
          <>
            <ProductFormDialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setEditingProduct(null);
              }}
              establishmentId={establishmentId}
              editingProduct={editingProduct}
              onSuccess={fetchAll}
            />
            <CategoryManagerDialog
              open={isCategoryDialogOpen}
              onOpenChange={setIsCategoryDialogOpen}
              establishmentId={establishmentId}
              kind="product"
              onChanged={refetchAfterCategoryChange}
            />
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou categoria..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Filtrar por categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum produto cadastrado
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setIsDialogOpen(true)}
                      className="mt-2"
                    >
                      Adicionar primeiro produto
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Tag className="h-3 w-3" />
                          {product.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{product.unit || "un"}</TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      {product.is_active ? (
                        <Badge className="bg-success/10 text-success">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
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
    </PortalLayout>
  );
}
