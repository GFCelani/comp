"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function FormEntrada() {
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
    <form onSubmit={entrar} className="grid gap-3" noValidate>
      <label htmlFor="senha" className="rotulo">
        senha
      </label>
      <input
        id="senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        className="campo"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby="senha-erro"
        required
        autoFocus
      />
      <button type="submit" className="botao botao-principal mt-1 w-full" disabled={enviando || senha.length === 0}>
        {enviando ? "entrando…" : "entrar"}
      </button>
      <p id="senha-erro" aria-live="polite" className="min-h-5 text-[13px] text-erro">
        {erro}
      </p>
    </form>
  );
}
