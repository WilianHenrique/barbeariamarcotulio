import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, User, Phone, Calendar, Edit, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agendamento {
  id: string;
  nome_cliente: string;
  telefone_cliente?: string | null;
  servico: string;
  dia_agendado: string;
  hora_agendada: string;
  status_evento: string;
}

interface ClientesListProps {
  agendamentos: Agendamento[];
  onRefresh: () => void;
}

interface Cliente {
  nome: string;
  telefone: string | null;
  totalAgendamentos: number;
  ultimoAgendamento: string;
}

export const ClientesList = ({ agendamentos, onRefresh }: ClientesListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [originalNome, setOriginalNome] = useState("");

  // Agrupa clientes únicos
  const clientes = useMemo(() => {
    const clientesMap = new Map<string, Cliente>();
    
    agendamentos.forEach(ag => {
      const nomeNormalizado = ag.nome_cliente.trim().toLowerCase();
      const existing = clientesMap.get(nomeNormalizado);
      
      if (existing) {
        existing.totalAgendamentos++;
        if (ag.dia_agendado > existing.ultimoAgendamento) {
          existing.ultimoAgendamento = ag.dia_agendado;
          existing.telefone = ag.telefone_cliente || existing.telefone;
        }
      } else {
        clientesMap.set(nomeNormalizado, {
          nome: ag.nome_cliente,
          telefone: ag.telefone_cliente,
          totalAgendamentos: 1,
          ultimoAgendamento: ag.dia_agendado
        });
      }
    });
    
    return Array.from(clientesMap.values()).sort((a, b) => 
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [agendamentos]);

  // Filtra clientes pela busca
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientes;
    const term = searchTerm.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(term) || 
      c.telefone?.includes(term)
    );
  }, [clientes, searchTerm]);

  // Agendamentos do cliente selecionado
  const agendamentosCliente = useMemo(() => {
    if (!selectedCliente) return [];
    return agendamentos
      .filter(ag => ag.nome_cliente.trim().toLowerCase() === selectedCliente.nome.trim().toLowerCase())
      .sort((a, b) => new Date(b.dia_agendado).getTime() - new Date(a.dia_agendado).getTime());
  }, [agendamentos, selectedCliente]);

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowDetails(true);
  };

  const handleOpenEdit = () => {
    if (selectedCliente) {
      setEditNome(selectedCliente.nome);
      setEditTelefone(selectedCliente.telefone || "");
      setOriginalNome(selectedCliente.nome);
      setShowEdit(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      // Atualiza todos os agendamentos deste cliente
      const { error } = await supabase
        .from("agendamentos")
        .update({
          nome_cliente: editNome.trim(),
          telefone_cliente: editTelefone.trim() || null
        })
        .ilike("nome_cliente", originalNome);

      if (error) throw error;

      toast.success("Dados do cliente atualizados!");
      setShowEdit(false);
      setShowDetails(false);
      setSelectedCliente(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar dados do cliente");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com busca */}
      <Card className="barber-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display text-primary flex items-center gap-2">
            <User className="w-5 h-5" />
            Clientes Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      <Card className="barber-card border-primary/20">
        <CardContent className="p-0">
          {clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clientesFiltrados.map((cliente, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectCliente(cliente)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {cliente.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {cliente.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {cliente.totalAgendamentos} agendamento{cliente.totalAgendamentos !== 1 ? 's' : ''}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes do cliente */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {selectedCliente?.nome}
              </span>
              <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedCliente && (
            <div className="space-y-4">
              {/* Info do cliente */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedCliente.telefone || "Sem telefone"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Último agendamento: {formatDate(selectedCliente.ultimoAgendamento)}</span>
                </div>
              </div>

              {/* Histórico de agendamentos */}
              <div>
                <h4 className="font-medium mb-3 text-sm text-muted-foreground">
                  Histórico de Agendamentos ({agendamentosCliente.length})
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {agendamentosCliente.map((ag) => (
                    <div 
                      key={ag.id}
                      className="p-3 border border-border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{ag.servico}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(ag.dia_agendado)} às {ag.hora_agendada}
                        </p>
                      </div>
                      <Badge 
                        variant={ag.status_evento === "confirmed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {ag.status_evento === "confirmed" ? "Confirmado" : ag.status_evento}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
