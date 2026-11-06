"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mudanca = { paragrafo: number; trecho: string; explicacao: string; efeito: string };
type Paragrafo = { paragrafo: number; nota: number; trecho: string };
type Edicao = {
  id: number;
  criado_em: string;
  campo: string;
  chave: string;
  valor_antigo: string | null;
  valor_novo: string;
  motivo: string | null;
};

type Pedido = { campo: string; indice?: number; ata?: number; paragrafo?: number; valor: string; motivo?: string };

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const nomeCampo: Record<string, string> = {
  "mudanca.trecho": "trecho da mudança",
  "mudanca.explicacao": "explicação da mudança",
  "impacto.texto": "texto do impacto",
  nota: "nota do parágrafo",
  "config.fonte_indice": "fonte do índice",
};

function curto(s: string | null, n = 90) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function useSalvar(aoSalvar: () => void) {
  const [estado, setEstado] = useState<Record<string, { ok?: string; erro?: string; enviando?: boolean }>>({});
  const salvar = useCallback(
    async (id: string, pedido: Pedido) => {
      setEstado((s) => ({ ...s, [id]: { enviando: true } }));
      try {
        const r = await fetch("/api/painel/edicoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pedido),
        });
        const j = (await r.json().catch(() => ({}))) as { erro?: string };
        if (!r.ok) {
          setEstado((s) => ({ ...s, [id]: { erro: j.erro ?? `Não foi salvo (${r.status}).` } }));
          return;
        }
        setEstado((s) => ({ ...s, [id]: { ok: "salvo; o site público já mostra a edição" } }));
        aoSalvar();
      } catch {
        setEstado((s) => ({ ...s, [id]: { erro: "Sem conexão com o servidor. Não foi salvo." } }));
      }
    },
    [aoSalvar],
  );
  return { estado, salvar };
}

function Retorno({ e }: { e?: { ok?: string; erro?: string } }) {
  return (
    <p aria-live="polite" className={`text-sm min-h-[1.25rem] ${e?.erro ? "text-erro" : "text-brando"}`}>
      {e?.erro ?? e?.ok ?? ""}
    </p>
  );
}

export function Editor({
  ata,
  mudancas,
  impacto,
  paragrafos,
  fonteIndice,
}: {
  ata: number;
  mudancas: Mudanca[];
  impacto: string;
  paragrafos: Paragrafo[];
  fonteIndice: string;
}) {
  const router = useRouter();
  const [historico, setHistorico] = useState<Edicao[] | null>(null);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/edicoes", { cache: "no-store" });
      const j = (await r.json()) as { edicoes?: Edicao[]; erro?: string };
      if (!r.ok) throw new Error(j.erro ?? String(r.status));
      setHistorico(j.edicoes ?? []);
      setErroHistorico(null);
    } catch (e) {
      setErroHistorico(`Não foi possível carregar o histórico (${e instanceof Error ? e.message : "erro"}).`);
    }
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const aoSalvar = useCallback(() => {
    void carregarHistorico();
    router.refresh();
  }, [carregarHistorico, router]);

  const { estado, salvar } = useSalvar(aoSalvar);
  const [textos, setTextos] = useState(() => ({
    trechos: mudancas.map((m) => m.trecho),
    explicacoes: mudancas.map((m) => m.explicacao),
    impacto,
    motivos: {} as Record<string, string>,
  }));
  const [notas, setNotas] = useState<Record<number, string>>(() =>
    Object.fromEntries(paragrafos.map((p) => [p.paragrafo, String(p.nota)])),
  );
  const [fonte, setFonte] = useState(fonteIndice);

  const motivo = (id: string) => textos.motivos[id] ?? "";
  const setMotivo = (id: string, v: string) => setTextos((t) => ({ ...t, motivos: { ...t.motivos, [id]: v } }));

  async function sair() {
    await fetch("/api/painel/sair", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="grid gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-texto-2 text-sm">
          Editando a {ata}ª ata. Trechos precisam ser cópia exata do parágrafo da ata; o servidor confere.
        </p>
        <button type="button" className="botao" onClick={sair}>
          sair
        </button>
      </div>

      <section aria-labelledby="ed-mudancas">
        <p className="etiqueta">o que mudou</p>
        <h2 id="ed-mudancas" className="mt-2 text-2xl font-semibold">
          As três mudanças
        </h2>
        <div className="mt-5 grid gap-6">
          {mudancas.map((m, i) => {
            const idT = `t${i}`;
            const idE = `e${i}`;
            return (
              <div key={i} className="cartao p-5 grid gap-3">
                <p className="etiqueta etiqueta-sem-ponto">
                  mudança {i + 1} · § {m.paragrafo} · {m.efeito}
                </p>
                <label className="rotulo" htmlFor={`trecho-${i}`}>
                  trecho exato (do § {m.paragrafo})
                </label>
                <textarea
                  id={`trecho-${i}`}
                  className="campo min-h-[80px]"
                  value={textos.trechos[i]}
                  onChange={(e) =>
                    setTextos((t) => ({ ...t, trechos: t.trechos.map((x, j) => (j === i ? e.target.value : x)) }))
                  }
                />
                <input
                  className="campo"
                  aria-label={`motivo da edição do trecho ${i + 1}`}
                  placeholder="motivo (opcional)…"
                  value={motivo(idT)}
                  onChange={(e) => setMotivo(idT, e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="botao botao-principal"
                    disabled={estado[idT]?.enviando}
                    onClick={() =>
                      salvar(idT, { campo: "mudanca.trecho", indice: i, valor: textos.trechos[i], motivo: motivo(idT) })
                    }
                  >
                    {estado[idT]?.enviando ? "salvando…" : "salvar trecho"}
                  </button>
                </div>
                <Retorno e={estado[idT]} />

                <label className="rotulo" htmlFor={`explicacao-${i}`}>
                  explicação
                </label>
                <textarea
                  id={`explicacao-${i}`}
                  className="campo min-h-[80px]"
                  value={textos.explicacoes[i]}
                  onChange={(e) =>
                    setTextos((t) => ({
                      ...t,
                      explicacoes: t.explicacoes.map((x, j) => (j === i ? e.target.value : x)),
                    }))
                  }
                />
                <input
                  className="campo"
                  aria-label={`motivo da edição da explicação ${i + 1}`}
                  placeholder="motivo (opcional)…"
                  value={motivo(idE)}
                  onChange={(e) => setMotivo(idE, e.target.value)}
                />
                <div>
                  <button
                    type="button"
                    className="botao botao-principal"
                    disabled={estado[idE]?.enviando}
                    onClick={() =>
                      salvar(idE, {
                        campo: "mudanca.explicacao",
                        indice: i,
                        valor: textos.explicacoes[i],
                        motivo: motivo(idE),
                      })
                    }
                  >
                    {estado[idE]?.enviando ? "salvando…" : "salvar explicação"}
                  </button>
                </div>
                <Retorno e={estado[idE]} />
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ed-impacto">
        <p className="etiqueta">impacto</p>
        <h2 id="ed-impacto" className="mt-2 text-2xl font-semibold">
          Principal impacto
        </h2>
        <div className="cartao p-5 mt-5 grid gap-3">
          <label className="rotulo" htmlFor="impacto">
            texto (linguagem condicional; números só dos dados)
          </label>
          <textarea
            id="impacto"
            className="campo min-h-[140px]"
            value={textos.impacto}
            onChange={(e) => setTextos((t) => ({ ...t, impacto: e.target.value }))}
          />
          <input
            className="campo"
            aria-label="motivo da edição do impacto"
            placeholder="motivo (opcional)…"
            value={motivo("imp")}
            onChange={(e) => setMotivo("imp", e.target.value)}
          />
          <div>
            <button
              type="button"
              className="botao botao-principal"
              disabled={estado.imp?.enviando}
              onClick={() => salvar("imp", { campo: "impacto.texto", valor: textos.impacto, motivo: motivo("imp") })}
            >
              {estado.imp?.enviando ? "salvando…" : "salvar impacto"}
            </button>
          </div>
          <Retorno e={estado.imp} />
        </div>
      </section>

      <section aria-labelledby="ed-notas">
        <p className="etiqueta">notas</p>
        <h2 id="ed-notas" className="mt-2 text-2xl font-semibold">
          Notas dos parágrafos da {ata}ª ata
        </h2>
        <p className="text-sm text-texto-2 mt-2">
          Mudar uma nota exige motivo. O índice da ata não é recalculado aqui: ele vem do pipeline.
        </p>
        <ul className="mt-5 grid gap-3">
          {paragrafos.map((p) => {
            const id = `n${p.paragrafo}`;
            return (
              <li key={p.paragrafo} className="cartao p-4 grid gap-2 sm:grid-cols-[4rem_1fr_7rem_1fr_auto] sm:items-center">
                <span className="text-xs text-texto-2 num">§ {p.paragrafo}</span>
                <span className="trecho text-sm break-words">“{p.trecho}”</span>
                <select
                  className="campo"
                  aria-label={`nota do parágrafo ${p.paragrafo}`}
                  value={notas[p.paragrafo]}
                  onChange={(e) => setNotas((n) => ({ ...n, [p.paragrafo]: e.target.value }))}
                >
                  {[2, 1, 0, -1, -2].map((v) => (
                    <option key={v} value={String(v)}>
                      {v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0"}
                    </option>
                  ))}
                </select>
                <input
                  className="campo"
                  aria-label={`motivo da nota do parágrafo ${p.paragrafo}`}
                  placeholder="motivo (obrigatório)…"
                  value={motivo(id)}
                  onChange={(e) => setMotivo(id, e.target.value)}
                />
                <button
                  type="button"
                  className="botao"
                  disabled={estado[id]?.enviando}
                  onClick={() =>
                    salvar(id, { campo: "nota", ata, paragrafo: p.paragrafo, valor: notas[p.paragrafo], motivo: motivo(id) })
                  }
                >
                  {estado[id]?.enviando ? "salvando…" : "salvar nota"}
                </button>
                <div className="sm:col-span-5">
                  <Retorno e={estado[id]} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="ed-fonte">
        <p className="etiqueta">configuração</p>
        <h2 id="ed-fonte" className="mt-2 text-2xl font-semibold">
          Fonte do índice
        </h2>
        <div className="cartao p-5 mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor="fonte" className="rotulo">
            usar o índice
          </label>
          <select id="fonte" className="campo max-w-[220px]" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="simples">simples (média sem zeros)</option>
            <option value="modelo">modelo do parceiro</option>
          </select>
          <button
            type="button"
            className="botao botao-principal"
            disabled={estado.fonte?.enviando}
            onClick={() => salvar("fonte", { campo: "config.fonte_indice", valor: fonte })}
          >
            salvar escolha
          </button>
          <div className="w-full">
            <Retorno e={estado.fonte} />
          </div>
        </div>
      </section>

      <section aria-labelledby="ed-historico">
        <p className="etiqueta">histórico</p>
        <h2 id="ed-historico" className="mt-2 text-2xl font-semibold">
          Todas as edições
        </h2>
        <div className="mt-5">
          {erroHistorico && <p className="text-erro text-sm">{erroHistorico}</p>}
          {!historico && !erroHistorico && <p className="text-texto-2 text-sm">carregando…</p>}
          {historico && historico.length === 0 && <p className="text-texto-2 text-sm">Nenhuma edição ainda.</p>}
          {historico && historico.length > 0 && (
            <ol className="divide-y divide-borda" aria-label="Histórico de edições">
              {historico.map((h) => (
                <li key={h.id} className="py-3 text-sm grid gap-1">
                  <span className="text-xs text-texto-2 num">
                    {fmtHora.format(new Date(h.criado_em))} · {nomeCampo[h.campo] ?? h.campo} · {h.chave}
                  </span>
                  <span className="break-words">
                    <span className="text-texto-2 line-through">{curto(h.valor_antigo)}</span> →{" "}
                    <span>{curto(h.valor_novo)}</span>
                  </span>
                  {h.motivo && <span className="text-texto-2">motivo: {h.motivo}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
