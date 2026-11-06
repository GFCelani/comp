import Link from "next/link";
import { obterDados } from "@/lib/edicoes";
import type { Previsao } from "@/lib/dados";
import {
  data,
  dataCurta,
  indice as fmtIndice,
  selic as fmtSelic,
  decisao as fmtDecisao,
  pct,
  tomRotulo,
} from "@/lib/formato";
import { camposNovos, relatorioDeReserva } from "@/lib/previsao";
import { Termometro } from "@/components/Termometro";
import { GraficoIndice } from "@/components/GraficoIndice";
import { ExplorarAtas } from "@/components/ExplorarAtas";
import { PergunteAsAtas } from "@/components/PergunteAsAtas";
import { Rodape } from "@/components/Rodape";
import { Cabecalho } from "@/components/Cabecalho";
import { ParagrafoCitado } from "@/components/ParagrafoCitado";

export const revalidate = 60;

const verboPrevisto: Record<Previsao, string> = {
  aperto: "subir",
  manutencao: "manter",
  afrouxamento: "cortar",
};
const nomePrevisto: Record<Previsao, string> = {
  aperto: "alta",
  manutencao: "manutenção",
  afrouxamento: "corte",
};

function Revisado() {
  return <span className="etiqueta etiqueta-sem-ponto text-brando">revisado pelo time</span>;
}

function OrigemTexto({ origem }: { origem?: string | null }) {
  if (origem === "automatico") return <span className="etiqueta etiqueta-sem-ponto">texto automático (sem IA)</span>;
  if (origem === "claude") return <span className="etiqueta etiqueta-sem-ponto">gerado pelo Claude e verificado por código</span>;
  return null;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-borda pt-4">
      <p className="etiqueta etiqueta-sem-ponto">{titulo}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Ferramenta({ id, kicker, titulo, linhaFina, children }: { id: string; kicker: string; titulo: string; linhaFina: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-16" aria-labelledby={`${id}-titulo`}>
      <p className="etiqueta">{kicker}</p>
      <h2 id={`${id}-titulo`} className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">
        {titulo}
      </h2>
      <p className="mt-2 text-texto-2 max-w-[64ch]">{linhaFina}</p>
      <hr className="regua mt-5" />
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function Pagina() {
  const { dados, revisados } = await obterDados();
  const { campos, exemplo } = camposNovos(dados);
  const { resumo, serie, mudancas, atas, como_medimos } = dados;
  const u = resumo.ultima_ata;
  const pv = campos.previsao;
  const mp = dados.metricas_previsao;
  const relatorio = campos.relatorio ?? relatorioDeReserva(dados);
  const usandoReserva = !campos.relatorio;

  // Manchete: a previsão quando existir; senão, a leitura da última ata.
  const proxima = pv?.proxima_reuniao;
  const manchete = campos.manchete?.texto
    ? campos.manchete.texto
    : pv
      ? `Copom deve ${verboPrevisto[pv.previsto]} a Selic na próxima reunião`
      : `Copom ${u.decisao === "corte" ? "cortou" : u.decisao === "alta" ? "subiu" : "manteve"} a Selic ${u.decisao === "manutencao" ? "em" : "para"} ${fmtSelic(u.selic_apos)}; a ata veio com tom ${tomRotulo(u.indice)}`;
  const linhaFina =
    campos.manchete?.linha_fina ??
    (pv
      ? `Sinal de ${nomePrevisto[pv.previsto]} a partir da ${pv.base_ata}ª ata (índice ${fmtIndice(pv.indice)}). Abaixo, o porquê, com o trecho exato da ata em cada afirmação.`
      : `Leitura da ${u.numero}ª ata, de ${data(u.data_reuniao)}. A previsão para a próxima reunião ainda está sendo gerada pelo pipeline.`);

  const acertoIndice = pv?.acerto?.indice ?? (mp ? { acuracia: mp.indice.acuracia, acerto_sinal: mp.indice.acerto_sinal, n: mp.n_atas } : null);
  const acertoIngenua = pv?.acerto?.ingenua ?? (mp ? { acuracia: mp.ingenua.acuracia, acerto_sinal: mp.ingenua.acerto_sinal, n: mp.n_atas } : null);
  const ud = pv?.ultima_decisao_conhecida;

  return (
    <>
      {exemplo && (
        <div role="status" className="bg-acento text-[#1a1000] text-center text-sm font-semibold px-4 py-2">
          EXEMPLO — manchete, previsão e relatório ilustrativos (teste local).
        </div>
      )}
      <Cabecalho atual="site" />
      <main id="conteudo" className="mx-auto w-full max-w-[1180px] px-4 pb-8">
        {/* 1. Manchete: a previsão */}
        <header className="pt-10 sm:pt-14 grid gap-10 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <span className="pilula">
              {pv
                ? `${proxima?.numero ? `próxima reunião: ${proxima.numero}ª` : "próxima reunião"} · ${
                    proxima?.data ? data(proxima.data) : "data da próxima reunião indisponível"
                  }`
                : `edição da ${u.numero}ª ata · ${data(u.data_reuniao)}`}
            </span>
            <h1 className="mt-5 text-[2.3rem] leading-[1.03] sm:text-6xl font-semibold max-w-[18ch]">{manchete}</h1>
            <p className="mt-5 text-lg sm:text-xl text-texto-2 max-w-[58ch] leading-relaxed">{linhaFina}</p>
            {ud && !ud.ata_publicada && (
              <p className="mt-4 text-sm text-texto num">
                Na reunião de {dataCurta(ud.data).slice(0, 5)} o Copom{" "}
                {ud.decisao === "manutencao"
                  ? `manteve a Selic em ${fmtSelic(ud.selic)}`
                  : `${fmtDecisao(ud.decisao, ud.decisao_pp)}, para ${fmtSelic(ud.selic)}`}
                ; a ata ainda não foi publicada.
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-texto-2 num">
              <span>
                última ata: {u.numero}ª, reunião de {data(u.data_reuniao)}
              </span>
              <span aria-hidden="true" className="text-texto-3">|</span>
              <span>Selic {fmtSelic(u.selic_apos)} ({fmtDecisao(u.decisao, u.decisao_pp)})</span>
              <span aria-hidden="true" className="text-texto-3">|</span>
              <a href={u.url_pdf} target="_blank" rel="noopener noreferrer" className="link">
                ata original
              </a>
            </div>
          </div>

          <aside className="grid gap-6 content-start" aria-label="Contexto da previsão">
            <Bloco titulo="quanto o sinal acertou">
              {acertoIndice && acertoIngenua ? (
                <>
                  <dl className="grid grid-cols-2 gap-4 num">
                    <div>
                      <dt className="text-xs text-texto-2">nosso índice</dt>
                      <dd className="text-3xl font-semibold tracking-tight text-acento">{pct(acertoIndice.acuracia)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-2">repetir a última decisão</dt>
                      <dd className="text-3xl font-semibold tracking-tight">{pct(acertoIngenua.acuracia)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-texto-2 num">
                    Acertos da direção da Selic na reunião seguinte, em {acertoIndice.n} atas.{" "}
                    {acertoIndice.acuracia < acertoIngenua.acuracia
                      ? "Até aqui, repetir a última decisão acertou mais."
                      : acertoIndice.acuracia > acertoIngenua.acuracia
                        ? "Até aqui, o índice acertou mais."
                        : "Até aqui, empatados."}{" "}
                    <Link href="/painel" className="link">
                      detalhes
                    </Link>
                  </p>
                </>
              ) : (
                <p className="text-texto-2 text-sm">aguardando</p>
              )}
            </Bloco>
            <Bloco titulo="o que o Focus espera">
              {pv?.focus_selic ? (
                <>
                  <p className="text-3xl font-semibold tracking-tight num">{fmtSelic(pv.focus_selic.mediana)}</p>
                  <p className="mt-1 text-xs text-texto-2 num">
                    Mediana da Selic para o fim de {pv.focus_selic.ano_referencia}, Relatório Focus de{" "}
                    {dataCurta(pv.focus_selic.data)}.
                  </p>
                </>
              ) : (
                <p className="text-texto-2 text-sm">aguardando o dado do Focus</p>
              )}
            </Bloco>
          </aside>
        </header>
        <hr className="regua-forte mt-10" />

        {/* 2. Relatório */}
        <article id="relatorio" className="mt-12 max-w-[760px]" aria-label="Relatório">
          <div className="flex flex-wrap items-center gap-3">
            <p className="etiqueta">relatório da {pv?.base_ata ?? u.numero}ª ata</p>
            <OrigemTexto origem={relatorio?.origem} />
            {usandoReserva && (revisados.impacto || revisados.mudancas.size > 0) && <Revisado />}
          </div>
          {dados.textos_pendentes ? (
            <div className="cartao p-5 border-dashed text-texto-2 mt-6" role="status">
              <p className="font-semibold text-texto">textos da ata nova em revisão</p>
            </div>
          ) : !relatorio ? (
            <p className="mt-6 text-texto-2">O relatório desta ata ainda não foi gerado.</p>
          ) : (
            relatorio.secoes.map((s) => (
              <section key={s.id} id={`rel-${s.id}`} className="mt-10" aria-labelledby={`rel-${s.id}-t`}>
                <h2 id={`rel-${s.id}-t`} className="text-2xl sm:text-3xl font-semibold leading-tight">
                  {s.titulo}
                </h2>
                <div className="mt-4 grid gap-5">
                  {s.paragrafos.map((p, i) => (
                    <ParagrafoCitado key={i} texto={p.texto} citacoes={p.citacoes} />
                  ))}
                </div>
              </section>
            ))
          )}
          <p className="mt-8 text-xs text-texto-2">
            Interpretação, não previsão garantida. Clique nas marcas “§ · ata” para ver o trecho exato.
          </p>
        </article>

        {/* 3. Faixa do índice de tom: visível, secundária */}
        <section id="tom" className="mt-14 cartao p-5 sm:p-6 grid gap-6 lg:grid-cols-[1fr_2fr] items-center" aria-labelledby="tom-t">
          <div>
            <p className="etiqueta" id="tom-t">índice de tom da {u.numero}ª ata</p>
            <p className="mt-2 text-4xl font-semibold num tracking-tight text-acento">
              {fmtIndice(u.indice)} <span className="text-base font-normal text-texto-2">{tomRotulo(u.indice)}</span>
            </p>
            <div className="mt-3 max-w-[300px]">
              <Termometro valor={u.indice} />
            </div>
            <p className="mt-2 text-xs text-texto-2">Régua de −2 (muito brando) a +2 (muito duro), parágrafo a parágrafo.</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-texto-2">Últimas {Math.min(10, serie.length)} reuniões: índice (âmbar) e Selic meta (tracejada).</p>
            <div className="mt-2">
              <GraficoIndice serie={serie.slice(-10)} compacto />
            </div>
          </div>
        </section>

        {/* 4. Evidência detalhada, recolhida */}
        <details id="evidencia" className="mt-6 cartao group">
          <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 rounded-[0.9rem]">
            <span>
              <span className="etiqueta">evidência</span>
              <span className="block mt-2 text-lg font-semibold">Mudanças parágrafo a parágrafo e a régua</span>
            </span>
            <span className="botao text-xs shrink-0">
              <span className="group-open:hidden">mostrar</span>
              <span className="hidden group-open:inline">esconder</span>
            </span>
          </summary>
          <div className="px-5 pb-6 grid gap-10">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold">O que mudou, parágrafo a parágrafo</h3>
                <OrigemTexto origem={dados.textos_origem ?? dados.mudancas_origem} />
              </div>
              {mudancas.length === 0 ? (
                <p className="text-texto-2 text-sm mt-2">Nenhuma mudança relevante registrada.</p>
              ) : (
                <ol className="mt-3 divide-y divide-borda">
                  {mudancas.map((mu, i) => (
                    <li key={`${mu.paragrafo}-${i}`} className="py-3 grid gap-1 sm:grid-cols-[7rem_6rem_1fr] sm:gap-4">
                      <span className="text-xs text-texto-2 num">
                        § {mu.paragrafo} · {mu.tipo}
                      </span>
                      <span className={`text-xs font-semibold ${mu.efeito === "endureceu" ? "text-duro" : "text-brando"}`}>
                        {mu.efeito}
                      </span>
                      <span className="trecho text-sm break-words">
                        “{mu.trecho}”{revisados.mudancas.has(i) && <span className="not-italic ml-2 text-xs text-brando">revisado pelo time</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-semibold">A régua</h3>
                <p className="coluna-texto mt-1">{como_medimos.regua}</p>
              </div>
              <div>
                <h3 className="font-semibold">Como juntamos num número</h3>
                <p className="coluna-texto mt-1">{como_medimos.agregacao}</p>
              </div>
            </div>
          </div>
        </details>

        {/* 4. Ferramentas */}
        <Ferramenta
          id="perguntar"
          kicker="ferramenta"
          titulo="Pergunte às atas"
          linhaFina="A resposta é sempre um trecho da ata, com o número do parágrafo e o link para o PDF oficial."
        >
          <PergunteAsAtas atas={atas.map((a) => ({ numero: a.numero, data_reuniao: a.data_reuniao }))} />
        </Ferramenta>

        <Ferramenta
          id="atas"
          kicker="ferramenta"
          titulo="Explorar as atas"
          linhaFina="Escolha uma reunião para ver os parágrafos que puxaram o tom para cima ou para baixo, com a nota e o trecho."
        >
          <ExplorarAtas atas={atas} revisadas={[...revisados.notas]} />
        </Ferramenta>
      </main>
      <Rodape />
    </>
  );
}
