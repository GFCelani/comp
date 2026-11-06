import type { DadosSite } from "@/lib/dados";
import { data, dataCurta, dataHora, indice as fmtIndice } from "@/lib/formato";
import { Aguardando, Cartao, Kpi, Pares } from "./Partes";
import css from "./painel.module.css";

export function SecaoDados({ dados }: { dados: DadosSite }) {
  const { resumo } = dados;
  const atas = [...dados.atas].sort((a, b) => b.numero - a.numero);
  const invalidos = resumo.n_trechos_invalidos;
  const comNota = dados.atas.reduce((s, a) => s + a.n_nao_zero, 0);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Kpi rotulo="atas" valor={resumo.n_atas} contexto={`${data(resumo.periodo.inicio)} a ${data(resumo.periodo.fim)}`} />
        <Kpi rotulo="parágrafos" valor={resumo.n_paragrafos.toLocaleString("pt-BR")} contexto={`${comNota.toLocaleString("pt-BR")} com nota diferente de zero`} />
        <div className="col-span-2 sm:col-span-1">
          <Kpi
            rotulo="trechos inválidos"
            valor={invalidos}
            contexto={
              invalidos > 0 ? (
                <span className="selo selo-alerta">citação que não é cópia exata da ata</span>
              ) : (
                <span className="selo selo-ok">todas as citações conferem</span>
              )
            }
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Cartao
          titulo="Atas no banco"
          descricao="Da mais recente à mais antiga. Parágrafos com nota diferente de zero entram no índice."
        >
          <div className="relative -mx-5 max-h-[560px] overflow-auto sm:-mx-6">
            <table className={`tabela num ${css.compacta}`}>
              <thead className="sticky top-0 z-10 bg-papel">
                <tr>
                  <th scope="col">
                    ata
                  </th>
                  <th scope="col">reunião</th>
                  <th scope="col" className="direita">
                    índice
                  </th>
                  <th scope="col" className="direita">
                    parágrafos
                  </th>
                  <th scope="col" className="direita">
                    nota ≠ 0
                  </th>
                  <th scope="col">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {atas.map((a) => (
                  <tr key={a.numero} className="hover:bg-papel-2">
                    <td className="font-medium">{a.numero}ª</td>
                    <td className="whitespace-nowrap text-tinta-2">{dataCurta(a.data_reuniao)}</td>
                    <td className="direita">{a.indice === null ? <Aguardando /> : fmtIndice(a.indice)}</td>
                    <td className="direita">{a.n_paragrafos}</td>
                    <td className="direita">{a.n_nao_zero}</td>
                    <td>
                      <a href={a.url_pdf} target="_blank" rel="noopener noreferrer" className="link text-[13px]">
                        abrir<span className="sr-only"> o PDF da {a.numero}ª ata</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        <div className="grid content-start gap-6">
          <Cartao titulo="Geração">
            <Pares
              itens={[
                { rotulo: "período", valor: `${dataCurta(resumo.periodo.inicio)} a ${dataCurta(resumo.periodo.fim)}` },
                { rotulo: "dados gerados em", valor: dataHora(dados.gerado_em) ?? <Aguardando /> },
                { rotulo: "última verificação", valor: dataHora(dados.ultima_verificacao) ?? <Aguardando /> },
                { rotulo: "fonte do índice", valor: dados.fonte_indice === "modelo" ? "modelo de notas" : "simples (média sem zeros)" },
              ]}
            />
          </Cartao>
          <Cartao titulo="Datas das fontes">
            <Pares
              itens={[
                { rotulo: "Selic (BC)", valor: dados.datas_dados?.selic ? dataCurta(dados.datas_dados.selic) : <Aguardando /> },
                { rotulo: "Focus (BC)", valor: dados.datas_dados?.focus ? dataCurta(dados.datas_dados.focus) : <Aguardando /> },
              ]}
            />
          </Cartao>
        </div>
      </div>
    </div>
  );
}
