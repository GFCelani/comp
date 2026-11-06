"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type Mudanca = { paragrafo: number; trecho: string; explicacao: string; efeito: string };
type Paragrafo = { paragrafo: number; nota: number; trecho: string };
type Pedido = { campo: string; indice?: number; ata?: number; paragrafo?: number; valor: string; motivo?: string };
type Retorno = { ok?: string; erro?: string; enviando?: boolean };

export type RelatorioLeitura = {
  origem?: string | null;
  secoes: { id: string; titulo: string; paragrafos: { texto: string; citacoes: { id: string; ata: number; paragrafo: number }[] }[] }[];
} | null;

export type MancheteLeitura = { texto: string; linha_fina?: string | null; origem?: string | null } | null;

const fmtNota = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

function useSalvar(aoSalvar: () => void) {
  const [estado, setEstado] = useState<Record<string, Retorno>>({});
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

function Aviso({ e }: { e?: Retorno }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-[13px] ${e?.erro ? "text-erro" : "text-ok"}`}>
      {e?.erro ?? e?.ok ?? ""}
    </p>
  );
}

function Bloco({ titulo, descricao, acao, children }: { titulo: string; descricao?: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cartao min-w-0 p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{titulo}</h3>
          {descricao && <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-tinta-3">{descricao}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

/** Campo de texto com motivo e botão de salvar; sem banco, vira texto somente leitura. */
function CampoTexto({
  id,
  rotulo,
  valor,
  setValor,
  motivo,
  setMotivo,
  editavel,
  retorno,
  aoSalvar,
  textoBotao,
  alto,
  serifa,
}: {
  id: string;
  rotulo: string;
  valor: string;
  setValor: (v: string) => void;
  motivo: string;
  setMotivo: (v: string) => void;
  editavel: boolean;
  retorno?: Retorno;
  aoSalvar: () => void;
  textoBotao: string;
  alto?: boolean;
  serifa?: boolean;
}) {
  if (!editavel) {
    return (
      <div className="grid gap-1.5">
        <p className="rotulo">{rotulo}</p>
        <p className={`text-[15px] leading-relaxed ${serifa ? "trecho" : "text-tinta"}`}>{valor}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <textarea
        id={id}
        className={`campo text-[15px] leading-relaxed ${alto ? "min-h-[150px]" : "min-h-[96px]"}`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="campo sm:flex-1"
          aria-label={`motivo: ${rotulo}`}
          placeholder="motivo (opcional)…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <button type="button" className="botao botao-principal" disabled={retorno?.enviando} onClick={aoSalvar}>
          {retorno?.enviando ? "salvando…" : textoBotao}
        </button>
      </div>
      <Aviso e={retorno} />
    </div>
  );
}

function TextoComCitacoes({ texto, citacoes }: { texto: string; citacoes: { id: string; paragrafo: number; ata: number }[] }) {
  const partes = texto.split(/\[\[([^\]]+)\]\]/g);
  return (
    <>
      {partes.map((p, i) => {
        if (i % 2 === 0) return <span key={i}>{p}</span>;
        const c = citacoes.find((x) => x.id === p);
        return (
          <span key={i} className="num mx-0.5 rounded bg-acento-suave px-1 font-sans text-xs text-acento">
            {c ? `§${c.paragrafo} · ${c.ata}ª` : p}
          </span>
        );
      })}
    </>
  );
}

export function SecaoTextos({
  bancoOk,
  ata,
  mudancas,
  impacto,
  paragrafos,
  fonteIndice,
  manchete,
  relatorio,
}: {
  bancoOk: boolean;
  ata: number;
  mudancas: Mudanca[];
  impacto: string;
  paragrafos: Paragrafo[];
  fonteIndice: string;
  manchete: MancheteLeitura;
  relatorio: RelatorioLeitura;
}) {
  const router = useRouter();
  const aoSalvar = useCallback(() => router.refresh(), [router]);
  const { estado, salvar } = useSalvar(aoSalvar);

  const [trechos, setTrechos] = useState(() => mudancas.map((m) => m.trecho));
  const [explicacoes, setExplicacoes] = useState(() => mudancas.map((m) => m.explicacao));
  const [textoImpacto, setTextoImpacto] = useState(impacto);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<number, string>>(() =>
    Object.fromEntries(paragrafos.map((p) => [p.paragrafo, String(p.nota)])),
  );
  const [fonte, setFonte] = useState(fonteIndice);

  const motivo = (id: string) => motivos[id] ?? "";
  const setMotivo = (id: string) => (v: string) => setMotivos((m) => ({ ...m, [id]: v }));
  const trocar = (lista: string[], i: number, v: string) => lista.map((x, j) => (j === i ? v : x));

  return (
    <div className="grid gap-6">
      {bancoOk ? (
        <p className="text-sm text-tinta-2">
          Editando a <span className="num font-medium text-tinta">{ata}ª ata</span>. Trechos precisam ser cópia exata do
          parágrafo da ata: o servidor confere antes de salvar.
        </p>
      ) : (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border border-linha bg-alerta-suave px-5 py-4">
          <p className="text-sm font-semibold text-alerta">banco não configurado</p>
          <p className="text-sm text-tinta">
            As edições precisam de DATABASE_URL. Os textos abaixo ficam somente leitura.
          </p>
        </div>
      )}

      <Bloco
        titulo="Manchete e relatório"
        descricao="O que a página pública mostra agora, gerado pelo pipeline."
        acao={<span className="aguardando">edição da manchete e do relatório: aguardando rota na API</span>}
      >
        {manchete ? (
          <div>
            <p className="rotulo">manchete</p>
            <p className="mt-1.5 font-serif text-[22px] font-medium leading-snug">{manchete.texto}</p>
            {manchete.linha_fina && <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{manchete.linha_fina}</p>}
            {manchete.origem && <p className="mt-3"><span className="selo">origem: {manchete.origem}</span></p>}
          </div>
        ) : (
          <p className="rotulo">
            manchete: <span className="aguardando">aguardando</span>
          </p>
        )}
        <div className="mt-5 border-t border-linha pt-4">
          {relatorio && relatorio.secoes.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                <span>
                  relatório: {relatorio.secoes.length} seções,{" "}
                  {relatorio.secoes.reduce((s, x) => s + x.paragrafos.length, 0)} parágrafos
                  {relatorio.origem ? ` · origem ${relatorio.origem}` : ""}
                </span>
                <span className="text-[13px] font-normal text-acento group-open:hidden">mostrar</span>
                <span className="hidden text-[13px] font-normal text-acento group-open:inline">esconder</span>
              </summary>
              <div className="mt-4 grid max-w-[72ch] gap-5">
                {relatorio.secoes.map((s) => (
                  <div key={s.id}>
                    <p className="text-sm font-semibold">{s.titulo}</p>
                    {s.paragrafos.map((p, i) => (
                      <p key={i} className="mt-2 font-serif text-[16px] leading-relaxed text-tinta">
                        <TextoComCitacoes texto={p.texto} citacoes={p.citacoes} />
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <p className="rotulo">
              relatório: <span className="aguardando">aguardando</span>
            </p>
          )}
        </div>
      </Bloco>

      <Bloco titulo="O que mudou" descricao={`As mudanças da ${ata}ª ata em relação à anterior: trecho exato e explicação.`}>
        <div className="grid gap-4 xl:grid-cols-2">
          {mudancas.map((m, i) => (
            <div key={i} className="grid min-w-0 content-start gap-4 rounded-[12px] border border-linha p-4 sm:p-5">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">mudança {i + 1}</span>
                <span className="num text-tinta-3">§ {m.paragrafo}</span>
                <span className="selo">{m.efeito}</span>
              </p>
              <CampoTexto
                id={`trecho-${i}`}
                rotulo={`trecho exato do § ${m.paragrafo}`}
                valor={trechos[i]}
                setValor={(v) => setTrechos((t) => trocar(t, i, v))}
                motivo={motivo(`t${i}`)}
                setMotivo={setMotivo(`t${i}`)}
                editavel={bancoOk}
                retorno={estado[`t${i}`]}
                aoSalvar={() => salvar(`t${i}`, { campo: "mudanca.trecho", indice: i, valor: trechos[i], motivo: motivo(`t${i}`) })}
                textoBotao="salvar trecho"
                serifa
              />
              <CampoTexto
                id={`explicacao-${i}`}
                rotulo="explicação"
                valor={explicacoes[i]}
                setValor={(v) => setExplicacoes((t) => trocar(t, i, v))}
                motivo={motivo(`e${i}`)}
                setMotivo={setMotivo(`e${i}`)}
                editavel={bancoOk}
                retorno={estado[`e${i}`]}
                aoSalvar={() =>
                  salvar(`e${i}`, { campo: "mudanca.explicacao", indice: i, valor: explicacoes[i], motivo: motivo(`e${i}`) })
                }
                textoBotao="salvar explicação"
              />
            </div>
          ))}
          {mudancas.length === 0 && <span className="aguardando">nenhuma mudança gerada para esta ata</span>}
        </div>
      </Bloco>

      <Bloco titulo="Principal impacto" descricao="Linguagem condicional; números só dos dados.">
        <CampoTexto
          id="impacto"
          rotulo="texto do impacto"
          valor={textoImpacto}
          setValor={setTextoImpacto}
          motivo={motivo("imp")}
          setMotivo={setMotivo("imp")}
          editavel={bancoOk}
          retorno={estado.imp}
          aoSalvar={() => salvar("imp", { campo: "impacto.texto", valor: textoImpacto, motivo: motivo("imp") })}
          textoBotao="salvar impacto"
          alto
        />
      </Bloco>

      <Bloco
        titulo={`Notas dos parágrafos da ${ata}ª ata`}
        descricao="Só os parágrafos com nota diferente de zero. Mudar uma nota exige motivo; o índice da ata vem do pipeline e não é recalculado aqui."
      >
        <ul className="divide-y divide-linha">
          {paragrafos.map((p) => {
            const id = `n${p.paragrafo}`;
            return (
              <li key={p.paragrafo} className={`grid gap-3 py-4 first:pt-0 last:pb-0 lg:items-start ${bancoOk ? "lg:grid-cols-[3.5rem_1fr_minmax(0,22rem)]" : "grid-cols-[3rem_1fr_auto] lg:grid-cols-[3.5rem_1fr_6rem]"}`}>
                <span className="num text-[13px] text-tinta-3">§ {p.paragrafo}</span>
                <p className="trecho min-w-0 break-words text-[15px] leading-relaxed">“{p.trecho}”</p>
                {bancoOk ? (
                  <div className="grid gap-2">
                    <div className="flex gap-2">
                      <select
                        className="campo w-[5.5rem] flex-none"
                        aria-label={`nota do parágrafo ${p.paragrafo}`}
                        value={notas[p.paragrafo]}
                        onChange={(e) => setNotas((n) => ({ ...n, [p.paragrafo]: e.target.value }))}
                      >
                        {[2, 1, 0, -1, -2].map((v) => (
                          <option key={v} value={String(v)}>
                            {fmtNota(v)}
                          </option>
                        ))}
                      </select>
                      <input
                        className="campo min-w-0"
                        aria-label={`motivo da nota do parágrafo ${p.paragrafo}`}
                        placeholder="motivo (obrigatório)…"
                        value={motivo(id)}
                        onChange={(e) => setMotivo(id)(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="botao justify-self-start"
                      disabled={estado[id]?.enviando}
                      onClick={() =>
                        salvar(id, { campo: "nota", ata, paragrafo: p.paragrafo, valor: notas[p.paragrafo], motivo: motivo(id) })
                      }
                    >
                      {estado[id]?.enviando ? "salvando…" : "salvar nota"}
                    </button>
                    <Aviso e={estado[id]} />
                  </div>
                ) : (
                  <p className="num text-sm lg:text-right">
                    <span className="text-tinta-3">nota </span>
                    <span className="font-semibold">{fmtNota(p.nota)}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Bloco>

      <Bloco titulo="Fonte do índice" descricao="Qual índice o site usa para a previsão.">
        {bancoOk ? (
          <div className="grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="fonte" className="rotulo sm:mr-2">
                usar o índice
              </label>
              <select id="fonte" className="campo sm:max-w-[260px]" value={fonte} onChange={(e) => setFonte(e.target.value)}>
                <option value="simples">simples (média sem zeros)</option>
                <option value="modelo">modelo de notas</option>
              </select>
              <button
                type="button"
                className="botao botao-principal"
                disabled={estado.fonte?.enviando}
                onClick={() => salvar("fonte", { campo: "config.fonte_indice", valor: fonte })}
              >
                {estado.fonte?.enviando ? "salvando…" : "salvar escolha"}
              </button>
            </div>
            <Aviso e={estado.fonte} />
          </div>
        ) : (
          <p className="text-sm">
            <span className="text-tinta-3">em uso: </span>
            {fonteIndice === "modelo" ? "modelo de notas" : "simples (média sem zeros)"}
          </p>
        )}
      </Bloco>
    </div>
  );
}
