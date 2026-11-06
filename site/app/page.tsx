import Link from "next/link";
import { dados } from "@/lib/dados";
import { data, dataCurta, indice as fmtIndice, selic as fmtSelic, decisao as fmtDecisao, tomRotulo } from "@/lib/formato";
import { Termometro } from "@/components/Termometro";
import { GraficoIndice } from "@/components/GraficoIndice";
import { ExplorarAtas } from "@/components/ExplorarAtas";
import { PergunteAsAtas } from "@/components/PergunteAsAtas";
import { Rodape } from "@/components/Rodape";

function Secao({
  id,
  titulo,
  resumo,
  children,
}: {
  id: string;
  titulo: React.ReactNode;
  resumo?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="text-2xl sm:text-3xl font-semibold leading-tight">
        {titulo}
      </h2>
      {resumo && <p className="mt-2 text-texto-2 max-w-[65ch]">{resumo}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AvisoPendente() {
  return (
    <div className="cartao p-5 border-dashed text-texto-2" role="status">
      <p className="font-semibold text-texto">textos da ata nova em revisão</p>
      <p className="text-sm mt-1">O índice e os trechos já estão atualizados; a leitura em texto está sendo conferida pelo time.</p>
    </div>
  );
}

export default function Pagina() {
  const { resumo, serie, mudancas, impacto, atas, como_medimos } = dados;
  const u = resumo.ultima_ata;

  return (
    <>
    <main id="conteudo" className="mx-auto w-full max-w-[1100px] px-4 pb-8">
      <header className="pt-8 sm:pt-12">
        <p className="text-sm text-texto-2">Tradutor do Copom</p>
        <h1 className="mt-1 text-3xl sm:text-5xl font-semibold leading-tight">
          O Banco Central ficou
          <br />
          mais duro ou mais brando?
        </h1>
        <p className="mt-3 text-texto-2 max-w-[62ch]">
          Lemos cada parágrafo da ata do Copom e damos uma nota de −2 (muito brando) a +2 (muito duro). Toda conclusão
          vem com o número do parágrafo e o trecho exato.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="cartao p-5">
          <p className="rotulo">última reunião</p>
          <p className="mt-1 text-2xl font-semibold num">{u.numero}ª</p>
          <p className="text-texto-2 num">{data(u.data_reuniao)}</p>
          <a
            href={u.url_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-ciano underline underline-offset-4"
          >
            ler a ata no site do BC
          </a>
        </div>
        <div className="cartao p-5">
          <p className="rotulo">decisão e Selic meta</p>
          <p className="mt-1 text-2xl font-semibold num">{fmtSelic(u.selic_apos)}</p>
          <p className="text-texto-2 num">{fmtDecisao(u.decisao, u.decisao_pp)}</p>
        </div>
        <div className="cartao p-5 sm:col-span-1">
          <p className="rotulo">tom da ata</p>
          <p className="mt-1 text-2xl font-semibold num">
            {fmtIndice(u.indice)} <span className="text-base font-normal text-texto-2">{tomRotulo(u.indice)}</span>
          </p>
          <div className="mt-2">
            <Termometro valor={u.indice} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-texto-2 num">
        {resumo.n_atas} atas e {resumo.n_paragrafos} parágrafos no banco, de {data(resumo.periodo.inicio)} a{" "}
        {data(resumo.periodo.fim)}.
      </p>

      <Secao
        id="grafico"
        titulo={
          <>
            O tom ao longo
            <br className="sm:hidden" /> das reuniões
          </>
        }
        resumo="Linha azul: índice de tom de cada ata. Linha tracejada: a Selic meta decidida na mesma reunião. Compare se a fala antecipou o que o Copom fez depois."
      >
        <div className="cartao p-3 sm:p-5">
          <GraficoIndice serie={serie} />
        </div>
      </Secao>

      <Secao
        id="mudancas"
        titulo="O que mudou na última ata"
        resumo={`Comparação da ${u.numero}ª ata com a anterior. Cada item traz o parágrafo, o trecho exato e se a mudança endureceu ou suavizou o tom.`}
      >
        {dados.textos_pendentes ? (
          <AvisoPendente />
        ) : mudancas.length === 0 ? (
          <p className="text-texto-2">Nenhuma mudança relevante registrada.</p>
        ) : (
          <ol className="grid gap-4 md:grid-cols-3">
            {mudancas.map((m) => (
              <li key={`${m.paragrafo}-${m.tipo}`} className="cartao p-5 flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs num">
                  <span className="text-texto-2">
                    § {m.paragrafo} · parágrafo {m.tipo}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-semibold ${
                      m.efeito === "endureceu" ? "bg-duro/15 text-duro" : "bg-brando/15 text-brando"
                    }`}
                  >
                    {m.efeito}
                  </span>
                </div>
                <p className="trecho break-words">“{m.trecho}”</p>
                <p className="text-sm text-texto-2">{m.explicacao}</p>
              </li>
            ))}
          </ol>
        )}
      </Secao>

      <Secao id="impacto" titulo="Principal impacto">
        {dados.textos_pendentes ? (
          <AvisoPendente />
        ) : (
        <div className="cartao p-5 sm:p-6 border-l-4 border-l-ciano">
          <p className="text-lg leading-relaxed max-w-[70ch]">{impacto.texto}</p>
          <p className="mt-4 text-xs text-texto-2 num">
            Interpretação, não previsão. Baseada na Selic meta até {dataCurta(impacto.data_selic)} e no Relatório Focus de{" "}
            {dataCurta(impacto.data_focus)}.
          </p>
        </div>
        )}
      </Secao>

      <Secao
        id="atas"
        titulo="Explorar as atas"
        resumo="Escolha uma reunião para ver os parágrafos que puxaram o tom para cima ou para baixo, com a nota e o trecho."
      >
        <ExplorarAtas atas={atas} />
      </Secao>

      <Secao
        id="perguntar"
        titulo="Pergunte às atas"
        resumo="A resposta é sempre um trecho da ata, com o número do parágrafo e o link para o PDF oficial."
      >
        <PergunteAsAtas atas={atas.map((a) => ({ numero: a.numero, data_reuniao: a.data_reuniao }))} />
      </Secao>

      <Secao id="como-medimos" titulo="Como medimos">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="cartao p-5">
            <h3 className="font-semibold mb-2">A régua</h3>
            <p className="text-sm text-texto-2">{como_medimos.regua}</p>
          </div>
          <div className="cartao p-5">
            <h3 className="font-semibold mb-2">Como juntamos num número</h3>
            <p className="text-sm text-texto-2">{como_medimos.agregacao}</p>
          </div>
          <div className="cartao p-5">
            <h3 className="font-semibold mb-2">Como conferimos</h3>
            <p className="text-sm text-texto-2">{como_medimos.validacao}</p>
          </div>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/painel" className="text-ciano underline underline-offset-4">
            ver o painel de verificação: acurácia da previsão, matriz de confusão e validação humana
          </Link>
        </p>
      </Secao>

    </main>
    <Rodape />
    </>
  );
}
