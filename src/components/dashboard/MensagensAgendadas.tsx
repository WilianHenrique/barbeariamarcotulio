import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Clock } from "lucide-react";

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
        
        if (template24h) setMensagem24h(template24h.mensagem);
        if (template1h) setMensagem1h(template1h.mensagem);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Desativar templates antigos
      await supabase
        .from("mensagens_template")
        .update({ ativo: false })
        .eq("ativo", true);

      // Inserir novos templates
      const { error } = await supabase
        .from("mensagens_template")
        .insert([
          { tipo: "24h", mensagem: mensagem24h, ativo: true },
          { tipo: "1h", mensagem: mensagem1h, ativo: true },
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="msg-24h">Mensagem 24 horas antes</Label>
              <Badge variant="outline" className="text-xs">
                24h antes
              </Badge>
            </div>
            <Textarea
              id="msg-24h"
              value={mensagem24h}
              onChange={(e) => setMensagem24h(e.target.value)}
              placeholder="Digite a mensagem que será enviada 24 horas antes do agendamento"
              className="min-h-[120px] bg-background/50"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{hora_agendada}"}, {"{servico}"}, {"{nome_cliente}"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="msg-1h">Mensagem 1 hora antes</Label>
              <Badge variant="outline" className="text-xs">
                1h antes
              </Badge>
            </div>
            <Textarea
              id="msg-1h"
              value={mensagem1h}
              onChange={(e) => setMensagem1h(e.target.value)}
              placeholder="Digite a mensagem que será enviada 1 hora antes do agendamento"
              className="min-h-[120px] bg-background/50"
              rows={5}
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
