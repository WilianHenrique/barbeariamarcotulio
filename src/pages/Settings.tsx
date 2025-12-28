import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ArrowLeft, Bell, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { GerenciadorServicos } from "@/components/dashboard/GerenciadorServicos";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [notificationUrl, setNotificationUrl] = useState("");
  const [originalNotificationUrl, setOriginalNotificationUrl] = useState("");
  const [loadingNotificationUrl, setLoadingNotificationUrl] = useState(true);
  const [savingNotificationUrl, setSavingNotificationUrl] = useState(false);

  const webhookUrl = "https://dimwyqenkirksoatesdq.supabase.co/functions/v1/webhook-agendamentos";

  useEffect(() => {
    loadNotificationUrl();
  }, []);

  const loadNotificationUrl = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('user_id', user.id)
        .eq('chave', 'notification_url')
        .maybeSingle();

      if (error) throw error;

      const url = data?.valor || 'https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio';
      setNotificationUrl(url);
      setOriginalNotificationUrl(url);
    } catch (error) {
      console.error('Erro ao carregar URL de notificações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoadingNotificationUrl(false);
    }
  };

  const saveNotificationUrl = async () => {
    if (!notificationUrl.trim()) {
      toast.error('URL não pode estar vazio');
      return;
    }

    try {
      new URL(notificationUrl);
    } catch {
      toast.error('URL inválida');
      return;
    }

    setSavingNotificationUrl(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          user_id: user.id,
          chave: 'notification_url',
          valor: notificationUrl.trim()
        }, {
          onConflict: 'user_id,chave'
        });

      if (error) throw error;

      setOriginalNotificationUrl(notificationUrl);
      toast.success('URL de notificações atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar URL:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingNotificationUrl(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast.success("URL copiada para a área de transferência!");
  };

  const hasChanges = notificationUrl !== originalNotificationUrl;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <Card className="barber-card border-primary/30 shadow-glow">
          <CardHeader>
            <CardTitle className="text-3xl font-display text-primary">Configurações do Sistema</CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              Gerenciamento de serviços e integrações
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Gerenciamento de Serviços */}
        <GerenciadorServicos />

        {/* Webhook de Recepção */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="text-xl font-display text-primary">Endpoint de Recepção (N8N)</CardTitle>
            <CardDescription className="text-muted-foreground">
              Use esta URL no seu fluxo N8N para enviar os dados dos agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-foreground">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-sm bg-secondary border-primary/20"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="shrink-0 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                >
                  {copiedWebhook ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-secondary/50 border border-primary/20 p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-primary">Configuração no N8N:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Método: <strong className="text-foreground">POST</strong></li>
                <li>Content-Type: <strong className="text-foreground">application/json</strong></li>
                <li>Autenticação: <strong className="text-foreground">Não é necessária</strong></li>
                <li>Envie os dados no formato especificado na documentação</li>
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/30 p-4 rounded-lg">
              <p className="text-sm font-semibold text-primary mb-2">📋 Formato esperado:</p>
              <pre className="text-xs bg-background p-3 rounded border border-primary/20 overflow-x-auto text-foreground">
{`[
  {
    "id_evento": "abc123",
    "Nome_cliente": "João Silva",
    "dateTime-start": "2025-11-15T14:00:00-03:00",
    "dateTime-end": "2025-11-15T15:00:00-03:00",
    "Dia_agendado_formatado": "15/11/2025",
    "Dia_agendado": "2025-11-15",
    "Hora_agendada": "14:00",
    "Hora_final": "15:00",
    "Link_evento": "https://...",
    "servico": "cabelo + barba",
    "tempo_total_minutos": "60",
    "Status_Evento": "Evento criado",
    "EventoRecorrente": "Não"
  }
]`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Informação sobre Notificações Automáticas */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="text-xl font-display text-primary flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Sistema de Notificações Automáticas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/30 p-4 rounded-lg">
                <p className="text-sm font-semibold text-primary mb-2">✅ Configuração Automática Ativada</p>
                <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                  <li>O sistema verifica automaticamente os agendamentos a cada 1 minuto</li>
                  <li>Notificações são enviadas automaticamente 24 horas antes do horário agendado</li>
                  <li>Notificações são enviadas automaticamente 1 hora antes do horário agendado</li>
                  <li>Não é necessário configurar nada manualmente - tudo funciona automaticamente!</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="notification-url" className="text-foreground font-semibold">
                  Destino das Notificações (Webhook):
                </Label>
                {loadingNotificationUrl ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    <Input
                      id="notification-url"
                      value={notificationUrl}
                      onChange={(e) => setNotificationUrl(e.target.value)}
                      placeholder="https://..."
                      className="font-mono text-sm bg-secondary border-primary/20"
                    />
                    <Button
                      onClick={saveNotificationUrl}
                      disabled={!hasChanges || savingNotificationUrl}
                      className="w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingNotificationUrl ? 'Salvando...' : 'Salvar URL'}
                    </Button>
                    {hasChanges && (
                      <p className="text-xs text-muted-foreground">
                        Você tem alterações não salvas
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="text-xl font-display text-primary">Informações do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <div className="flex justify-between py-2 border-b border-primary/10">
              <span className="text-muted-foreground">Versão:</span>
              <span className="font-semibold text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-primary/10">
              <span className="text-muted-foreground">Barbearia:</span>
              <span className="font-semibold text-primary">Marco Túlio</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-primary">✓ Operacional</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;