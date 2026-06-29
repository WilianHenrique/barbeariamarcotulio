import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const NOMES_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// Default: Terça a Sábado (barbearia fechada Dom/Seg)
const DEFAULT_DIAS_ABERTOS = [2, 3, 4, 5, 6];

export const useDiasFuncionamento = () => {
  const [diasAbertos, setDiasAbertos] = useState<number[]>(DEFAULT_DIAS_ABERTOS);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }

      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("user_id", user.id)
        .eq("chave", "dias_funcionamento")
        .maybeSingle();

      if (error) throw error;

      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor);
          if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
            setDiasAbertos(parsed.sort((a, b) => a - b));
          }
        } catch {
          // mantém default
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dias de funcionamento:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const diasFechados = [0, 1, 2, 3, 4, 5, 6].filter((d) => !diasAbertos.includes(d));

  const isDiaAberto = (dia: number) => diasAbertos.includes(dia);

  return { diasAbertos, diasFechados, isDiaAberto, carregando, recarregar: carregar };
};

export { DEFAULT_DIAS_ABERTOS };