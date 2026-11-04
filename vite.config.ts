import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/**
 * O `.env` do projeto é a fonte de verdade para a conexão com o banco de dados.
 * Isso é necessário porque o ambiente do Lovable Cloud injeta suas próprias
 * variáveis VITE_SUPABASE_* no processo, e variáveis já presentes no processo
 * têm prioridade sobre o que está escrito no arquivo. Como agora usamos um banco
 * de dados externo, relamos o `.env` e aplicamos os valores no processo antes
 * de o Vite ler as variáveis de ambiente.
 */
function aplicarEnvDoArquivo() {
  const arquivo = path.resolve(__dirname, ".env");
  if (!fs.existsSync(arquivo)) return;

  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const igual = linha.indexOf("=");
    if (igual === -1) continue;

    const chave = linha.slice(0, igual).trim();
    if (!chave.startsWith("VITE_")) continue;

    const valor = linha
      .slice(igual + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    process.env[chave] = valor;
  }
}

aplicarEnvDoArquivo();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
