"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function FormLogin() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/painel/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        setSenha("");
        router.refresh();
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      setErro(j.erro ?? `Não foi possível entrar (${r.status}).`);
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="cartao p-5 max-w-md grid gap-3">
      <label htmlFor="senha" className="rotulo">
        senha do painel
      </label>
      <input
        id="senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        className="campo"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
      />
      <button type="submit" className="botao botao-principal justify-center" disabled={enviando}>
        {enviando ? "entrando…" : "entrar"}
      </button>
      <p aria-live="polite" className="text-sm text-erro min-h-[1.25rem]">
        {erro}
      </p>
    </form>
  );
}
