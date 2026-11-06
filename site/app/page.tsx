import Link from "next/link";
import { obterDados } from "@/lib/edicoes";
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
import { GraficoTomSelic } from "@/components/GraficoTomSelic";
import { ExplorarAtas } from "@/components/ExplorarAtas";
import { PergunteAsAtas } from "@/components/PergunteAsAtas";
import { Rodape } from "@/components/Rodape";
import { Cabecalho } from "@/components/Cabecalho";
import { ParagrafoCitado } from "@/components/ParagrafoCitado";
import { ManchetePorLinha, ContaAte } from "@/components/HeroAnimacoes";
import { Medidor } from "@/components/Medidor";
import { FundoHero } from "@/components/FundoHero";

export const revalidate = 60;


function Aguardando({ texto = "aguardando" }: { texto?: string }) {
  return <span className="aguardando">{texto}</span>;
}

function OrigemTexto({ origem }: { origem?: string | null }) {
  if (origem === "automatico") return <span className="selo">texto automático, sem IA</span>;
  if (origem === "claude") return <span className="selo">escrito pelo Claude, verificado por código</span>;
  return null;
}

function corPrevisto(p: string) {
  return p === "aperto" ? "text-duro" : p === "afrouxamento" ? "text-brando" : "text-tinta";
}

function corIndice(v: number | null | undefined) {
  return v != null && v > 0 ? "text-duro" : v != null && v < 0 ? "text-brando" : "text-tinta";
}

type MetodoPrevisao = {
  nome: string;
  rotulo_pt?: string;
  acuracia_loo: number | null;
  acerto_sinal: number | null;
  n: number | null;
  previsto_proxima: string | null;
  disponivel: boolean;
  acuracia_tempo?: number | null;
  n_tempo?: number | null;
  probabilidades?: { alta: number; manutencao: number; corte: number } | null;
};


function maiuscula(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Numero({ valor, rotulo, contexto, destaque }: { valor: React.ReactNode; rotulo: string; contexto: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="py-6 sm:py-0 sm:px-8 first:sm:pl-0 border-b sm:border-b-0 sm:border-l first:sm:border-l-0 border-linha last:border-b-0">
      <p className={`num text-[2.75rem] sm:text-[3.25rem] leading-none font-medium tracking-[-0.03em] ${destaque ? "text-acento" : "text-tinta"}`}>{valor}</p>
      <p className="mt-3 text-[0.9375rem] font-medium text-tinta">{rotulo}</p>
      <p className="mt-1 text-sm text-tinta-3 leading-snug max-w-[30ch]">{contexto}</p>
    </div>
  );
}

function TituloSecao({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <header className="max-w-[760px]">
      <p className="rotulo">{rotulo}</p>
      <h2 id={id} className="titulo-serifa mt-3 text-[2.1rem] sm:text-[2.75rem] leading-[1.08]">
        {children}
      </h2>
    </header>
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
  const proxima = pv?.proxima_reuniao;
  const ud = pv?.ultima_decisao_conhecida;

  const manchete = campos.manchete?.texto ?? null;
  const linhaFina = campos.manchete?.linha_fina ?? null;

  const periodo =
    (pv?.acerto as { periodo?: { inicio: string; fim: string } } | null | undefined)?.periodo ?? mp?.periodo ?? null;

  const notas: Record<string, number> = {};
  for (const a of atas) for (const p of a.paragrafos) notas[`${a.numero}.${p.paragrafo}`] = p.nota;

  const pvx = pv as (typeof pv & { metodo_escolhido?: string; acuracia_escolhido?: number; metodos?: MetodoPrevisao[] }) | null | undefined;
  const metodos: MetodoPrevisao[] = pvx?.metodos ?? [];
  const escolhido = metodos.find((m) => m.nome === pvx?.metodo_escolhido) ?? null;
  const acuraciaEscolhido = pvx?.acuracia_escolhido ?? escolhido?.acuracia_loo ?? null;
  const nEscolhido = escolhido?.n ?? null;
  const pvy = pvx as (typeof pvx & {
    criterio_escolha?: string;
    provisoria?: boolean;
    provisorio?: boolean;
    texto_publico?: string | null;
    explicacao_publica?: string | null;
    probabilidades?: { alta: number; manutencao: number; corte: number } | null;
    validacao_tempo?: { inicio_ata: number; fim_ata: number; n: number } | null;
    ultima_decisao?: { selic: number; data: string } | null;
    variacao_tom?: { delta: number; ata: number; ata_anterior: number } | null;
  }) | null | undefined;
  const provisoria = Boolean(pvy?.provisoria ?? pvy?.provisorio);
  const textoPublico = pvy?.texto_publico ?? pvy?.explicacao_publica ?? null;
  // texto público sem número (o acerto já aparece em "Acertou X de Y")
  const textoCurto = textoPublico
    ? /\d/.test(textoPublico)
      ? `Previsão do nosso modelo, treinado com as atas do Copom desde ${serie[0]?.data_reuniao.slice(0, 4) ?? ""}.`
      : textoPublico
    : null;
  const probs = escolhido?.probabilidades ?? pvy?.probabilidades ?? null;
  // modelo publicado: acurácia e reuniões da validação no tempo
  const testadas = escolhido?.n_tempo ?? nEscolhido;
  const acuraciaPublicada = acuraciaEscolhido ?? escolhido?.acuracia_tempo ?? null;
  const acertos = acuraciaPublicada != null && testadas ? Math.round(acuraciaPublicada * testadas) : null;
  const selicHoje = pvy?.ultima_decisao?.selic ?? ud?.selic ?? u.selic_apos;
  const fraseSelic =
    pv?.previsto === "manutencao"
      ? `Selic mantida em ${fmtSelic(selicHoje)}`
      : pv?.previsto === "aperto"
        ? `Selic sobe a partir de ${fmtSelic(selicHoje)}`
        : `Selic cai a partir de ${fmtSelic(selicHoje)}`;

  const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
  const ataRelatorio = pv?.base_ata ?? u.numero;

  return (
    <>
      {exemplo && (
        <div role="status" className="bg-alerta-suave text-alerta text-center text-sm font-medium px-4 py-2">
          Exemplo: manchete, previsão e relatório ilustrativos (teste local).
        </div>
      )}
      <Cabecalho />
      <main id="conteudo" className="flex-1">
        {/* 1. Capa: altura da tela menos o header, conteúdo centralizado */}
        <section className="relative lg:min-h-[100svh] lg:flex lg:flex-col pt-[104px] sm:pt-[112px] lg:pt-[92px]" aria-labelledby="manchete">
          {/* espaço acima : abaixo = 1 : 2 */}
          <div aria-hidden className="hidden lg:block lg:flex-[1]" />
          <FundoHero tom={serie.map((p) => p.indice)} selic={serie.map((p) => p.selic_apos)} />
          <div className="envelope relative w-full">
            <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
              <div className="min-w-0 flex flex-col">
                <p className="rotulo num entra-0">
                  Ata da {u.numero}ª reunião do Copom, de {data(u.data_reuniao)}
                </p>
                <ManchetePorLinha
                  id="manchete"
                  texto={manchete ?? "A manchete desta ata está sendo escrita"}
                  className="titulo-serifa mt-4 text-[2.25rem] leading-[1.08] sm:text-[2.75rem] lg:text-[clamp(2.6rem,3.5vw,3.25rem)] lg:leading-[1.06] tracking-[-0.025em] max-w-[24ch]"
                />
                {linhaFina ? (
                  <p className="entra-1 mt-5 text-[1.0625rem] sm:text-lg lg:text-[1.1875rem] leading-[1.55] text-tinta-2 max-w-[60ch]">{linhaFina}</p>
                ) : (
                  <p className="entra-1 mt-5">
                    <Aguardando texto="linha fina aguardando o pipeline" />
                  </p>
                )}
                <dl className="entra-2 mt-6 lg:mt-auto pt-4 border-t border-linha grid gap-x-8 gap-y-3 sm:flex sm:flex-wrap text-sm num">
                  <div>
                    <dt className="text-tinta-3">Selic após a reunião</dt>
                    <dd className="mt-0.5 font-medium">
                      {fmtSelic(u.selic_apos)} <span className="text-tinta-2 font-normal">({fmtDecisao(u.decisao, u.decisao_pp)})</span>
                    </dd>
                  </div>
                  {ud && !ud.ata_publicada && (
                    <div>
                      <dt className="text-tinta-3">Decisão de {dataCurta(ud.data)}</dt>
                      <dd className="mt-0.5 font-medium">
                        {ud.decisao === "manutencao"
                          ? `manteve em ${fmtSelic(ud.selic)}`
                          : `${fmtDecisao(ud.decisao, ud.decisao_pp)}, para ${fmtSelic(ud.selic)}`}
                        <span className="text-tinta-2 font-normal">, ata ainda não publicada</span>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-tinta-3">Documento</dt>
                    <dd className="mt-0.5">
                      <a href={u.url_pdf} target="_blank" rel="noopener noreferrer" className="link">
                        ata original em PDF
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Cartão: mesma altura do bloco de texto (grade esticada) */}
              <div className="relative">
              <aside className="entra-cartao cartao-destaque overflow-hidden flex flex-col lg:absolute lg:inset-0" aria-label="Destaques">
                <div className="px-5 py-3 bg-fundo-petroleo">
                  <p className="rotulo text-acento">Leia o relatório de hoje</p>
                  <p className="titulo-serifa mt-0.5 text-[1.125rem] leading-[1.25]">
                    O que mudou na ata {ataRelatorio}
                  </p>
                  <a
                    href="#relatorio"
                    className="botao-brilho group mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-acento px-4 py-2 text-[0.9375rem] font-medium text-papel shadow-[0_1px_2px_rgb(16_19_23/0.12)] transition-[background-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-acento-2 hover:shadow-[0_10px_24px_-12px_rgb(17_100_107/0.6)]"
                  >
                    Ler o relatório
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:translate-y-0.5">
                      <path d="M8 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>

                <div id="previsao" className="flex-1 min-h-0 flex flex-col justify-between gap-1.5 border-t border-linha px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[0.875rem] font-medium text-tinta">
                      Previsão para a próxima reunião{proxima?.data ? `, ${dataCurta(proxima.data).slice(0, 5)}` : ""}
                    </p>
                    {provisoria && <span className="text-xs text-alerta">provisória</span>}
                  </div>
                  {pv ? (
                    <>
                      <p className={`titulo-serifa text-[1.5rem] leading-[1.1] entra-2 ${corPrevisto(pv.previsto)}`}>{fraseSelic}</p>

                      {probs ? (
                        <div>
                          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-papel-3" role="img" aria-label={`Probabilidades: alta ${pct(probs.alta)}, manutenção ${pct(probs.manutencao)}, corte ${pct(probs.corte)}`}>
                            <span className="barra-enche h-full bg-duro-forte" style={{ width: `${probs.alta * 100}%`, animationDelay: "500ms" }} />
                            <span className="barra-enche h-full bg-tinta-3 border-x-2 border-papel" style={{ width: `${probs.manutencao * 100}%`, animationDelay: "640ms" }} />
                            <span className="barra-enche h-full bg-brando-forte" style={{ width: `${probs.corte * 100}%`, animationDelay: "780ms" }} />
                          </div>
                          <div className="mt-1.5 flex justify-between text-xs num">
                            <span className="text-duro">alta {pct(probs.alta)}</span>
                            <span className="text-tinta-2">manutenção {pct(probs.manutencao)}</span>
                            <span className="text-brando">corte {pct(probs.corte)}</span>
                          </div>
                        </div>
                      ) : (
                        <p>
                          <Aguardando texto="probabilidades aguardando o modelo" />
                        </p>
                      )}

                      {!provisoria && acertos != null && testadas ? (
                        <p className="text-sm text-tinta-2 num">
                          Acertou{" "}
                          <strong className="font-medium text-tinta">
                            <ContaAte valor={acertos} inteiro />
                          </strong>{" "}
                          de {testadas} reuniões testadas.
                        </p>
                      ) : null}

                      {textoCurto && <p className="text-[0.8125rem] leading-snug text-tinta-2">{textoCurto}</p>}

                      <div className="flex items-center gap-3 pt-2 border-t border-linha">
                        <Medidor valor={pv.indice} className="h-[28px] w-[46px] shrink-0" />
                        <p className="text-[0.8125rem] text-tinta-2 leading-snug num">
                          Tom da ata {pv.base_ata}: <span className={corIndice(pv.indice)}>{fmtIndice(pv.indice)}</span>.{" "}
                          <a href="#numeros" className="link whitespace-nowrap">ver os números</a>
                        </p>
                      </div>
                    </>
                  ) : (
                    <p>
                      <Aguardando texto="previsão aguardando o pipeline" />
                    </p>
                  )}
                </div>
              </aside>
              </div>
            </div>
          </div>
          <div aria-hidden className="hidden lg:block lg:flex-[2]" />
        </section>

        {/* 2. Relatório */}
        <section id="relatorio" className="envelope mt-24 sm:mt-32" aria-labelledby="relatorio-t">
          <hr className="regua-forte" />
          <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,680px)] lg:gap-20">
            <aside className="lg:sticky lg:top-24 self-start">
              <p className="rotulo">Relatório</p>
              <h2 id="relatorio-t" className="titulo-serifa mt-3 text-[2.1rem] sm:text-[2.5rem] leading-[1.08]">
                A ata {ataRelatorio}
                <br />
                em três partes
              </h2>
              {relatorio && (
                <nav aria-label="Partes do relatório" className="mt-6 hidden lg:block">
                  <ol className="grid gap-2 text-sm">
                    {relatorio.secoes.map((s, i) => (
                      <li key={s.id}>
                        <a href={`#rel-${s.id}`} className="flex gap-3 text-tinta-2 hover:text-tinta">
                          <span className="num text-tinta-3 w-4 shrink-0">{i + 1}</span>
                          {s.titulo}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <OrigemTexto origem={relatorio?.origem} />
                {!campos.relatorio && (revisados.impacto || revisados.mudancas.size > 0) && (
                  <span className="selo selo-ok">revisado pelo time</span>
                )}
              </div>
            </aside>

            <article aria-label="Relatório da ata">
              {!relatorio ? (
                <p>
                  <Aguardando texto="relatório desta ata aguardando o pipeline" />
                </p>
              ) : (
                relatorio.secoes.map((s, i) => (
                  <section key={s.id} id={`rel-${s.id}`} className={i > 0 ? "mt-14" : ""} aria-labelledby={`rel-${s.id}-t`}>
                    <h3 id={`rel-${s.id}-t`} className="flex items-baseline gap-4 text-[1.375rem] sm:text-[1.625rem] leading-tight titulo-serifa">
                      <span className="num font-sans text-sm text-tinta-3 tracking-normal w-5 shrink-0">{i + 1}</span>
                      {s.titulo}
                    </h3>
                    <div className="mt-5 grid gap-6 sm:pl-9">
                      {s.paragrafos.map((p, j) => (
                        <ParagrafoCitado key={j} texto={p.texto} citacoes={p.citacoes} notas={notas} />
                      ))}
                    </div>
                  </section>
                ))
              )}
              <p className="mt-12 sm:pl-9 text-sm text-tinta-3 max-w-[60ch]">
                Interpretação de texto, não previsão garantida. Toque nas marcas § para ver o trecho exato da ata e o link
                para o PDF oficial.
              </p>
            </article>
          </div>
        </section>

        {/* 3. Dados */}
        <section id="tom" className="mt-24 sm:mt-32 bg-fundo-petroleo border-y border-[#dbe8e6]" aria-labelledby="tom-t">
          <div className="envelope py-16 sm:py-24">
            <TituloSecao id="tom-t" rotulo="Os dados">
              O tom das atas
              <br />e a Selic
            </TituloSecao>

            <div className="mt-12 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="cartao p-6 sm:p-7 self-start">
                <p className="rotulo">Índice de tom da ata {u.numero}</p>
                <p className="mt-3 flex items-baseline gap-3">
                  <span className={`num text-[3.5rem] leading-none font-medium tracking-[-0.035em] ${u.indice != null && u.indice > 0 ? "text-duro" : u.indice != null && u.indice < 0 ? "text-brando" : "text-tinta"}`}>{fmtIndice(u.indice)}</span>
                  <span className="text-lg text-tinta-2">{tomRotulo(u.indice)}</span>
                </p>
                <div className="mt-8">
                  <Termometro valor={u.indice} anterior={anterior?.indice ?? null} rotuloAnterior={anterior ? `ata ${anterior.ata}` : undefined} />
                </div>
                <p className="mt-6 text-sm text-tinta-2 leading-relaxed">
                  Média das notas dos parágrafos que puxam para algum lado, numa régua de −2 (muito brando) a +2 (muito
                  duro). Acima de zero, o texto pende para juros mais altos.
                </p>
              </div>
              <div className="cartao p-5 sm:p-7 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">Tom de cada ata e Selic depois da reunião</p>
                  <p className="text-sm text-tinta-3 num">
                    {serie.length} reuniões, {dataCurta(serie[0]?.data_reuniao)} a {dataCurta(serie[serie.length - 1]?.data_reuniao)}
                  </p>
                </div>
                <div className="mt-6">
                  <GraficoTomSelic serie={serie} />
                </div>
              </div>
            </div>

            <div id="numeros" className="mt-16">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="titulo-serifa text-[1.625rem] leading-tight">Quanto a previsão acertou</h3>
                {periodo && (
                  <p className="text-sm text-tinta-3 num">
                    Direção da Selic na reunião seguinte, {dataCurta(periodo.inicio)} a {dataCurta(periodo.fim)}
                  </p>
                )}
              </div>
              <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-y-8">
                <Numero
                  destaque
                  valor={acuraciaPublicada != null && !provisoria ? pct(acuraciaPublicada) : <Aguardando />}
                  rotulo="Acerto da previsão"
                  contexto={
                    acertos != null && testadas && !provisoria
                      ? `${acertos} de ${testadas} reuniões testadas${pvy?.validacao_tempo ? `, da ata ${pvy.validacao_tempo.inicio_ata} à ${pvy.validacao_tempo.fim_ata}` : ""}.`
                      : "Aguardando a validação."
                  }
                />
                <Numero
                  valor={fmtSelic(selicHoje)}
                  rotulo="Selic hoje"
                  contexto={ud ? `Decisão de ${dataCurta(ud.data)}.` : `Depois da reunião de ${dataCurta(u.data_reuniao)}.`}
                />
                <Numero
                  valor={<span className={corIndice(u.indice)}>{fmtIndice(u.indice)}</span>}
                  rotulo={`Tom da ata ${u.numero}`}
                  contexto={`${maiuscula(tomRotulo(u.indice))}${
                    pvy?.variacao_tom ? `; ${fmtIndice(pvy.variacao_tom.delta)} em relação à ata ${pvy.variacao_tom.ata_anterior}` : ""
                  }. Explica o que mudou, não é a previsão.`}
                />
                <Numero
                  valor={pv?.focus_selic ? fmtSelic(pv.focus_selic.mediana) : <Aguardando />}
                  rotulo={pv?.focus_selic ? `Focus: Selic no fim de ${pv.focus_selic.ano_referencia}` : "Focus"}
                  contexto={pv?.focus_selic ? `Mediana do mercado, coleta de ${dataCurta(pv.focus_selic.data)}.` : "Aguardando o dado do Focus."}
                />
              </div>
              <p className="mt-10 text-sm text-tinta-3">
                Detalhes, matriz de confusão e validação no{" "}
                <Link href="/painel" className="link-tinta">
                  painel do time
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* 4. Evidência, recolhida */}
        <section id="evidencia" className="envelope mt-24 sm:mt-32" aria-labelledby="evidencia-t">
          <TituloSecao id="evidencia-t" rotulo="Evidência">
            De onde vem
            <br />
            cada conclusão
          </TituloSecao>
          <div className="mt-10 border-t border-tinta">
            <details className="group border-b border-linha">
              <summary className="cursor-pointer py-6 flex items-center justify-between gap-6">
                <span>
                  <span className="block text-lg sm:text-xl font-medium">Mudanças parágrafo a parágrafo</span>
                  <span className="block mt-1 text-sm text-tinta-3 num">
                    {mudancas.length
                      ? `${mudancas.length} parágrafos da ata ${u.numero} que mudaram em relação à anterior`
                      : "Nenhuma mudança relevante registrada"}
                  </span>
                </span>
                <span className="botao shrink-0" aria-hidden="true">
                  <span className="group-open:hidden">abrir</span>
                  <span className="hidden group-open:inline">fechar</span>
                </span>
              </summary>
              <div className="pb-8">
                <div className="mb-4 flex flex-wrap gap-2">
                  <OrigemTexto origem={dados.textos_origem ?? dados.mudancas_origem} />
                </div>
                <ol className="divide-y divide-linha">
                  {mudancas.map((mu, i) => (
                    <li key={`${mu.paragrafo}-${i}`} className="py-5 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-8">
                      <div className="flex sm:flex-col gap-2 sm:gap-1.5 items-baseline sm:items-start">
                        <span className="num text-sm font-medium">§ {mu.paragrafo}</span>
                        <span className="text-sm text-tinta-3">{mu.tipo}</span>
                        <span className={`selo border-transparent ${mu.efeito === "endureceu" ? "bg-duro-suave text-duro" : "bg-brando-suave text-brando"}`}>{mu.efeito}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`trecho text-[1.0625rem] leading-relaxed border-l-2 pl-4 break-words ${mu.efeito === "endureceu" ? "border-duro-forte" : "border-brando-forte"}`}>“{mu.trecho}”</p>
                        <p className="mt-2 text-sm text-tinta-2 leading-relaxed">{mu.explicacao}</p>
                        {revisados.mudancas.has(i) && <span className="selo selo-ok mt-2">revisado pelo time</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
            <details className="group border-b border-linha">
              <summary className="cursor-pointer py-6 flex items-center justify-between gap-6">
                <span>
                  <span className="block text-lg sm:text-xl font-medium">A régua e como medimos</span>
                  <span className="block mt-1 text-sm text-tinta-3">Como cada parágrafo vira uma nota e as notas viram um índice</span>
                </span>
                <span className="botao shrink-0" aria-hidden="true">
                  <span className="group-open:hidden">abrir</span>
                  <span className="hidden group-open:inline">fechar</span>
                </span>
              </summary>
              <div className="pb-8 grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="font-medium">A régua</h3>
                  <p className="mt-2 texto-2">{como_medimos.regua}</p>
                </div>
                <div>
                  <h3 className="font-medium">Do parágrafo ao índice</h3>
                  <p className="mt-2 texto-2">{como_medimos.agregacao}</p>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* 5. Ferramentas */}
        <section id="ferramentas" className="mt-24 sm:mt-32 bg-fundo-frio border-y border-[#dfe7f2]" aria-labelledby="ferramentas-t">
          <div className="envelope py-16 sm:py-24">
          <TituloSecao id="ferramentas-t" rotulo="Ferramentas">
            Leia as atas
            <br />
            por conta própria
          </TituloSecao>
          <div className="mt-10 grid gap-8">
            <div id="perguntar">
              <h3 className="titulo-serifa text-[1.625rem] leading-tight">Pergunte às atas</h3>
              <p className="mt-2 text-tinta-2 max-w-[62ch]">
                A resposta é sempre um trecho da ata, com o número do parágrafo e o link para o PDF oficial.
              </p>
              <div className="mt-6">
                <PergunteAsAtas atas={atas.map((a) => ({ numero: a.numero, data_reuniao: a.data_reuniao }))} />
              </div>
            </div>
            <div id="atas" className="cartao p-5 sm:p-8">
              <h3 className="titulo-serifa text-[1.625rem] leading-tight">Explorar as atas</h3>
              <p className="mt-2 text-tinta-2 max-w-[62ch]">
                Escolha uma reunião para ver os parágrafos que puxaram o tom para cima ou para baixo, com a nota e o trecho.
              </p>
              <div className="mt-6">
                <ExplorarAtas atas={atas} revisadas={[...revisados.notas]} />
              </div>
            </div>
          </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
