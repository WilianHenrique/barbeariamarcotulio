import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const navigate = useNavigate();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedNotifications, setCopiedNotifications] = useState(false);

  const webhookUrl = "https://dimwyqenkirksoatesdq.supabase.co/functions/v1/webhook-agendamentos";
  const notificationsUrl = "https://dimwyqenkirksoatesdq.supabase.co/functions/v1/processar-notificacoes";

  const copyToClipboard = (text: string, type: 'webhook' | 'notifications') => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedNotifications(true);
      setTimeout(() => setCopiedNotifications(false), 2000);
    }
    toast.success("URL copiada para a área de transferência!");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Configurações do Sistema</CardTitle>
            <CardDescription className="text-muted-foreground">
              Endpoints e configurações de integração
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Webhook de Recepção */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-foreground">Endpoint de Recepção (N8N)</CardTitle>
            <CardDescription className="text-muted-foreground">
              Use esta URL no seu fluxo N8N para enviar os dados dos agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-foreground">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-sm bg-secondary"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="shrink-0"
                >
                  {copiedWebhook ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-secondary p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-foreground">Configuração no N8N:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Método: <strong>POST</strong></li>
                <li>Content-Type: <strong>application/json</strong></li>
                <li>Envie os dados no formato especificado na documentação</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">📋 Formato esperado:</p>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto text-blue-900">
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

        {/* Endpoint de Notificações */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-foreground">Endpoint de Processamento de Notificações</CardTitle>
            <CardDescription className="text-muted-foreground">
              Configure um cron job para chamar este endpoint periodicamente (sugestão: a cada 5-10 minutos)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notifications-url" className="text-foreground">URL de Notificações</Label>
              <div className="flex gap-2">
                <Input
                  id="notifications-url"
                  value={notificationsUrl}
                  readOnly
                  className="font-mono text-sm bg-secondary"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(notificationsUrl, 'notifications')}
                  className="shrink-0"
                >
                  {copiedNotifications ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-secondary p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-foreground">Como funciona:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Este endpoint verifica agendamentos pendentes</li>
                <li>Envia notificação 24h antes do agendamento</li>
                <li>Envia notificação 1h antes do agendamento</li>
                <li>Dispara para: <code className="bg-white px-1 rounded text-xs">https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio</code></li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <p className="text-sm font-semibold text-amber-900 mb-2">⚙️ Configurar Cron Job:</p>
              <p className="text-sm text-amber-800 mb-2">
                Você pode usar serviços como <strong>cron-job.org</strong> ou <strong>EasyCron</strong> para chamar este endpoint automaticamente.
              </p>
              <p className="text-xs text-amber-700">
                Sugestão: Execute a cada 10 minutos para garantir que as notificações sejam enviadas no momento certo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-foreground">Informações do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Versão:</span>
              <span className="font-semibold text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Barbearia:</span>
              <span className="font-semibold text-foreground">Marco Túlio</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-green-600">✓ Operacional</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;