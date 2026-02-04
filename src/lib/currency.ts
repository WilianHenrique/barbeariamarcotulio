export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Recebe um input livre e retorna uma string formatada como moeda BR (sem o prefixo "R$"),
 * sempre com 2 casas decimais. Ex:
 * "1" -> "0,01" | "123" -> "1,23" | "123456" -> "1.234,56"
 */
export function formatBRLInput(value: string) {
  const digits = onlyDigits(value);
  if (!digits) return "";

  const cents = Number(digits);
  if (!Number.isFinite(cents) || cents <= 0) {
    // Mantém o comportamento de permitir limpar o campo
    return "0,00";
  }

  const numberValue = cents / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string pt-BR (com '.' milhar e ',' decimal) para number.
 * Retorna NaN quando vazio/inválido.
 */
export function parseBRLToNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").trim();
  if (!normalized) return Number.NaN;
  return Number(normalized);
}
