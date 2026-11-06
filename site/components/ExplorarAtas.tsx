"use client";

import { useState } from "react";
import type { Ata } from "@/lib/dados";
import { data, indice as fmtIndice, tomRotulo } from "@/lib/formato";

function corNota(n: number) {
  if (n > 0) return "text-duro";
  if (n < 0) return "text-brando";
  return "text-texto-2";
}

function fmtNota(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

export function ExplorarAtas({ atas, revisadas = [] }: { atas: Ata[]; revisadas?: string[] }) {
  const ordenadas = [...atas].sort((a, b) => b.numero - a.numero);
  const [numero, setNumero] = useState(ordenadas[0]?.numero);
  const atual = ordenadas.find((a) => a.numero === numero) ?? ordenadas[0];

  if (!atual) {
    return <p className="text-texto-2">Nenhuma ata no banco ainda.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div role="tablist" aria-label="Atas" className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:max-h-[640px] pb-1 md:pr-1">
        {ordenadas.map((a) => {
          const ativa = a.numero === atual.numero;
          return (
            <button
              key={a.numero}
              role="tab"
              aria-selected={ativa}
              aria-controls="painel-ata"
              onClick={() => setNumero(a.numero)}
              className="botao shrink-0 justify-between md:w-full text-left rounded-xl"
              aria-pressed={ativa}
            >
              <span>
                <span className="font-semibold">{a.numero}ª</span>
                <span className="text-xs block opacity-80">{data(a.data_reuniao)}</span>
              </span>
              <span className="num font-semibold">{fmtIndice(a.indice)}</span>
            </button>
          );
        })}
      </div>

      <div id="painel-ata" role="tabpanel" className="cartao p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold">
            {atual.numero}ª reunião · {data(atual.data_reuniao)}
          </h3>
          <a
            href={atual.url_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-acento underline underline-offset-4"
          >
            abrir a ata no site do BC
          </a>
        </div>
        <p className="text-sm text-texto-2 mb-4 num">
          Índice <span className="text-texto font-semibold">{fmtIndice(atual.indice)}</span> ({tomRotulo(atual.indice)}) ·{" "}
          {atual.n_nao_zero} de {atual.n_paragrafos} parágrafos com sinal de tom. Abaixo, os parágrafos com nota diferente de zero.
        </p>
        {atual.paragrafos.length === 0 ? (
          <p className="text-texto-2">Nenhum parágrafo com nota diferente de zero nesta ata.</p>
        ) : (
          <ol className="divide-y divide-borda">
            {atual.paragrafos.map((p) => (
              <li key={p.paragrafo} className="py-3 grid grid-cols-[3.2rem_2.5rem_1fr] gap-3 items-start">
                <span className="text-xs text-texto-2 pt-1 num">§ {p.paragrafo}</span>
                <span className={`num font-bold ${corNota(p.nota)}`} aria-label={`nota ${fmtNota(p.nota)}`}>
                  {fmtNota(p.nota)}
                </span>
                <span className="trecho text-sm break-words min-w-0">
                  “{p.trecho}”
                  {revisadas.includes(`${atual.numero}.${p.paragrafo}`) && (
                    <span className="not-italic ml-2 text-xs text-brando">revisado pelo time</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
