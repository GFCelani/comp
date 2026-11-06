import Link from "next/link";
import { dados } from "@/lib/dados";
import {
  data,
  dataCurta,
  indice as fmtIndice,
  selic as fmtSelic,
  decisao as fmtDecisao,
  pontos,
  tomRotulo,
} from "@/lib/formato";
import { Termometro } from "@/components/Termometro";
import { GraficoIndice } from "@/components/GraficoIndice";
import { ExplorarAtas } from "@/components/ExplorarAtas";
import { PergunteAsAtas } from "@/components/PergunteAsAtas";
import { Rodape } from "@/components/Rodape";
import { Cabecalho } from "@/components/Cabecalho";

function Editoria({
  id,
  kicker,
  titulo,
  linhaFina,
  children,
}: {
  id: string;
  kicker: string;
  titulo: React.ReactNode;
  linhaFina?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-20" aria-labelledby={`${id}-titulo`}>
      <p className="etiqueta">{kicker}</p>
      <h2 id={`${id}-titulo`} className="mt-3 text-3xl sm:text-4xl font-semibold leading-[1.05]">
        {titulo}
      </h2>
      {linhaFina && <p className="mt-3 text-texto-2 max-w-[64ch] text-lg leading-relaxed">{linhaFina}</p>}
      <hr className="regua mt-6" />
      <div className="mt-8">{children}</div>
    </section>
  );
}

function AvisoPendente() {
  return (
    <div className="cartao p-5 border-dashed text-texto-2" role="status">
      <p className="font-semibold text-texto">textos da ata nova em revisão</p>
      <p className="text-sm mt-1">
        O índice e os trechos já estão atualizados; a leitura em texto está sendo conferida pelo time.
      </p>
    </div>
  );
}

function manchete(decisao: "alta" | "manutencao" | "corte", selicApos: number, indice: number | null) {
  const verbo = decisao === "corte" ? "corta a Selic para" : decisao === "alta" ? "sobe a Selic para" : "mantém a Selic em";
  const tom = tomRotulo(indice);
  const tomFrase =
    tom === "sem leitura"
      ? "ata ainda sem leitura de tom"
      : tom === "neutro"
        ? "fala em tom neutro"
        : `fala em tom ${tom}`;
  return { linha1: `Copom ${verbo} ${fmtSelic(selicApos)}`, linha2: `e ${tomFrase}` };
}

export default function Pagina() {
  const { resumo, serie, mudancas, impacto, atas, como_medimos } = dados;
  const u = resumo.ultima_ata;
  const m = manchete(u.decisao, u.selic_apos, u.indice);
  const primeiro = serie.find((p) => p.indice !== null && p.indice !== undefined) ?? serie[0];
  const ultimo = serie[serie.length - 1];
  const anterior = serie.length > 1 ? serie[serie.length - 2] : null;

  return (
    <>
      <Cabecalho atual="site" />
      <main id="conteudo" className="mx-auto w-full max-w-[1180px] px-4 pb-8">
        {/* Manchete */}
        <header className="pt-10 sm:pt-16">
          <span className="pilula">
            edição nº {u.numero} · ata da reunião de {dataCurta(u.data_reuniao)}
          </span>
          <h1 className="mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl lg:text-7xl font-semibold max-w-[16ch]">
            {m.linha1}
            <br />
            {m.linha2}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-texto-2 max-w-[60ch] leading-relaxed">
            Lemos cada parágrafo da ata e damos uma nota de −2 (muito brando) a +2 (muito duro). A {u.numero}ª ata ficou
            em <span className="text-texto num">{fmtIndice(u.indice)}</span>
            {anterior && (
              <>
                , contra <span className="text-texto num">{fmtIndice(anterior.indice)}</span> na anterior
              </>
            )}
            . Toda conclusão vem com o número do parágrafo e o trecho exato.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-texto-2 num">
            <span>reunião de {data(u.data_reuniao)}</span>
            <span aria-hidden="true" className="text-texto-3">
              |
            </span>
            <span>
              {resumo.n_atas} atas e {resumo.n_paragrafos} parágrafos no banco, de {data(resumo.periodo.inicio)} a{" "}
              {data(resumo.periodo.fim)}
            </span>
            <span aria-hidden="true" className="text-texto-3">
              |
            </span>
            <a href={u.url_pdf} target="_blank" rel="noopener noreferrer" className="link">
              ata original no site do BC
            </a>
          </div>
          <hr className="regua-forte mt-5" />
        </header>

        {/* Em números + termômetro */}
        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1fr_1.3fr]">
          <div className="border-t border-borda pt-4 md:border-t-0 md:pt-0 md:border-r md:pr-6">
            <p className="etiqueta etiqueta-sem-ponto">decisão</p>
            <p className="mt-2 text-4xl font-semibold num tracking-tight">{fmtSelic(u.selic_apos)}</p>
            <p className="text-texto-2 mt-1">{fmtDecisao(u.decisao, u.decisao_pp)} ao ano</p>
          </div>
          <div className="border-t border-borda pt-4 md:border-t-0 md:pt-0 md:border-r md:pr-6">
            <p className="etiqueta etiqueta-sem-ponto">índice de tom</p>
            <p className="mt-2 text-4xl font-semibold num tracking-tight text-acento">{fmtIndice(u.indice)}</p>
            <p className="text-texto-2 mt-1">{tomRotulo(u.indice)} numa régua de −2 a +2</p>
          </div>
          <div className="border-t border-borda pt-4 md:border-t-0 md:pt-0">
            <p className="etiqueta etiqueta-sem-ponto">termômetro</p>
            <div className="mt-2">
              <Termometro valor={u.indice} />
            </div>
          </div>
        </div>

        {/* Gráfico integrado ao texto */}
        <section id="grafico" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.6fr] items-start" aria-labelledby="grafico-titulo">
          <div>
            <p className="etiqueta">o tom ao longo das reuniões</p>
            <h2 id="grafico-titulo" className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">
              De {fmtIndice(primeiro?.indice)} na {primeiro?.ata}ª
              <br />a {fmtIndice(ultimo?.indice)} na {ultimo?.ata}ª
            </h2>
            <p className="coluna-texto mt-4">
              A linha âmbar é o índice de tom de cada ata, de −2 a +2. A linha tracejada é a Selic meta decidida na
              mesma reunião, com o símbolo da decisão: corte, manutenção ou alta. Vale comparar se a fala antecipou o
              que o Copom fez em seguida; essa conferência está no{" "}
              <Link href="/painel" className="link">
                painel de verificação
              </Link>
              .
            </p>
            {anterior && (
              <p className="coluna-texto mt-3">
                Entre a {anterior.ata}ª e a {u.numero}ª, o índice foi de {fmtIndice(anterior.indice)} para{" "}
                {fmtIndice(u.indice)} e a Selic de {fmtSelic(anterior.selic_apos)} para {fmtSelic(u.selic_apos)} (
                {pontos(u.decisao_pp)}).
              </p>
            )}
          </div>
          <div className="cartao p-3 sm:p-5">
            <GraficoIndice serie={serie} />
          </div>
        </section>

        <Editoria
          id="mudancas"
          kicker="editoria · o que mudou"
          titulo={
            <>
              O que mudou
              <br />
              na última ata
            </>
          }
          linhaFina={`Comparação da ${u.numero}ª ata com a anterior. Cada item traz o parágrafo, o trecho exato e se a mudança endureceu ou suavizou o tom.`}
        >
          {dados.textos_pendentes ? (
            <AvisoPendente />
          ) : mudancas.length === 0 ? (
            <p className="text-texto-2">Nenhuma mudança relevante registrada.</p>
          ) : (
            <ol className="grid gap-8 md:grid-cols-3 md:divide-x md:divide-borda">
              {mudancas.map((mu, i) => (
                <li key={`${mu.paragrafo}-${mu.tipo}`} className={`min-w-0 ${i > 0 ? "md:pl-8" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="etiqueta etiqueta-sem-ponto">
                      § {mu.paragrafo} · {mu.tipo}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        mu.efeito === "endureceu"
                          ? "border-duro/40 text-duro"
                          : "border-brando/40 text-brando"
                      }`}
                    >
                      {mu.efeito}
                    </span>
                  </div>
                  <blockquote className="mt-4 text-xl leading-snug font-medium break-words">
                    “{mu.trecho}”
                  </blockquote>
                  <p className="coluna-texto mt-4">{mu.explicacao}</p>
                </li>
              ))}
            </ol>
          )}
        </Editoria>

        <Editoria id="impacto" kicker="editoria · principal impacto" titulo="O que isso pode significar">
          {dados.textos_pendentes ? (
            <AvisoPendente />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
              <p className="text-xl sm:text-2xl leading-relaxed font-medium border-l-2 border-acento pl-6">
                {impacto.texto}
              </p>
              <div className="coluna-texto lg:border-l lg:border-borda lg:pl-8">
                <p className="etiqueta etiqueta-sem-ponto mb-3">base da leitura</p>
                <p>
                  Interpretação, não previsão. Baseada na Selic meta até{" "}
                  <span className="text-texto num">{dataCurta(impacto.data_selic)}</span> e no Relatório Focus de{" "}
                  <span className="text-texto num">{dataCurta(impacto.data_focus)}</span>.
                </p>
                <p className="mt-3">
                  A Selic do Focus é a esperada para o fim do ano, não a da próxima reunião.
                </p>
              </div>
            </div>
          )}
        </Editoria>

        <Editoria
          id="atas"
          kicker="editoria · explorar as atas"
          titulo="Ata por ata, parágrafo por parágrafo"
          linhaFina="Escolha uma reunião para ver os parágrafos que puxaram o tom para cima ou para baixo, com a nota e o trecho."
        >
          <ExplorarAtas atas={atas} />
        </Editoria>

        <Editoria
          id="perguntar"
          kicker="editoria · pergunte às atas"
          titulo="Pergunte às atas"
          linhaFina="A resposta é sempre um trecho da ata, com o número do parágrafo e o link para o PDF oficial."
        >
          <PergunteAsAtas atas={atas.map((a) => ({ numero: a.numero, data_reuniao: a.data_reuniao }))} />
        </Editoria>

        <Editoria id="como-medimos" kicker="editoria · como medimos" titulo="A régua, a conta e a conferência">
          <div className="grid gap-8 md:grid-cols-3 md:divide-x md:divide-borda">
            <div>
              <h3 className="font-semibold text-lg">A régua</h3>
              <p className="coluna-texto mt-2">{como_medimos.regua}</p>
            </div>
            <div className="md:pl-8">
              <h3 className="font-semibold text-lg">Como juntamos num número</h3>
              <p className="coluna-texto mt-2">{como_medimos.agregacao}</p>
            </div>
            <div className="md:pl-8">
              <h3 className="font-semibold text-lg">Como conferimos</h3>
              <p className="coluna-texto mt-2">{como_medimos.validacao}</p>
            </div>
          </div>
          <p className="mt-8">
            <Link href="/painel" className="botao botao-principal">
              ver o painel de verificação
            </Link>
          </p>
        </Editoria>
      </main>
      <Rodape />
    </>
  );
}
