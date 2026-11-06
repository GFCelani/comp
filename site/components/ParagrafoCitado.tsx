"use client";

import { Fragment, useId, useState } from "react";
import type { Citacao } from "@/lib/previsao";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** Texto com marcadores [[cN]] → marcas discretas "§9 · ata 281"; clicar abre o trecho exato. */
export function ParagrafoCitado({ texto, citacoes }: { texto: string; citacoes: Citacao[] }) {
  const base = useId();
  const [aberta, setAberta] = useState<string | null>(null);
  const porId = new Map(citacoes.map((c) => [c.id, c]));
  const partes = texto.split(/(\[\[[A-Za-z0-9_-]+\]\])/g);
  const atual = aberta ? porId.get(aberta) : undefined;

  return (
    <div>
      <p className="text-lg leading-relaxed text-texto">
        {partes.map((parte, i) => {
          const m = /^\[\[([A-Za-z0-9_-]+)\]\]$/.exec(parte);
          if (!m) return <Fragment key={i}>{parte}</Fragment>;
          const c = porId.get(m[1]);
          if (!c) return null;
          const ativa = aberta === c.id;
          return (
            <button
              key={i}
              type="button"
              aria-expanded={ativa}
              aria-controls={`${base}-cit`}
              onClick={() => setAberta(ativa ? null : c.id)}
              className={`mx-0.5 align-baseline rounded-full border px-1.5 py-px text-[0.7rem] font-mono tracking-wide whitespace-nowrap transition-colors ${
                ativa ? "border-acento text-acento bg-acento/10" : "border-borda-2 text-texto-2 hover:text-texto hover:border-texto-3"
              }`}
            >
              §{c.paragrafo} · ata {c.ata}
            </button>
          );
        })}
      </p>
      <div id={`${base}-cit`} aria-live="polite">
        {atual && (
          <blockquote className="mt-3 border-l-2 border-acento bg-cartao rounded-r-lg px-4 py-3">
            <p className="trecho text-sm break-words">“{atual.trecho}”</p>
            <p className="mt-2 text-xs text-texto-2 num">
              {atual.ata}ª ata, parágrafo {atual.paragrafo}
              {atual.data_reuniao ? ` · reunião de ${fmt.format(new Date(`${atual.data_reuniao}T00:00:00Z`)).replace(/\./g, "")}` : ""}
              {" · "}
              <a href={atual.url_pdf} target="_blank" rel="noopener noreferrer" className="link">
                abrir o PDF oficial
              </a>
            </p>
          </blockquote>
        )}
      </div>
    </div>
  );
}
