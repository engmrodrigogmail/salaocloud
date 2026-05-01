import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bell, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Settings {
  appointment_reminder_enabled: boolean;
  appointment_reminder_minutes_before: number;
  appointment_reminder_template: string;
}

const DEFAULT: Settings = {
  appointment_reminder_enabled: true,
  appointment_reminder_minutes_before: 120,
  appointment_reminder_template:
    "Olá {cliente}! Lembrete do seu agendamento de {servico} às {hora}. Te esperamos!",
};

export function NotificationSettingsCard({ establishmentId }: { establishmentId: string }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [minutesText, setMinutesText] = useState("120");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const push = usePushNotifications();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notification_settings")
        .select("appointment_reminder_enabled, appointment_reminder_minutes_before, appointment_reminder_template")
        .eq("establishment_id", establishmentId)
        .maybeSingle();
      if (!mounted) return;
      if (data) {
        setSettings(data as Settings);
        setMinutesText(String(data.appointment_reminder_minutes_before));
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [establishmentId]);

  const save = async () => {
    setSaving(true);
    const minutes = Math.max(15, Math.min(1440, parseInt(minutesText) || 120));
    const payload = {
      establishment_id: establishmentId,
      appointment_reminder_enabled: settings.appointment_reminder_enabled,
      appointment_reminder_minutes_before: minutes,
      appointment_reminder_template: settings.appointment_reminder_template,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("notification_settings")
      .upsert(payload, { onConflict: "establishment_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message, { position: "top-center" });
    else {
      setSettings((s) => ({ ...s, appointment_reminder_minutes_before: minutes }));
      toast.success("Configurações salvas!", { position: "top-center", duration: 2000 });
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações e Lembretes
        </CardTitle>
        <CardDescription>
          Configure os lembretes automáticos enviados aos clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {push.supported && (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Notificações neste dispositivo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Receba alertas quando algo importante acontecer no seu salão.
              </p>
            </div>
            {push.isSubscribed ? (
              <Button variant="outline" size="sm" onClick={push.unsubscribe} disabled={push.isLoading}>
                Desativar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => push.subscribe({ scope: "establishment" })}
                disabled={push.isLoading || push.permission === "denied"}
              >
                Ativar
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="reminder-enabled" className="flex flex-col gap-1">
            <span>Lembrete automático de agendamento</span>
            <span className="text-sm text-muted-foreground font-normal">
              Envia uma notificação ao cliente antes do horário marcado.
            </span>
          </Label>
          <Switch
            id="reminder-enabled"
            checked={settings.appointment_reminder_enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, appointment_reminder_enabled: v }))}
          />
        </div>

        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="reminder-minutes">Antecedência (minutos)</Label>
          <Input
            id="reminder-minutes"
            inputMode="decimal"
            value={minutesText}
            onChange={(e) => setMinutesText(e.target.value.replace(/[^0-9]/g, ""))}
            disabled={!settings.appointment_reminder_enabled}
          />
          <p className="text-xs text-muted-foreground">
            Entre 15 e 1440 minutos. Padrão: 120 min (2h antes).
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reminder-template">Texto do lembrete</Label>
          <Textarea
            id="reminder-template"
            rows={3}
            value={settings.appointment_reminder_template}
            onChange={(e) =>
              setSettings((s) => ({ ...s, appointment_reminder_template: e.target.value }))
            }
            disabled={!settings.appointment_reminder_enabled}
          />
          <p className="text-xs text-muted-foreground">
            Variáveis: <code>{"{cliente}"}</code>, <code>{"{servico}"}</code>, <code>{"{hora}"}</code>,{" "}
            <code>{"{profissional}"}</code>.
          </p>
        </div>

        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}
