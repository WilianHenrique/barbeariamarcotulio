import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Save, CalendarDays, AlertTriangle, Link2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { GerenciadorServicos } from "@/components/dashboard/GerenciadorServicos";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { NOMES_DIAS, DEFAULT_DIAS_ABERTOS } from "@/hooks/useDiasFuncionamento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgendamentoConflito {
  id: string;
  nome_cliente: string;
  datetime_start: string;
  servico: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const [notificationUrl, setNotificationUrl] = useState("");
  const [originalNotificationUrl, setOriginalNotificationUrl] = useState("");
  const [loadingNotificationUrl, setLoadingNotificationUrl] = useState(true);
  const [savingNotificationUrl, setSavingNotificationUrl] = useState(false);
  const [publicToken, setPublicToken] = useState("");
  const [loadingPublicLink, setLoadingPublicLink] = useState(true);
  const [savingPublicLink, setSavingPublicLink] = useState(false);

  // Dias de funcionamento
  const [diasAbertos, setDiasAbertos] = useState<number[]>(DEFAULT_DIAS_ABERTOS);
  const [diasOriginais, setDiasOriginais] = useState<number[]>(DEFAULT_DIAS_ABERTOS);
  const [loadingDias, setLoadingDias] = useState(true);
  const [savingDias, setSavingDias] = useState(false);
  const [conflitosDias, setConflitosDias] = useState<AgendamentoConflito[]>([]);
  const [showConflitosDialog, setShowConflitosDialog] = useState(false);

  useEffect(() => {
    loadNotificationUrl();
    loadDiasFuncionamento();
    loadPublicLink();
  }, []);

  const gerarTokenPublico = () => crypto.randomUUID().replace(/-/g, "");

  const salvarPublicToken = async (token: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        user_id: user.id,
        chave: 'public_availability_token',
        valor: token,
      }, { onConflict: 'user_id,chave' });

    if (error) throw error;
  };

  const loadPublicLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('user_id', user.id)
        .eq('chave', 'public_availability_token')
        .maybeSingle();

      if (error) throw error;

      if (data?.valor) {
        setPublicToken(data.valor);
      } else {
        const novoToken = gerarTokenPublico();
        await salvarPublicToken(novoToken);
        setPublicToken(novoToken);
      }
    } catch (err) {
      console.error('Erro ao carregar link público:', err);
      toast.error('Erro ao carregar link público');
    } finally {
      setLoadingPublicLink(false);
    }
  };

  const regenerarPublicLink = async () => {
    setSavingPublicLink(true);
    try {
      const novoToken = gerarTokenPublico();
      await salvarPublicToken(novoToken);
      setPublicToken(novoToken);
      toast.success('Novo link público gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar novo link público:', err);
      toast.error('Erro ao gerar novo link público');
    } finally {
      setSavingPublicLink(false);
    }
  };

  const copiarPublicLink = async () => {
    if (!publicToken) return;
    const base = window.location.origin;
    const url = `${base}/agenda-publica/${publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

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

  const loadDiasFuncionamento = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('user_id', user.id)
        .eq('chave', 'dias_funcionamento')
        .maybeSingle();
      if (error) throw error;
      let dias = DEFAULT_DIAS_ABERTOS;
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor);
          if (Array.isArray(parsed)) dias = parsed.sort((a, b) => a - b);
        } catch {}
      }
      setDiasAbertos(dias);
      setDiasOriginais(dias);
    } catch (err) {
      console.error('Erro ao carregar dias de funcionamento:', err);
      toast.error('Erro ao carregar dias de funcionamento');
    } finally {
      setLoadingDias(false);
    }
  };

  const toggleDia = (dia: number) => {
    setDiasAbertos((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b)
    );
  };

  const persistirDiasFuncionamento = async () => {
    setSavingDias(true);
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
          chave: 'dias_funcionamento',
          valor: JSON.stringify(diasAbertos),
        }, { onConflict: 'user_id,chave' });
      if (error) throw error;
      setDiasOriginais(diasAbertos);
      setShowConflitosDialog(false);
      setConflitosDias([]);
      toast.success('Dias de funcionamento atualizados com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar dias:', err);
      toast.error('Erro ao salvar dias de funcionamento');
    } finally {
      setSavingDias(false);
    }
  };

  const saveDiasFuncionamento = async () => {
    if (diasAbertos.length === 0) {
      toast.error('Selecione pelo menos um dia de funcionamento');
      return;
    }

    const diasRemovidos = diasOriginais.filter((d) => !diasAbertos.includes(d));

    if (diasRemovidos.length === 0) {
      await persistirDiasFuncionamento();
      return;
    }

    setSavingDias(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const agora = new Date().toISOString();
      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, nome_cliente, datetime_start, servico, desmarcado')
        .eq('user_id', user.id)
        .gte('datetime_start', agora)
        .order('datetime_start', { ascending: true });

      if (error) throw error;

      const conflitos = (data || []).filter((ag: any) => {
        if (ag.desmarcado) return false;
        const dia = new Date(ag.datetime_start).getDay();
        return diasRemovidos.includes(dia);
      });

      if (conflitos.length === 0) {
        await persistirDiasFuncionamento();
      } else {
        setConflitosDias(conflitos as AgendamentoConflito[]);
        setShowConflitosDialog(true);
      }
    } catch (err) {
      console.error('Erro ao verificar conflitos:', err);
      toast.error('Erro ao verificar conflitos de agendamentos');
    } finally {
      setSavingDias(false);
    }
  };

  const hasChanges = notificationUrl !== originalNotificationUrl;
  const hasDiasChanges =
    diasAbertos.length !== diasOriginais.length ||
    diasAbertos.some((d, i) => d !== diasOriginais[i]);

  const publicLink = publicToken ? `${window.location.origin}/agenda-publica/${publicToken}` : "";

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

        {/* Dias de Funcionamento */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="text-xl font-display text-primary flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Dias de Funcionamento
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Selecione os dias da semana em que a barbearia está aberta. Esses dias serão usados
              para detectar conflitos em agendamentos recorrentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {loadingDias ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {NOMES_DIAS.map((nome, idx) => {
                    const ativo = diasAbertos.includes(idx);
                    return (
                      <Button
                        key={idx}
                        type="button"
                        variant={ativo ? "default" : "outline"}
                        onClick={() => toggleDia(idx)}
                        className={ativo ? "btn-primary" : ""}
                      >
                        {nome.slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  onClick={saveDiasFuncionamento}
                  disabled={!hasDiasChanges || savingDias}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingDias ? 'Salvando...' : 'Salvar dias de funcionamento'}
                </Button>
                {hasDiasChanges && (
                  <p className="text-xs text-muted-foreground">
                    Você tem alterações não salvas
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Link público de horários */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="text-xl font-display text-primary flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Público de Horários
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Compartilhe este link para que seus clientes vejam os horários reservados e disponíveis do dia, sem login.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {loadingPublicLink ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <Input
                  readOnly
                  value={publicLink}
                  className="font-mono text-sm bg-secondary border-primary/20"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={copiarPublicLink} className="w-full sm:w-auto">
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={regenerarPublicLink}
                    disabled={savingPublicLink}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {savingPublicLink ? 'Gerando...' : 'Gerar novo link'}
                  </Button>
                </div>
              </>
            )}
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

      <Dialog open={showConflitosDialog} onOpenChange={setShowConflitosDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Conflitos de Agendamentos
            </DialogTitle>
            <DialogDescription>
              Os agendamentos abaixo estão marcados em dias que deixarão de ser atendidos.
              Você pode cancelar para reagendá-los pelo dashboard antes de salvar, ou prosseguir
              mantendo-os no calendário.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-2 my-2">
            {conflitosDias.map((c) => {
              const dt = new Date(c.datetime_start);
              return (
                <div key={c.id} className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm">
                  <div className="font-semibold text-foreground">{c.nome_cliente}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(dt, "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-foreground/80">{c.servico}</div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConflitosDialog(false);
                navigate('/');
              }}
            >
              Reagendar no dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConflitosDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={persistirDiasFuncionamento}
              disabled={savingDias}
              className="btn-primary"
            >
              Salvar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;