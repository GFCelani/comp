import type { Metadata } from "next";
import { dados, type MetricasLado } from "@/lib/dados";
import { data, dataCurta, indice as fmtIndice, pct, pontos, previsaoRotulo } from "@/lib/formato";
import { Matriz } from "@/components/Matriz";
import { Rodape } from "@/components/Rodape";
import { Cabecalho } from "@/components/Cabecalho";
import { GraficoIndice } from "@/components/GraficoIndice";
import { fraseUltimaVerificacao } from "@/lib/verificacao";

export const metadata: Metadata = {
  title: "Painel de verificação · Tradutor do Copom",
  description: "Acurácia da previsão a partir do tom, matriz de confusão, comparação com uma previsão ingênua, modelo do parceiro e validação humana.",
};

function Destaque({ rotulo, valor, nota, menor }: { rotulo: string; valor: string; nota?: string; menor?: boolean }) {
  return (
    <div className="cartao p-4">
      <p className="etiqueta etiqueta-sem-ponto">{rotulo}</p>
      <p className={`mt-2 font-semibold num tracking-tight ${menor ? "text-lg sm:text-xl" : "text-3xl sm:text-4xl"}`}>{valor}</p>
      {nota && <p className="text-xs text-texto-2 mt-1">{nota}</p>}
    </div>
  );
}

function Bloco({
  id,
  kicker,
  titulo,
  children,
}: {
  id: string;
  kicker: string;
  titulo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16" aria-labelledby={`${id}-titulo`}>
      <p className="etiqueta">{kicker}</p>
      <h2 id={`${id}-titulo`} className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">
        {titulo}
      </h2>
      <hr className="regua mt-5" />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Aguardando({ texto }: { texto: string }) {
  return (
    <div className="cartao p-5 border-dashed text-texto-2">
      <p className="font-semibold text-texto">aguardando</p>
      <p className="text-sm mt-1">{texto}</p>
    </div>
  );
}

const rotulosPrevisao = ["afrouxamento", "manutencao", "aperto"] as const;

function rotulosLegiveis(rotulos: string[]) {
  return rotulos.map((r) => previsaoRotulo[r as (typeof rotulosPrevisao)[number]] ?? r);
}

function LadoComparativo({ titulo, m, descricao }: { titulo: string; m: MetricasLado; descricao: string }) {
  return (
    <div className="cartao p-5 min-w-0">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="text-xs text-texto-2 mt-1">{descricao}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 num">
        <div>
          <dt className="rotulo">acurácia</dt>
          <dd className="text-xl font-semibold">{pct(m.acuracia)}</dd>
        </div>
        <div>
          <dt className="rotulo">acerto do sinal</dt>
          <dd className="text-xl font-semibold">{pct(m.acerto_sinal)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <Matriz
          rotulos={rotulosLegiveis(m.matriz_confusao.rotulos)}
          valores={m.matriz_confusao.valores}
          legenda={`Matriz de confusão: ${titulo}`}
        />
      </div>
    </div>
  );
}

export default async function Painel() {
  const verificacao = await fraseUltimaVerificacao();
  const cs = dados.conferencia_selic ?? null;
  const { resumo, metricas_previsao: mp, metricas_modelo: mm, validacao_humana: vh } = dados;

  const fraseMelhor = mp
    ? mp.melhor === "indice"
      ? `O índice de tom acertou mais vezes (${pct(mp.indice.acuracia)}) do que repetir a última decisão (${pct(mp.ingenua.acuracia)}).`
      : mp.melhor === "ingenua"
        ? `Repetir a última decisão acertou mais vezes (${pct(mp.ingenua.acuracia)}) do que o índice de tom (${pct(mp.indice.acuracia)}). Nesta amostra, o tom ainda não bate a regra ingênua.`
        : `Empate: o índice de tom e a regra ingênua tiveram a mesma acurácia (${pct(mp.indice.acuracia)}).`
    : null;

  return (
    <>
      <Cabecalho atual="painel" />
      <main id="conteudo" className="mx-auto w-full max-w-[1180px] px-4 pb-8">
        <header className="pt-10 sm:pt-16">
          <span className="pilula">painel de verificação · só leitura</span>
          <h1 className="mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl font-semibold max-w-[16ch]">
            O tom antecipou
            <br />o que o Copom fez?
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-texto-2 max-w-[60ch] leading-relaxed">
            Aqui conferimos o índice contra o que aconteceu de fato. Nada é calculado nesta página: todos os números vêm
            do pipeline, e o que ainda não existe aparece como “aguardando”.
          </p>
          <hr className="regua-forte mt-8" />
        </header>

        <Bloco id="regra" kicker="01 · regra" titulo="A regra de previsão">
          <div className="cartao p-5 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="rotulo">índice acima de +0,25</p>
              <p className="mt-1 font-semibold text-duro">prevê alta da Selic na reunião seguinte</p>
            </div>
            <div>
              <p className="rotulo">entre −0,25 e +0,25</p>
              <p className="mt-1 font-semibold text-texto-2">prevê manutenção</p>
            </div>
            <div>
              <p className="rotulo">índice abaixo de −0,25</p>
              <p className="mt-1 font-semibold text-brando">prevê corte da Selic na reunião seguinte</p>
            </div>
            <p className="sm:col-span-3 text-xs text-texto-2">
              A última ata não entra na conta porque a reunião seguinte ainda não aconteceu. O limiar de ±0,25 foi fixado
              antes de olhar os resultados e não é ajustado para melhorar a nota.
            </p>
          </div>
        </Bloco>

        <Bloco id="resultado" kicker="02 · resultado" titulo="Resultado do índice de tom">
          {!mp ? (
            <Aguardando texto="As métricas de previsão ainda não foram geradas pelo pipeline." />
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Destaque rotulo="acurácia" valor={pct(mp.indice.acuracia)} nota="previsões certas sobre o total" />
                <Destaque
                  rotulo="acerto do sinal"
                  valor={pct(mp.indice.acerto_sinal)}
                  nota="quando previu alta ou corte, acertou a direção"
                />
                <Destaque rotulo="atas avaliadas" valor={String(mp.n_atas)} />
                <Destaque
                  rotulo="período"
                  valor={`${dataCurta(mp.periodo.inicio)} a ${dataCurta(mp.periodo.fim)}`}
                  menor
                />
              </div>

              <div className="cartao p-3 sm:p-5 mt-6">
                <h3 className="font-semibold mb-1 px-2 sm:px-0">Índice de tom e Selic meta, ata por ata</h3>
                <p className="text-xs text-texto-2 mb-3 px-2 sm:px-0">O mesmo gráfico do jornal: cada ponto âmbar é o índice; o símbolo na linha tracejada é a decisão da reunião.</p>
                <GraficoIndice serie={dados.serie} />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[auto_1fr]">
                <div className="cartao p-5">
                  <h3 className="font-semibold mb-3">Matriz de confusão</h3>
                  <Matriz
                    rotulos={rotulosLegiveis(mp.indice.matriz_confusao.rotulos)}
                    valores={mp.indice.matriz_confusao.valores}
                    legenda="Matriz de confusão do índice de tom: linhas são o previsto, colunas o realizado"
                  />
                  <p className="text-xs text-texto-2 mt-3 max-w-[36ch]">
                    Linhas: o que o índice previu. Colunas: o que o Copom fez. A diagonal (verde) são os acertos.
                  </p>
                </div>

                <div className="cartao p-5 min-w-0">
                  <h3 className="font-semibold mb-3">Linha do tempo</h3>
                  <ol className="sm:hidden divide-y divide-borda num" aria-label="Linha do tempo das previsões">
                    {mp.indice.atas.map((a) => (
                      <li key={a.ata} className="py-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                        <span className="font-semibold">
                          {a.ata}ª <span className="text-texto-2 text-xs font-normal">{data(a.data_reuniao)}</span>
                        </span>
                        <span className={`font-semibold text-sm ${a.acertou ? "text-brando" : "text-erro"}`}>
                          {a.acertou ? "acertou" : "errou"}
                        </span>
                        <span className="text-sm text-texto-2 col-span-2">
                          índice <span className="text-acento">{fmtIndice(a.indice)}</span> → previu{" "}
                          <span className="text-texto">{previsaoRotulo[a.previsto]}</span>; Selic na seguinte{" "}
                          <span className="text-texto">{pontos(a.variacao_pp)}</span> ({previsaoRotulo[a.realizado]})
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm num">
                      <thead>
                        <tr className="text-left text-xs text-texto-2">
                          <th scope="col" className="py-1 pr-3 font-normal">ata</th>
                          <th scope="col" className="py-1 pr-3 font-normal">índice</th>
                          <th scope="col" className="py-1 pr-3 font-normal">previsto</th>
                          <th scope="col" className="py-1 pr-3 font-normal">Selic na seguinte</th>
                          <th scope="col" className="py-1 font-normal">acertou</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borda">
                        {mp.indice.atas.map((a) => (
                          <tr key={a.ata}>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {a.ata}ª <span className="text-texto-2 text-xs">{data(a.data_reuniao)}</span>
                            </td>
                            <td className="py-2 pr-3 text-acento">{fmtIndice(a.indice)}</td>
                            <td className="py-2 pr-3">{previsaoRotulo[a.previsto]}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {pontos(a.variacao_pp)}{" "}
                              <span className="text-texto-2 text-xs">({previsaoRotulo[a.realizado]})</span>
                            </td>
                            <td className={`py-2 font-semibold ${a.acertou ? "text-brando" : "text-erro"}`}>
                              {a.acertou ? "sim" : "não"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </Bloco>

        <Bloco id="comparativo" kicker="03 · base de comparação" titulo="Nosso índice × previsão ingênua">
          {!mp ? (
            <Aguardando texto="A comparação com a previsão ingênua depende das métricas de previsão." />
          ) : (
            <>
              <p className="text-texto-2 max-w-[70ch] text-sm">
                A previsão ingênua repete a decisão da reunião atual como aposta para a próxima. É a régua mínima: um índice
                que não ganha dela não está acrescentando informação.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LadoComparativo titulo="Índice de tom" m={mp.indice} descricao="Regra de ±0,25 sobre o índice da ata." />
                <LadoComparativo
                  titulo="Previsão ingênua"
                  m={mp.ingenua}
                  descricao="Repete a decisão da reunião atual."
                />
              </div>
              <p className="mt-4 cartao p-4 border-l-4 border-l-acento text-sm">{fraseMelhor}</p>
            </>
          )}
        </Bloco>

        <Bloco id="modelo" kicker="04 · modelo" titulo="Modelo do parceiro">
          {!mm ? (
            <Aguardando texto="O modelo do parceiro ainda não enviou banco/metricas_modelo.json. Quando chegar, aparecem aqui a acurácia parágrafo a parágrafo contra os rótulos do Claude e a matriz 5×5." />
          ) : (
            <>
              <p className="text-sm text-texto-2">
                Método: <span className="text-texto">{mm.metodo}</span> · {mm.n_paragrafos} parágrafos · gerado em{" "}
                {dataCurta(mm.gerado_em.slice(0, 10))}
              </p>
              <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-3">
                <Destaque rotulo="acurácia" valor={pct(mm.acuracia)} nota="nota igual à do Claude" />
                <Destaque rotulo="acurácia dentro de 1 ponto" valor={pct(mm.acuracia_1ponto)} />
                <Destaque rotulo="erro médio absoluto" valor={fmtIndice(mm.erro_medio_abs).replace("+", "")} />
              </div>
              <div className="cartao p-5 mt-4">
                <h3 className="font-semibold mb-3">Matriz 5×5: rótulo do Claude × previsão do modelo</h3>
                <Matriz
                  rotulos={mm.matriz_confusao.rotulos.map((r) => (r > 0 ? `+${r}` : String(r)))}
                  valores={mm.matriz_confusao.valores}
                  legenda="Matriz de confusão do modelo do parceiro"
                  eixoLinha="Claude"
                  eixoColuna="modelo"
                />
              </div>
            </>
          )}
        </Bloco>

        <Bloco id="validacao" kicker="05 · validação" titulo="Validação humana">
          {!vh ? (
            <Aguardando texto="O time ainda está classificando os 20 parágrafos à mão. Quando terminar, a concordância com o Claude aparece aqui." />
          ) : (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <Destaque rotulo="parágrafos conferidos" valor={String(vh.n)} />
              <Destaque rotulo="concordância exata" valor={pct(vh.concordancia_exata)} nota="humano e Claude deram a mesma nota" />
              <Destaque rotulo="concordância dentro de 1 ponto" valor={pct(vh.concordancia_1ponto)} />
            </div>
          )}
        </Bloco>

        <Bloco id="conferencia" kicker="06 · conferência" titulo="Conferência com a tabela oficial do BC">
          {!cs ? (
            <Aguardando texto="A conferência da Selic de cada reunião com o histórico oficial do Banco Central ainda não rodou." />
          ) : (
            <div className="cartao p-5">
              <p className="text-lg font-semibold num">
                {cs.n_comparadas} {cs.n_comparadas === 1 ? "reunião conferida" : "reuniões conferidas"},{" "}
                {cs.divergencias.length === 0
                  ? "nenhuma divergência"
                  : `${cs.divergencias.length} ${cs.divergencias.length === 1 ? "divergência" : "divergências"}`}
              </p>
              {cs.divergencias.length > 0 && (
                <ul className="mt-3 divide-y divide-borda text-sm num">
                  {cs.divergencias.map((d, i) => (
                    <li key={i} className="py-2 break-words text-texto-2">
                      {Object.entries(d)
                        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                        .join(" · ")}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-texto-2 num">
                Conferido em {dataCurta(cs.verificado_em?.slice(0, 10))} contra{" "}
                <a href={cs.fonte_url} target="_blank" rel="noopener noreferrer" className="link break-all">
                  a tabela de taxas do BC
                </a>
                .
              </p>
            </div>
          )}
        </Bloco>

        <Bloco id="fluxo" kicker="07 · fluxo automático" titulo="O que roda sozinho">
          <div className="grid gap-8 md:grid-cols-3 md:divide-x md:divide-borda">
            <div>
              <h3 className="font-semibold text-lg">Todo dia útil</h3>
              <p className="coluna-texto mt-2">
                Às 10h, 14h e 18h o sistema verifica se o Banco Central publicou uma ata nova. Se publicou, baixa a ata,
                extrai os parágrafos, dá a nota de tom, gera os textos, confere a Selic, passa pelo portão de qualidade e
                publica o site.
              </p>
              <p className="coluna-texto mt-2 num">{verificacao}</p>
            </div>
            <div className="md:pl-8">
              <h3 className="font-semibold text-lg">Planos B</h3>
              <p className="coluna-texto mt-2">
                Nota de tom: modelo do parceiro; se não estiver disponível, o Claude; se o Claude falhar, um modelo
                TF-IDF de base.
              </p>
              <p className="coluna-texto mt-2">
                Textos de “o que mudou” e “impacto”: o Claude; se falhar, um texto automático sem IA, montado a partir
                dos dados.
              </p>
            </div>
            <div className="md:pl-8">
              <h3 className="font-semibold text-lg">Configuração manual</h3>
              <p className="coluna-texto mt-2">
                Só uma, feita uma vez no início: cadastrar o token do Claude nos segredos do repositório no GitHub.
              </p>
            </div>
          </div>
        </Bloco>

        <Bloco id="qualidade" kicker="08 · dados" titulo="Qualidade dos dados">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Destaque rotulo="atas no banco" valor={String(resumo.n_atas)} nota={`${data(resumo.periodo.inicio)} a ${data(resumo.periodo.fim)}`} />
            <Destaque rotulo="parágrafos" valor={String(resumo.n_paragrafos)} />
            <Destaque
              rotulo="trechos inválidos"
              valor={String(resumo.n_trechos_invalidos)}
              nota="citações que não são cópia exata da ata"
            />
            <Destaque rotulo="última atualização" valor={dataCurta(dados.gerado_em.slice(0, 10))} nota={`fonte do índice: ${dados.fonte_indice}`} menor />
          </div>
        </Bloco>
      </main>
      <Rodape />
    </>
  );
}
