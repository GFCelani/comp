"use client";

import { Fragment, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { dataCurta } from "@/lib/formato";

/** Formato de cada item devolvido por GET /api/busca (lib/busca.ts). */
type Resultado = {
  ata: number;
  data_reuniao: string;
  paragrafo: number;
  texto: string;
  url_pdf: string;
  score: number;
};

const SUGESTOES = ["inflação de serviços", "mercado de trabalho", "expectativas desancoradas", "câmbio"];

// Mesmas palavras que a busca ignora no servidor (lib/busca.ts), para não destacar o que não contou.
const IGNORADAS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre
   e ou mas que se nao ao aos e esta estao este estes estas isso isto aquele aquela aquilo ele ela eles elas eu tu nos vos
   seu sua seus suas meu minha dele dela deles delas lhe lhes me te
   como quando onde qual quais quem quanto quanta porque pois
   ja ainda tambem muito muita muitos muitas mais menos tao bem mal
   ha tem tinha ter sido sendo foram eram sera seriam
   disse diz dizem falou fala falam acerca respeito
   copom comite ata atas exemplo`
    .split(/\s+/)
    .filter(Boolean),
);

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function termosDa(pergunta: string): Set<string> {
  return new Set(
    normalizar(pergunta)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !IGNORADAS.has(t)),
  );
}

/** Destaca as palavras do trecho que batem exatamente com um termo da pergunta (como a busca faz). */
function destacar(texto: string, termos: Set<string>): ReactNode[] {
  if (termos.size === 0) return [texto];
  return texto.split(/([\p{L}\p{N}]+)/u).map((pedaco, i) =>
    i % 2 === 1 && termos.has(normalizar(pedaco)) ? (
      <mark key={i} className="rounded-[3px] bg-acento-suave px-[0.1em] text-tinta">
        {pedaco}
      </mark>
    ) : (
      <Fragment key={i}>{pedaco}</Fragment>
    ),
  );
}

type Estado =
  | { tipo: "inicio" }
  | { tipo: "carregando"; q: string }
  | { tipo: "erro" }
  | { tipo: "pronto"; q: string; resultados: Resultado[] };

export function PergunteAsAtas({
  atas,
  sugestoes = SUGESTOES,
}: {
  atas: { numero: number; data_reuniao: string }[];
  /** Buscas prontas mostradas abaixo do campo. */
  sugestoes?: string[];
}) {
  const base = useId();
  const campoId = `${base}-pergunta`;
  const ataId = `${base}-ata`;
  const [pergunta, setPergunta] = useState("");
  const [ata, setAta] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicio" });
  const [aviso, setAviso] = useState<string | null>(null);
  const pedido = useRef(0);
  const campo = useRef<HTMLInputElement>(null);

  async function buscar(q: string, a: string) {
    const termo = q.trim();
    if (!termo) {
      setAviso("Escreva uma pergunta antes de buscar.");
      campo.current?.focus();
      return;
    }
    setAviso(null);
    const meu = ++pedido.current;
    setEstado({ tipo: "carregando", q: termo });
    try {
      const params = new URLSearchParams({ q: termo });
      if (a) params.set("ata", a);
      const r = await fetch(`/api/busca?${params.toString()}`);
      if (!r.ok) throw new Error(String(r.status));
      const json = (await r.json()) as { resultados?: Resultado[] };
      if (meu !== pedido.current) return;
      setEstado({ tipo: "pronto", q: termo, resultados: json.resultados ?? [] });
    } catch {
      if (meu !== pedido.current) return;
      setEstado({ tipo: "erro" });
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void buscar(pergunta, ata);
  }

  const carregando = estado.tipo === "carregando";
  const termos = estado.tipo === "pronto" ? termosDa(estado.q) : new Set<string>();

  return (
    <div>
      <form onSubmit={enviar} role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor={campoId} className="rotulo mb-1.5 block">
            Sua pergunta
          </label>
          <input
            ref={campo}
            id={campoId}
            name="q"
            type="search"
            className="campo min-h-12 text-[1.0625rem]"
            placeholder="ex.: inflação de serviços"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            aria-describedby={aviso ? `${base}-aviso` : undefined}
          />
        </div>
        <div>
          <label htmlFor={ataId} className="rotulo mb-1.5 block">
            Onde buscar
          </label>
          <select id={ataId} name="ata" className="campo num min-h-12" value={ata} onChange={(e) => setAta(e.target.value)}>
            <option value="">todas as atas</option>
            {[...atas]
              .sort((a, b) => b.numero - a.numero)
              .map((a) => (
                <option key={a.numero} value={a.numero}>
                  ata {a.numero} · {dataCurta(a.data_reuniao)}
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className="botao botao-principal min-h-12 px-6 text-[0.9375rem]" disabled={carregando}>
          {carregando ? "buscando…" : "perguntar"}
        </button>
      </form>

      {aviso && (
        <p id={`${base}-aviso`} className="rotulo mt-2 text-tinta-2">
          {aviso}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rotulo mr-1">Experimente:</span>
        {sugestoes.map((s) => (
          <button
            key={s}
            type="button"
            className="botao min-h-8 px-3 py-1 text-[0.8125rem]"
            onClick={() => {
              setPergunta(s);
              void buscar(s, ata);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="rotulo mt-3">A resposta é sempre um trecho da ata, não uma interpretação.</p>

      <div aria-live="polite" aria-busy={carregando} className="mt-6">
        {estado.tipo === "carregando" && <p className="aguardando">buscando nas atas…</p>}

        {estado.tipo === "erro" && <p className="text-[0.9375rem] text-erro">A busca não respondeu. Tente de novo em instantes.</p>}

        {estado.tipo === "pronto" && estado.resultados.length === 0 && (
          <p className="texto-2">Nenhum trecho encontrado. Tente outras palavras ou todas as atas.</p>
        )}

        {estado.tipo === "pronto" && estado.resultados.length > 0 && (
          <>
            <p className="rotulo num border-b border-tinta pb-2">
              {estado.resultados.length} {estado.resultados.length === 1 ? "trecho" : "trechos"} para “{estado.q}”, do mais
              ao menos relevante
            </p>
            <ol className="divide-y divide-linha">
              {estado.resultados.map((r) => (
                <li key={`${r.ata}-${r.paragrafo}`} className="py-4">
                  <p className="rotulo num">
                    Ata {r.ata} · §{r.paragrafo} · {dataCurta(r.data_reuniao)}
                  </p>
                  <p className="mt-1.5 font-serif text-[1.0625rem] leading-[1.6] break-words text-tinta">
                    “{destacar(r.texto, termos)}”
                  </p>
                  <a href={r.url_pdf} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block text-sm">
                    abrir a ata em PDF
                  </a>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
