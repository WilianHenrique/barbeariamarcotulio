import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Clock, Power, PowerOff } from "lucide-react";

interface MensagemTemplate {
  id: string;
  tipo: string;
  mensagem: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const MensagensAgendadas = () => {
  const [templates, setTemplates] = useState<MensagemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [mensagem24h, setMensagem24h] = useState("");
  const [mensagem1h, setMensagem1h] = useState("");
  const [ativa24h, setAtiva24h] = useState(true);
  const [ativa1h, setAtiva1h] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("mensagens_template")
        .select("*")
        .eq("ativo", true)
        .order("tipo", { ascending: true });

      if (error) throw error;

      if (data) {
        setTemplates(data);
        const template24h = data.find(t => t.tipo === "24h");
        const template1h = data.find(t => t.tipo === "1h");
        
        if (template24h) {
          setMensagem24h(template24h.mensagem);
          setAtiva24h(template24h.ativo);
        }
        if (template1h) {
          setMensagem1h(template1h.mensagem);
          setAtiva1h(template1h.ativo);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar templates:", error);
      toast({
        title: "Erro ao carregar templates",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle24h = async (checked: boolean) => {
    setAtiva24h(checked);
    try {
      // Atualizar apenas o template de 24h
      const { error } = await supabase
        .from("mensagens_template")
        .update({ ativo: checked })
        .eq("tipo", "24h")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      toast({
        title: checked ? "Mensagem 24h ativada" : "Mensagem 24h desativada",
        description: checked 
          ? "As notificações de 24 horas serão enviadas" 
          : "As notificações de 24 horas foram pausadas",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setAtiva24h(!checked); // Reverter em caso de erro
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const handleToggle1h = async (checked: boolean) => {
    setAtiva1h(checked);
    try {
      // Atualizar apenas o template de 1h
      const { error } = await supabase
        .from("mensagens_template")
        .update({ ativo: checked })
        .eq("tipo", "1h")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      toast({
        title: checked ? "Mensagem 1h ativada" : "Mensagem 1h desativada",
        description: checked 
          ? "As notificações de 1 hora serão enviadas" 
          : "As notificações de 1 hora foram pausadas",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setAtiva1h(!checked); // Reverter em caso de erro
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Desativar templates antigos
      await supabase
        .from("mensagens_template")
        .update({ ativo: false })
        .eq("ativo", true);

      // Inserir novos templates com o status atual
      const { error } = await supabase
        .from("mensagens_template")
        .insert([
          { tipo: "24h", mensagem: mensagem24h, ativo: ativa24h },
          { tipo: "1h", mensagem: mensagem1h, ativo: ativa1h },
        ]);

      if (error) throw error;

      toast({
        title: "Templates salvos!",
        description: "As mensagens foram atualizadas com sucesso.",
      });

      loadTemplates();
    } catch (error) {
      console.error("Erro ao salvar templates:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as mensagens.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="barber-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Mensagens Agendadas
          </CardTitle>
          <CardDescription>
            Personalize as mensagens que serão enviadas aos clientes antes dos agendamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mensagem 24h */}
          <div className="space-y-4 p-4 border border-border/50 rounded-lg bg-card/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label htmlFor="msg-24h" className="text-base font-semibold">
                  Mensagem 24 horas antes
                </Label>
                <Badge variant="outline" className="text-xs">
                  24h antes
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="switch-24h" className="text-sm text-muted-foreground">
                  {ativa24h ? "Ativa" : "Inativa"}
                </Label>
                <Switch
                  id="switch-24h"
                  checked={ativa24h}
                  onCheckedChange={handleToggle24h}
                />
                {ativa24h ? (
                  <Power className="h-4 w-4 text-green-500" />
                ) : (
                  <PowerOff className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <Textarea
              id="msg-24h"
              value={mensagem24h}
              onChange={(e) => setMensagem24h(e.target.value)}
              placeholder="Digite a mensagem que será enviada 24 horas antes do agendamento"
              className="min-h-[120px] bg-background/50"
              rows={5}
              disabled={!ativa24h}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{hora_agendada}"}, {"{servico}"}, {"{nome_cliente}"}
            </p>
          </div>

          {/* Mensagem 1h */}
          <div className="space-y-4 p-4 border border-border/50 rounded-lg bg-card/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label htmlFor="msg-1h" className="text-base font-semibold">
                  Mensagem 1 hora antes
                </Label>
                <Badge variant="outline" className="text-xs">
                  1h antes
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="switch-1h" className="text-sm text-muted-foreground">
                  {ativa1h ? "Ativa" : "Inativa"}
                </Label>
                <Switch
                  id="switch-1h"
                  checked={ativa1h}
                  onCheckedChange={handleToggle1h}
                />
                {ativa1h ? (
                  <Power className="h-4 w-4 text-green-500" />
                ) : (
                  <PowerOff className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <Textarea
              id="msg-1h"
              value={mensagem1h}
              onChange={(e) => setMensagem1h(e.target.value)}
              placeholder="Digite a mensagem que será enviada 1 hora antes do agendamento"
              className="min-h-[120px] bg-background/50"
              rows={5}
              disabled={!ativa1h}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{hora_agendada}"}, {"{servico}"}, {"{nome_cliente}"}
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full barber-button-primary"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Mensagens
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
