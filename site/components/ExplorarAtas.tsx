"use client";

import { useId, useState } from "react";
import type { Ata, ParagrafoAta } from "@/lib/dados";
import { dataCurta, indice as fmtIndice, tomRotulo } from "@/lib/formato";

type Filtro = "todos" | "duros" | "brandos";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "todos" },
  { valor: "duros", rotulo: "mais duros" },
  { valor: "brandos", rotulo: "mais brandos" },
];

function fmtNota(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function classeNota(n: number) {
  if (n > 0) return "bg-acento-suave text-acento";
  if (n < 0) return "bg-papel-2 text-tinta-2";
  return "bg-papel text-tinta-3 border border-linha";
}

function filtrar(paragrafos: ParagrafoAta[], filtro: Filtro): ParagrafoAta[] {
  if (filtro === "duros") return paragrafos.filter((p) => p.nota > 0).sort((a, b) => b.nota - a.nota || a.paragrafo - b.paragrafo);
  if (filtro === "brandos") return paragrafos.filter((p) => p.nota < 0).sort((a, b) => a.nota - b.nota || a.paragrafo - b.paragrafo);
  return [...paragrafos].sort((a, b) => a.paragrafo - b.paragrafo);
}

/** Escolha uma reunião e veja os parágrafos que receberam nota diferente de zero. */
export function ExplorarAtas({
  atas,
  revisadas = [],
  ataInicial,
}: {
  atas: Ata[];
  revisadas?: string[];
  /** Número da ata aberta de início. Padrão: a mais recente. */
  ataInicial?: number;
}) {
  const base = useId();
  const painelId = `${base}-painel`;
  const seletorId = `${base}-seletor`;
  const ordenadas = [...atas].sort((a, b) => b.numero - a.numero);
  const [numero, setNumero] = useState<number | undefined>(
    ataInicial !== undefined && atas.some((a) => a.numero === ataInicial) ? ataInicial : ordenadas[0]?.numero,
  );
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const revisadasSet = new Set(revisadas);

  const posicao = Math.max(
    0,
    ordenadas.findIndex((a) => a.numero === numero),
  );
  const atual = ordenadas[posicao];

  if (!atual) {
    return <p className="aguardando">Nenhuma ata no banco ainda.</p>;
  }

  const anterior = ordenadas[posicao + 1]; // reunião mais antiga
  const proxima = ordenadas[posicao - 1]; // reunião mais recente
  const nDuros = atual.paragrafos.filter((p) => p.nota > 0).length;
  const nBrandos = atual.paragrafos.filter((p) => p.nota < 0).length;
  const contagem: Record<Filtro, number> = { todos: atual.paragrafos.length, duros: nDuros, brandos: nBrandos };
  const lista = filtrar(atual.paragrafos, filtro);

  return (
    <div className="grid gap-6 md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-0">
      {/* seletor: select + anterior/próxima no celular, lista rolável no desktop */}
      <div className="md:border-r md:border-linha md:pr-5">
        <div className="md:hidden">
          <label htmlFor={seletorId} className="rotulo mb-1.5 block">
            Reunião
          </label>
          <select
            id={seletorId}
            className="campo num"
            value={atual.numero}
            onChange={(e) => setNumero(Number(e.target.value))}
            aria-controls={painelId}
          >
            {ordenadas.map((a) => (
              <option key={a.numero} value={a.numero}>
                Ata {a.numero} · {dataCurta(a.data_reuniao)} · índice {fmtIndice(a.indice)}
              </option>
            ))}
          </select>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              className="botao flex-1"
              disabled={!anterior}
              onClick={() => anterior && setNumero(anterior.numero)}
              aria-controls={painelId}
            >
              ← anterior
            </button>
            <button
              type="button"
              className="botao flex-1"
              disabled={!proxima}
              onClick={() => proxima && setNumero(proxima.numero)}
              aria-controls={painelId}
            >
              próxima →
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          <p className="rotulo mb-2 flex justify-between pr-3 pl-3.5">
            <span>Reunião</span>
            <span>índice</span>
          </p>
          <ul aria-label="Reuniões do Copom" className="max-h-[34rem] overflow-y-auto overscroll-contain border-t border-linha">
            {ordenadas.map((a) => {
              const ativa = a.numero === atual.numero;
              return (
                <li key={a.numero}>
                  <button
                    type="button"
                    onClick={() => setNumero(a.numero)}
                    aria-current={ativa ? "true" : undefined}
                    aria-controls={painelId}
                    className={[
                      "num grid w-full cursor-pointer grid-cols-[2.25rem_1fr_auto] items-baseline gap-2 border-b border-l-2 border-b-linha py-2 pr-3 pl-3 text-left text-sm transition-colors",
                      ativa
                        ? "border-l-acento bg-papel-2 text-tinta"
                        : "border-l-transparent text-tinta-2 hover:bg-papel-2 hover:text-tinta",
                    ].join(" ")}
                  >
                    <span className={ativa ? "font-semibold" : "font-medium"}>{a.numero}</span>
                    <span className="text-[0.8125rem] text-tinta-3">{dataCurta(a.data_reuniao)}</span>
                    <span className={ativa ? "font-semibold text-acento" : ""}>{fmtIndice(a.indice)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* parágrafos da reunião escolhida */}
      <section id={painelId} aria-label={`Ata ${atual.numero}`} className="min-w-0 md:pl-8">
        <p className="sr-only" aria-live="polite">
          Ata {atual.numero}, {lista.length} parágrafos na lista
        </p>
        <header className="border-b border-linha pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="titulo-serifa num text-[1.625rem] leading-tight">
              Ata {atual.numero} · {dataCurta(atual.data_reuniao)}
            </h3>
            <a href={atual.url_pdf} target="_blank" rel="noopener noreferrer" className="link text-sm">
              abrir a ata em PDF
            </a>
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="rotulo">índice</span>
            <span className="num text-xl font-semibold text-acento">{fmtIndice(atual.indice)}</span>
            <span className="text-[0.9375rem] text-tinta-2">{tomRotulo(atual.indice)}</span>
          </p>
          <p className="texto-2 num mt-1">
            {atual.n_nao_zero} de {atual.n_paragrafos} parágrafos com nota diferente de zero
          </p>

          {atual.paragrafos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar parágrafos">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className="botao min-h-9 px-3.5 text-[0.8125rem]"
                  aria-pressed={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.rotulo}
                  <span className="num opacity-70">{contagem[f.valor]}</span>
                </button>
              ))}
            </div>
          )}
        </header>

        {atual.paragrafos.length === 0 ? (
          <p className="texto-2 py-5">Nenhum parágrafo com nota diferente de zero nesta ata.</p>
        ) : lista.length === 0 ? (
          <p className="texto-2 py-5">Nenhum parágrafo neste filtro nesta ata.</p>
        ) : (
          <ol className="divide-y divide-linha">
            {lista.map((p) => {
              const revisado = revisadasSet.has(`${atual.numero}.${p.paragrafo}`);
              return (
                <li key={p.paragrafo} className="grid grid-cols-[2.75rem_2.5rem_minmax(0,1fr)] items-start gap-x-3 py-4">
                  <span className="rotulo num pt-[0.2rem]">§{p.paragrafo}</span>
                  <span
                    className={`num mt-[0.1rem] inline-flex h-6 items-center justify-center rounded-[4px] text-[0.8125rem] font-semibold ${classeNota(p.nota)}`}
                  >
                    <span className="sr-only">nota </span>
                    {fmtNota(p.nota)}
                  </span>
                  <div className="min-w-0">
                    {p.trecho ? (
                      <p className="trecho text-[1.0625rem] leading-[1.6] break-words">“{p.trecho}”</p>
                    ) : (
                      <p className="aguardando pt-[0.2rem]">trecho não passou na checagem</p>
                    )}
                    {revisado && <span className="selo mt-2">revisado pelo time</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
