import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Palette, Sparkles, Save, RotateCcw } from "lucide-react";
import { useBrandColors, hexToHsl } from "@/hooks/useBrandColors";

interface BrandColorsCardProps {
  establishmentId: string;
  logoUrl: string | null;
  savedColors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
  };
  onColorsUpdate: (colors: { primary: string; secondary: string; accent: string }) => void;
}

export const BrandColorsCard = ({ 
  establishmentId, 
  logoUrl, 
  savedColors,
  onColorsUpdate 
}: BrandColorsCardProps) => {
  const [primaryColor, setPrimaryColor] = useState(savedColors.primary || "#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState(savedColors.secondary || "#6366f1");
  const [accentColor, setAccentColor] = useState(savedColors.accent || "#8b5cf6");
  const [saving, setSaving] = useState(false);
  
  const { extractColors, loading: extracting } = useBrandColors(logoUrl, savedColors);

  useEffect(() => {
    if (savedColors.primary) setPrimaryColor(savedColors.primary);
    if (savedColors.secondary) setSecondaryColor(savedColors.secondary);
    if (savedColors.accent) setAccentColor(savedColors.accent);
  }, [savedColors]);

  const handleExtractColors = async () => {
    if (!logoUrl) {
      toast.error("Adicione uma logo primeiro para extrair as cores");
      return;
    }
    
    const colors = await extractColors();
    if (colors) {
      setPrimaryColor(colors.primary);
      setSecondaryColor(colors.secondary);
      setAccentColor(colors.accent);
      toast.success("Cores extraídas da logo!");
    } else {
      toast.error("Não foi possível extrair as cores da logo");
    }
  };

  const handleSaveColors = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({
          brand_primary_color: primaryColor,
          brand_secondary_color: secondaryColor,
          brand_accent_color: accentColor
        })
        .eq("id", establishmentId);

      if (error) throw error;
      
      onColorsUpdate({
        primary: primaryColor,
        secondary: secondaryColor,
        accent: accentColor
      });
      
      toast.success("Cores da marca salvas!");
    } catch (error) {
      console.error("Error saving brand colors:", error);
      toast.error("Erro ao salvar cores");
    } finally {
      setSaving(false);
    }
  };

  const handleResetColors = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({
          brand_primary_color: null,
          brand_secondary_color: null,
          brand_accent_color: null
        })
        .eq("id", establishmentId);

      if (error) throw error;
      
      setPrimaryColor("#3b82f6");
      setSecondaryColor("#6366f1");
      setAccentColor("#8b5cf6");
      
      onColorsUpdate({
        primary: "#3b82f6",
        secondary: "#6366f1",
        accent: "#8b5cf6"
      });
      
      toast.success("Cores resetadas para o padrão");
    } catch (error) {
      console.error("Error resetting brand colors:", error);
      toast.error("Erro ao resetar cores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Cores da Marca
        </CardTitle>
        <CardDescription>
          Personalize as cores da página de agendamento vista pelos seus clientes. 
          Você pode extrair automaticamente as cores da sua logo ou definir manualmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Extract Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleExtractColors}
            disabled={extracting || !logoUrl}
            className="flex items-center gap-2"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {extracting ? "Extraindo..." : "Extrair Cores da Logo"}
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleResetColors}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar para Padrão
          </Button>
        </div>

        {!logoUrl && (
          <p className="text-sm text-muted-foreground italic">
            Adicione uma logo acima para usar a extração automática de cores.
          </p>
        )}

        {/* Color Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Cor Primária</Label>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg border-2 cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: primaryColor }}
                onClick={() => document.getElementById("primary-color-input")?.click()}
              />
              <Input
                id="primary-color"
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#3b82f6"
                className="font-mono"
              />
              <input
                id="primary-color-input"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="sr-only"
              />
            </div>
            <p className="text-xs text-muted-foreground">Botões e destaques principais</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondary-color">Cor Secundária</Label>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg border-2 cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: secondaryColor }}
                onClick={() => document.getElementById("secondary-color-input")?.click()}
              />
              <Input
                id="secondary-color"
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#6366f1"
                className="font-mono"
              />
              <input
                id="secondary-color-input"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="sr-only"
              />
            </div>
            <p className="text-xs text-muted-foreground">Elementos de fundo e cards</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accent-color">Cor de Destaque</Label>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg border-2 cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: accentColor }}
                onClick={() => document.getElementById("accent-color-input")?.click()}
              />
              <Input
                id="accent-color"
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#8b5cf6"
                className="font-mono"
              />
              <input
                id="accent-color-input"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="sr-only"
              />
            </div>
            <p className="text-xs text-muted-foreground">Preços e informações importantes</p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border p-4 space-y-3">
          <Label className="text-sm font-medium">Pré-visualização</Label>
          <div 
            className="p-4 rounded-lg"
            style={{ 
              background: `linear-gradient(135deg, ${secondaryColor}20, ${primaryColor}10)`,
              border: `1px solid ${primaryColor}30`
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                S
              </div>
              <div>
                <h3 className="font-semibold">Serviço Exemplo</h3>
                <p className="text-sm text-muted-foreground">30 min</p>
              </div>
              <div className="ml-auto font-bold" style={{ color: accentColor }}>
                R$ 50,00
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveColors} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Cores
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
