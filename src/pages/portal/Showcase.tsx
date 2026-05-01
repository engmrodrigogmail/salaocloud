import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Upload, Camera, Trash2, GripVertical, Clock,
  ImageIcon, CalendarClock, AlertTriangle,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// TODO: SaaS Plans - Showcase limit (atualmente fixo em 3, futuramente dinâmico por plano)
const MAX_SHOWCASE_IMAGES = 3;
const MAX_CAPTION = 500;

interface ShowcaseItem {
  id: string;
  establishment_id: string;
  image_url: string;
  storage_path: string;
  caption: string | null;
  order_index: number;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export default function Showcase() {
  const { slug } = useParams<{ slug: string }>();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const [openUpload, setOpenUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ShowcaseItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (slug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: est, error: estErr } = await supabase
        .from("establishments")
        .select("id, is_showcase_enabled, updated_at")
        .eq("slug", slug!)
        .single();
      if (estErr || !est) throw estErr || new Error("Estabelecimento não encontrado");

      setEstablishmentId(est.id);
      setIsEnabled(Boolean((est as any).is_showcase_enabled ?? true));

      const { data: rows, error: rowsErr } = await supabase
        .from("establishment_showcase" as any)
        .select("*")
        .eq("establishment_id", est.id)
        .order("order_index", { ascending: true });
      if (rowsErr) throw rowsErr;

      const list = (rows || []) as unknown as ShowcaseItem[];
      setItems(list);
      const latest = list.reduce<string | null>((acc, it) => {
        const t = it.updated_at;
        return !acc || new Date(t) > new Date(acc) ? t : acc;
      }, null);
      setLastUpdate(latest);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar a Vitrine");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (!establishmentId) return;
    setSavingToggle(true);
    setIsEnabled(next);
    const { error } = await supabase
      .from("establishments")
      .update({ is_showcase_enabled: next } as any)
      .eq("id", establishmentId);
    setSavingToggle(false);
    if (error) {
      setIsEnabled(!next);
      toast.error("Não foi possível salvar");
      return;
    }
    toast.success(next ? "Vitrine habilitada" : "Vitrine desabilitada");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
      ...it,
      order_index: idx,
    }));
    setItems(reordered);
    // Persistir
    await Promise.all(
      reordered.map((it) =>
        supabase
          .from("establishment_showcase" as any)
          .update({ order_index: it.order_index } as any)
          .eq("id", it.id)
      )
    );
  };

  const handleDelete = async (item: ShowcaseItem) => {
    try {
      // 1) Remove arquivo do storage
      const { error: storageErr } = await supabase.storage
        .from("showcase-images")
        .remove([item.storage_path]);
      if (storageErr) console.warn("storage delete warning:", storageErr);
      // 2) Remove registro
      const { error: dbErr } = await supabase
        .from("establishment_showcase" as any)
        .delete()
        .eq("id", item.id);
      if (dbErr) throw dbErr;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Imagem excluída");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir imagem");
    } finally {
      setConfirmDelete(null);
    }
  };

  const canAddMore = items.length < MAX_SHOWCASE_IMAGES;

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Vitrine</h1>
          <p className="text-muted-foreground text-sm">
            Imagens de boas-vindas exibidas para o cliente após o login.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Ative ou desative a Vitrine. Quando desativada (ou sem imagens), o cliente entra direto no Agendamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">Habilitar Vitrine</Label>
                <p className="text-sm text-muted-foreground">
                  {lastUpdate
                    ? `Última atualização: ${format(new Date(lastUpdate), "dd/MM/yyyy HH:mm", { locale: ptBR })} — mantenha as imagens atualizadas para encantar o cliente.`
                    : "Adicione imagens para começar a impressionar seus clientes."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savingToggle && <Loader2 className="h-4 w-4 animate-spin" />}
                <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={savingToggle} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Imagens ({items.length}/{MAX_SHOWCASE_IMAGES})</CardTitle>
              <CardDescription>Arraste para reordenar. Clique no botão abaixo para adicionar.</CardDescription>
            </div>
            <Button onClick={() => setOpenUpload(true)} disabled={!canAddMore}>
              <Upload className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhuma imagem cadastrada ainda.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-3">
                    {items.map((it) => (
                      <SortableRow
                        key={it.id}
                        item={it}
                        onDelete={() => setConfirmDelete(it)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload dialog */}
      {openUpload && establishmentId && (
        <UploadDialog
          establishmentId={establishmentId}
          nextOrderIndex={items.length}
          onClose={() => setOpenUpload(false)}
          onCreated={(item) => {
            setItems((prev) => [...prev, item]);
            setLastUpdate(item.updated_at);
            setOpenUpload(false);
          }}
        />
      )}

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem da Vitrine?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}

function SortableRow({ item, onDelete }: { item: ShowcaseItem; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const isScheduled = !!item.scheduled_for && new Date(item.scheduled_for) > new Date();
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <img
        src={item.image_url}
        alt={item.caption || "Imagem da vitrine"}
        className="h-16 w-24 rounded object-cover bg-muted"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2">{item.caption || <span className="text-muted-foreground italic">Sem legenda</span>}</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {isScheduled && (
            <Badge variant="secondary" className="gap-1">
              <CalendarClock className="h-3 w-3" />
              Agendada para {format(new Date(item.scheduled_for!), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Excluir">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  );
}

function UploadDialog({
  establishmentId,
  nextOrderIndex,
  onClose,
  onCreated,
}: {
  establishmentId: string;
  nextOrderIndex: number;
  onClose: () => void;
  onCreated: (item: ShowcaseItem) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo deve ser uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }

    let scheduled_for: string | null = null;
    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) {
        toast.error("Informe data e horário");
        return;
      }
      // Brasília (UTC-3) — converter "YYYY-MM-DDTHH:mm" assumindo America/Sao_Paulo
      const isoLocal = `${scheduleDate}T${scheduleTime}:00-03:00`;
      const d = new Date(isoLocal);
      if (isNaN(d.getTime())) {
        toast.error("Data/horário inválidos");
        return;
      }
      if (d.getTime() <= Date.now()) {
        toast.error("Agendamento deve ser no futuro");
        return;
      }
      scheduled_for = d.toISOString();
    }

    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${establishmentId}/${filename}`;

      const { error: upErr } = await supabase.storage
        .from("showcase-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("showcase-images").getPublicUrl(path);
      const image_url = pub.publicUrl;

      const { data: inserted, error: insErr } = await supabase
        .from("establishment_showcase" as any)
        .insert({
          establishment_id: establishmentId,
          image_url,
          storage_path: path,
          caption: caption.trim() || null,
          order_index: nextOrderIndex,
          scheduled_for,
        } as any)
        .select("*")
        .single();
      if (insErr) throw insErr;

      toast.success("Imagem adicionada à vitrine");
      onCreated(inserted as unknown as ShowcaseItem);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar imagem");
    } finally {
      setSubmitting(false);
    }
  };

  const captionLeft = MAX_CAPTION - caption.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar imagem à Vitrine</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File / Camera */}
          <div className="space-y-2">
            <Label>Imagem</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Arquivo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Câmera
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Recomendado: 800x600 ou 600x800. Máx 5MB.
            </p>
            {preview && (
              <div className="mt-2 rounded-lg overflow-hidden border bg-muted">
                <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="caption">Legenda</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
              placeholder="Conte para o cliente o que esta imagem mostra..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">{captionLeft} caracteres restantes</p>
          </div>

          {/* Schedule */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Agendar publicação</Label>
                <p className="text-xs text-muted-foreground">Padrão: imediato. Use horário de Brasília.</p>
              </div>
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>
            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="sd" className="text-xs">Data</Label>
                  <Input id="sd" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="st" className="text-xs">Hora</Label>
                  <Input id="st" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || !file}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
