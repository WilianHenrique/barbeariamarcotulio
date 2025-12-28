import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Servico {
  id: string;
  nome: string;
  duracao_minutos: number;
  ativo: boolean;
  ordem: number;
  preco_normal: number;
  preco_fidelidade: number;
}

export const GerenciadorServicos = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoServico, setNovoServico] = useState({ nome: "", duracao: "", precoNormal: "", precoFidelidade: "" });
  const [editServico, setEditServico] = useState({ nome: "", duracao: "", precoNormal: "", precoFidelidade: "" });
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    carregarServicos();
  }, []);

  const carregarServicos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('ordem');

      if (error) throw error;
      setServicos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar serviços: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const adicionarServico = async () => {
    if (!novoServico.nome.trim() || !novoServico.duracao || !novoServico.precoNormal || !novoServico.precoFidelidade) {
      toast.error("Preencha todos os campos");
      return;
    }

    const duracao = parseInt(novoServico.duracao);
    const precoNormal = parseFloat(novoServico.precoNormal);
    const precoFidelidade = parseFloat(novoServico.precoFidelidade);
    
    if (duracao <= 0) {
      toast.error("Duração deve ser maior que 0");
      return;
    }
    
    if (precoNormal <= 0 || precoFidelidade <= 0) {
      toast.error("Preços devem ser maiores que 0");
      return;
    }
    
    if (precoFidelidade > precoNormal) {
      toast.error("Preço fidelidade deve ser menor ou igual ao preço normal");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maxOrdem = servicos.length > 0 ? Math.max(...servicos.map(s => s.ordem)) : 0;

      const { error } = await supabase
        .from('servicos')
        .insert({
          user_id: user.id,
          nome: novoServico.nome.trim(),
          duracao_minutos: duracao,
          preco_normal: precoNormal,
          preco_fidelidade: precoFidelidade,
          ordem: maxOrdem + 1,
          ativo: true
        });

      if (error) throw error;

      toast.success("Serviço adicionado com sucesso!");
      setNovoServico({ nome: "", duracao: "", precoNormal: "", precoFidelidade: "" });
      setAdicionando(false);
      carregarServicos();
    } catch (error: any) {
      toast.error("Erro ao adicionar serviço: " + error.message);
    }
  };

  const iniciarEdicao = (servico: Servico) => {
    setEditandoId(servico.id);
    setEditServico({
      nome: servico.nome,
      duracao: servico.duracao_minutos.toString(),
      precoNormal: servico.preco_normal.toString(),
      precoFidelidade: servico.preco_fidelidade.toString()
    });
  };

  const salvarEdicao = async (id: string) => {
    if (!editServico.nome.trim() || !editServico.duracao || !editServico.precoNormal || !editServico.precoFidelidade) {
      toast.error("Preencha todos os campos");
      return;
    }

    const duracao = parseInt(editServico.duracao);
    const precoNormal = parseFloat(editServico.precoNormal);
    const precoFidelidade = parseFloat(editServico.precoFidelidade);
    
    if (duracao <= 0) {
      toast.error("Duração deve ser maior que 0");
      return;
    }
    
    if (precoNormal <= 0 || precoFidelidade <= 0) {
      toast.error("Preços devem ser maiores que 0");
      return;
    }
    
    if (precoFidelidade > precoNormal) {
      toast.error("Preço fidelidade deve ser menor ou igual ao preço normal");
      return;
    }

    try {
      const { error } = await supabase
        .from('servicos')
        .update({
          nome: editServico.nome.trim(),
          duracao_minutos: duracao,
          preco_normal: precoNormal,
          preco_fidelidade: precoFidelidade
        })
        .eq('id', id);

      if (error) throw error;

      toast.success("Serviço atualizado com sucesso!");
      setEditandoId(null);
      carregarServicos();
    } catch (error: any) {
      toast.error("Erro ao atualizar serviço: " + error.message);
    }
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditServico({ nome: "", duracao: "", precoNormal: "", precoFidelidade: "" });
  };

  const excluirServico = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('servicos')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      toast.success("Serviço excluído com sucesso!");
      carregarServicos();
    } catch (error: any) {
      toast.error("Erro ao excluir serviço: " + error.message);
    }
  };

  if (isLoading) {
    return (
      <Card className="barber-card border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="barber-card border-primary/20">
      <CardHeader className="border-b border-primary/10">
        <CardTitle className="text-xl font-display text-primary flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          Gerenciamento de Serviços
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Crie, edite ou exclua os serviços disponíveis na sua barbearia
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Lista de Serviços */}
        <div className="space-y-2">
          {servicos.map((servico) => (
            <div
              key={servico.id}
              className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg border border-primary/10 hover:border-primary/30 transition-colors"
            >
              {editandoId === servico.id ? (
                <>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      value={editServico.nome}
                      onChange={(e) => setEditServico({ ...editServico, nome: e.target.value })}
                      placeholder="Nome do serviço"
                      className="bg-background border-primary/20"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={editServico.duracao}
                        onChange={(e) => setEditServico({ ...editServico, duracao: e.target.value })}
                        placeholder="Duração"
                        min="1"
                        className="bg-background border-primary/20"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editServico.precoNormal}
                        onChange={(e) => setEditServico({ ...editServico, precoNormal: e.target.value })}
                        placeholder="Preço"
                        min="0"
                        className="bg-background border-primary/20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editServico.precoFidelidade}
                        onChange={(e) => setEditServico({ ...editServico, precoFidelidade: e.target.value })}
                        placeholder="Fidelidade"
                        min="0"
                        className="bg-background border-primary/20"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => salvarEdicao(servico.id)}
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelarEdicao}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{servico.nome}</h4>
                    <p className="text-sm text-muted-foreground">{servico.duracao_minutos} minutos</p>
                    <div className="flex gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Normal: <span className="text-primary font-medium">R$ {servico.preco_normal.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fidelidade: <span className="text-accent font-medium">R$ {servico.preco_fidelidade.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => iniciarEdicao(servico)}
                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => excluirServico(servico.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {servicos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum serviço cadastrado. Adicione seu primeiro serviço abaixo.
            </div>
          )}
        </div>

        {/* Adicionar Novo Serviço */}
        {adicionando ? (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="novo-nome" className="text-foreground">Nome do Serviço</Label>
                <Input
                  id="novo-nome"
                  value={novoServico.nome}
                  onChange={(e) => setNovoServico({ ...novoServico, nome: e.target.value })}
                  placeholder="Ex: Corte de Cabelo"
                  className="bg-background border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nova-duracao" className="text-foreground">Duração (minutos)</Label>
                <Input
                  id="nova-duracao"
                  type="number"
                  value={novoServico.duracao}
                  onChange={(e) => setNovoServico({ ...novoServico, duracao: e.target.value })}
                  placeholder="Ex: 30"
                  min="1"
                  className="bg-background border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-preco-normal" className="text-foreground">Preço Normal (R$)</Label>
                <Input
                  id="novo-preco-normal"
                  type="number"
                  step="0.01"
                  value={novoServico.precoNormal}
                  onChange={(e) => setNovoServico({ ...novoServico, precoNormal: e.target.value })}
                  placeholder="Ex: 50.00"
                  min="0"
                  className="bg-background border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-preco-fidelidade" className="text-foreground">Preço Fidelidade (R$)</Label>
                <Input
                  id="novo-preco-fidelidade"
                  type="number"
                  step="0.01"
                  value={novoServico.precoFidelidade}
                  onChange={(e) => setNovoServico({ ...novoServico, precoFidelidade: e.target.value })}
                  placeholder="Ex: 40.00"
                  min="0"
                  className="bg-background border-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={adicionarServico}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-2" />
                Salvar Serviço
              </Button>
              <Button
                onClick={() => {
                  setAdicionando(false);
                  setNovoServico({ nome: "", duracao: "", precoNormal: "", precoFidelidade: "" });
                }}
                variant="outline"
                className="border-primary/30 hover:bg-primary/10"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setAdicionando(true)}
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/10 hover:border-primary/50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Novo Serviço
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
