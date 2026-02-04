import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBRLInput, parseBRLToNumber } from "@/lib/currency";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Venda {
  id: string;
  descricao_produto: string;
  valor: number;
  nome_comprador: string | null;
  created_at: string;
}

const ITENS_POR_PAGINA = 10;

export const Vendas = () => {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [nomeComprador, setNomeComprador] = useState("");
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editNomeComprador, setEditNomeComprador] = useState("");

  useEffect(() => {
    carregarVendas();
  }, []);

  useEffect(() => {
    // Sempre voltar para a primeira página quando o total de vendas mudar
    setPaginaAtual(1);
  }, [vendas.length]);

  const carregarVendas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("vendas")
        .select("id, descricao_produto, valor, nome_comprador, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendas((data || []) as Venda[]);
    } catch (error) {
      console.error("Erro ao carregar vendas", error);
      toast.error("Erro ao carregar vendas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistrarVenda = async () => {
    if (!descricao.trim()) {
      toast.error("Informe o produto vendido");
      return;
    }

    const valorNumber = parseBRLToNumber(valor);
    if (!valorNumber || valorNumber <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase
        .from("vendas")
        .insert({
          user_id: user.id,
          descricao_produto: descricao.trim(),
          valor: valorNumber,
          nome_comprador: nomeComprador.trim() || null,
        })
        .select("id, descricao_produto, valor, nome_comprador, created_at")
        .single();

      if (error) throw error;

      setVendas((prev) => (data ? [data as Venda, ...prev] : prev));
      setDescricao("");
      setValor("");
      setNomeComprador("");
      toast.success("Venda registrada com sucesso");
    } catch (error) {
      console.error("Erro ao registrar venda", error);
      toast.error("Erro ao registrar venda");
    }
  };

  const iniciarEdicao = (venda: Venda) => {
    setEditandoId(venda.id);
    setEditDescricao(venda.descricao_produto);
    // garante 2 casas e formato pt-BR
    setEditValor(
      Number(venda.valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setEditNomeComprador(venda.nome_comprador || "");
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditDescricao("");
    setEditValor("");
    setEditNomeComprador("");
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;

    if (!editDescricao.trim()) {
      toast.error("Informe o produto vendido");
      return;
    }

    const valorNumber = parseBRLToNumber(editValor);
    if (!valorNumber || valorNumber <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase
        .from("vendas")
        .update({
          descricao_produto: editDescricao.trim(),
          valor: valorNumber,
          nome_comprador: editNomeComprador.trim() || null,
        })
        .eq("id", editandoId)
        .eq("user_id", user.id)
        .select("id, descricao_produto, valor, nome_comprador, created_at")
        .single();

      if (error) throw error;

      setVendas((prev) => prev.map((v) => (v.id === editandoId && data ? (data as Venda) : v)));
      cancelarEdicao();
      toast.success("Venda atualizada com sucesso");
    } catch (error) {
      console.error("Erro ao atualizar venda", error);
      toast.error("Erro ao atualizar venda");
    }
  };

  const excluirVenda = async (id: string) => {
    const confirmar = window.confirm("Tem certeza que deseja excluir esta venda?");
    if (!confirmar) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { error } = await supabase.from("vendas").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;

      setVendas((prev) => prev.filter((v) => v.id !== id));
      if (editandoId === id) {
        cancelarEdicao();
      }
      toast.success("Venda excluída com sucesso");
    } catch (error) {
      console.error("Erro ao excluir venda", error);
      toast.error("Erro ao excluir venda");
    }
  };

  const totalVendas = vendas.reduce((sum, v) => sum + Number(v.valor || 0), 0);

  const totalPaginas = Math.ceil(vendas.length / ITENS_POR_PAGINA) || 1;
  const indiceInicial = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const vendasPagina = vendas.slice(indiceInicial, indiceInicial + ITENS_POR_PAGINA);

  const produtosMaisVendidos = Object.values(
    vendas.reduce<Record<string, { descricao: string; quantidade: number; total: number }>>((acc, v) => {
      const key = v.descricao_produto.toLowerCase();
      if (!acc[key]) {
        acc[key] = { descricao: v.descricao_produto, quantidade: 0, total: 0 };
      }
      acc[key].quantidade += 1;
      acc[key].total += Number(v.valor || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.quantidade - a.quantidade);

  return (
    <div className="space-y-6">
      <Card className="barber-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">Registrar Venda de Produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="descricao">Produto vendido</Label>
              <Input
                id="descricao"
                placeholder="Ex: Pomada modeladora"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                placeholder="Ex: 49,90"
                value={valor}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => {
                  const next = e.target.value;
                  setValor(next.trim() ? formatBRLInput(next) : "");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nomeComprador">Nome do comprador (opcional)</Label>
              <Input
                id="nomeComprador"
                placeholder="Ex: João Silva"
                value={nomeComprador}
                onChange={(e) => setNomeComprador(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleRegistrarVenda}>
              Registrar venda
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="barber-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary flex items-center justify-between">
            <span>Histórico de Vendas</span>
            <span className="text-sm font-normal text-muted-foreground">
              Total: <span className="font-semibold text-primary">R$ {totalVendas.toFixed(2)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : vendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada até o momento.</p>
          ) : (
            <div className="space-y-4">
              <div className="relative w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                      <TableHead className="w-[160px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasPagina.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell>
                          {new Date(venda.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {editandoId === venda.id ? (
                            <Input
                              value={editDescricao}
                              onChange={(e) => setEditDescricao(e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            venda.descricao_produto
                          )}
                        </TableCell>
                        <TableCell>
                          {editandoId === venda.id ? (
                            <Input
                              value={editNomeComprador}
                              onChange={(e) => setEditNomeComprador(e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            venda.nome_comprador || "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editandoId === venda.id ? (
                            <Input
                              value={editValor}
                              inputMode="numeric"
                              autoComplete="off"
                              onChange={(e) => {
                                const next = e.target.value;
                                setEditValor(next.trim() ? formatBRLInput(next) : "");
                              }}
                              className="h-8 text-right"
                            />
                          ) : (
                            Number(venda.valor).toFixed(2)
                          )}
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {editandoId === venda.id ? (
                            <>
                              <Button size="sm" variant="outline" onClick={salvarEdicao}>
                                Salvar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelarEdicao}>
                                Cancelar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => excluirVenda(venda.id)}>
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => iniciarEdicao(venda)}>
                              Editar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {vendas.length > ITENS_POR_PAGINA && (
                <Pagination className="mt-2">
                  <PaginationContent>
                    {paginaAtual > 1 && (
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPaginaAtual((pagina) => Math.max(1, pagina - 1));
                          }}
                        />
                      </PaginationItem>
                    )}

                    {Array.from({ length: totalPaginas }).map((_, index) => {
                      const pagina = index + 1;
                      return (
                        <PaginationItem key={pagina}>
                          <PaginationLink
                            href="#"
                            isActive={paginaAtual === pagina}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaginaAtual(pagina);
                            }}
                          >
                            {pagina}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    {paginaAtual < totalPaginas && (
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1));
                          }}
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {produtosMaisVendidos.length > 0 && (
        <Card className="barber-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">Produtos mais vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {produtosMaisVendidos.map((produto) => (
                <div
                  key={produto.descricao}
                  className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{produto.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {produto.quantidade} venda(s) • R$ {produto.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Vendas;
