"use client";

import { useState, type FormEvent } from "react";
import { data } from "@/lib/formato";

type Resultado = {
  ata: number;
  data_reuniao: string;
  paragrafo: number;
  texto: string;
  url_pdf: string;
  score: number;
};

const EXEMPLOS = [
  "o que o Copom disse sobre câmbio?",
  "como está a inflação de serviços?",
  "o que mudou nas expectativas do Focus?",
  "quais são os riscos para a inflação?",
];

export function PergunteAsAtas({ atas }: { atas: { numero: number; data_reuniao: string }[] }) {
  const [pergunta, setPergunta] = useState("");
  const [ata, setAta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(q: string, a: string) {
    const termo = q.trim();
    if (!termo) {
      setErro("Escreva uma pergunta antes de buscar.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const params = new URLSearchParams({ q: termo });
      if (a) params.set("ata", a);
      const r = await fetch(`/api/busca?${params.toString()}`);
      if (!r.ok) throw new Error(`resposta ${r.status}`);
      const json = (await r.json()) as { resultados: Resultado[] };
      setResultados(json.resultados);
    } catch (e) {
      setErro(`A busca falhou (${e instanceof Error ? e.message : "erro"}). Tente de novo.`);
      setResultados(null);
    } finally {
      setCarregando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(pergunta, ata);
  }

  return (
    <div className="cartao p-4 sm:p-5">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <div className="min-w-0">
          <label htmlFor="pergunta" className="rotulo block mb-1">
            sua pergunta
          </label>
          <input
            id="pergunta"
            name="q"
            type="search"
            className="campo"
            placeholder="ex.: o que o Copom disse sobre câmbio?…"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
          />
        </div>
        <div>
          <label htmlFor="ata" className="rotulo block mb-1">
            em qual ata
          </label>
          <select id="ata" name="ata" className="campo" value={ata} onChange={(e) => setAta(e.target.value)}>
            <option value="">todas as atas</option>
            {[...atas]
              .sort((a, b) => b.numero - a.numero)
              .map((a) => (
                <option key={a.numero} value={a.numero}>
                  {a.numero}ª · {data(a.data_reuniao)}
                </option>
              ))}
          </select>
        </div>
        <div className="sm:self-end">
          <button type="submit" className="botao botao-principal w-full sm:w-auto" disabled={carregando}>
            {carregando ? "buscando…" : "perguntar"}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Perguntas de exemplo">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex}
            type="button"
            className="botao text-xs"
            onClick={() => {
              setPergunta(ex);
              void buscar(ex, ata);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {erro && <p className="text-erro text-sm">{erro}</p>}
        {resultados && resultados.length === 0 && (
          <p className="text-texto-2 text-sm">
            Nenhum parágrafo encontrado com essas palavras. Tente termos mais simples, como “câmbio” ou “inflação”.
          </p>
        )}
        {resultados && resultados.length > 0 && (
          <>
            <p className="text-xs text-texto-2 mb-2">
              {resultados.length} {resultados.length === 1 ? "parágrafo encontrado" : "parágrafos encontrados"}, do mais ao menos relevante. A resposta é o trecho da ata, não um resumo.
            </p>
            <ol className="divide-y divide-borda">
              {resultados.map((r) => (
                <li key={`${r.ata}-${r.paragrafo}`} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-texto-2 num">
                    <span className="text-texto font-semibold">{r.ata}ª reunião</span>
                    <span>{data(r.data_reuniao)}</span>
                    <span>§ {r.paragrafo}</span>
                    <a
                      href={r.url_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ciano underline underline-offset-4"
                    >
                      ver no PDF oficial
                    </a>
                  </div>
                  <p className="trecho text-sm mt-1 break-words">“{r.texto}”</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
