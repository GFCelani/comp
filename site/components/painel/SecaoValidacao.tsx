import type { ConferenciaSelic, DadosSite } from "@/lib/dados";
import { dataHora, pct } from "@/lib/formato";
import { BlocoAguardando, Cartao, Kpi } from "./Partes";

const nota = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ConferenciaSelicCartao({ cs, resumida }: { cs: ConferenciaSelic | null | undefined; resumida?: boolean }) {
  if (!cs) {
    return (
      <Cartao titulo="Conferência da Selic">
        <BlocoAguardando texto="A conferência da Selic de cada reunião com o histórico oficial do Banco Central ainda não rodou." />
      </Cartao>
    );
  }
  const n = cs.divergencias.length;
  const colunas = Array.from(new Set(cs.divergencias.flatMap((d) => Object.keys(d))));
  return (
    <Cartao
      titulo="Conferência da Selic"
      descricao={
        <>
          Selic de cada reunião contra{" "}
          <a href={cs.fonte_url} target="_blank" rel="noopener noreferrer" className="link">
            o histórico de taxas do BC
          </a>
          .
        </>
      }
      acao={
        n === 0 ? (
          <span className="selo selo-ok">sem divergências</span>
        ) : (
          <span className="selo selo-erro">
            {n} {n === 1 ? "divergência" : "divergências"}
          </span>
        )
      }
    >
      <p className="num text-sm text-tinta-2">
        <span className="font-semibold text-tinta">{cs.n_comparadas}</span> reuniões comparadas · conferido em{" "}
        {dataHora(cs.verificado_em) ?? <span className="aguardando">aguardando</span>}
      </p>
      {n > 0 && !resumida && (
        <div className="relative mt-4 overflow-x-auto">
          <table className="tabela num">
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c} scope="col">
                    {c.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cs.divergencias.map((d, i) => (
                <tr key={i}>
                  {colunas.map((c) => (
                    <td key={c} className="break-words">
                      {valorLegivel(d[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

export function SecaoValidacao({ dados }: { dados: DadosSite }) {
  const vh = dados.validacao_humana;
  return (
    <div className={`grid gap-6 ${vh ? "" : "lg:grid-cols-2 lg:items-start"}`}>
      {!vh ? (
        <Cartao
          titulo="Validação humana das notas"
          descricao="O time rotula à mão 20 parágrafos e compara com a nota que o Claude deu a cada um."
        >
          <BlocoAguardando texto="O time ainda está rotulando os 20 parágrafos. Quando o arquivo de validação chegar, aparecem aqui a concordância exata, a concordância dentro de 1 ponto e a tabela item a item." />
        </Cartao>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi rotulo="parágrafos rotulados" valor={vh.n} contexto="pelo time, sem ver a nota do Claude" />
            <Kpi rotulo="concordância exata" valor={pct(vh.concordancia_exata)} contexto="mesma nota do Claude" />
            <Kpi rotulo="concordância ±1" valor={pct(vh.concordancia_1ponto)} contexto="diferença de até 1 ponto" />
          </div>
          <Cartao titulo="Item a item">
            {vh.itens && vh.itens.length > 0 ? (
              <div className="relative max-h-[420px] overflow-auto">
                <table className="tabela num">
                  <thead className="sticky top-0 bg-papel">
                    <tr>
                      <th scope="col">ata</th>
                      <th scope="col">parágrafo</th>
                      <th scope="col" className="direita">
                        nota humana
                      </th>
                      <th scope="col" className="direita">
                        nota do Claude
                      </th>
                      <th scope="col">resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vh.itens.map((it) => {
                      const dif = Math.abs(it.nota_humana - it.nota_claude);
                      return (
                        <tr key={`${it.ata}.${it.paragrafo}`}>
                          <td>{it.ata}ª</td>
                          <td>§ {it.paragrafo}</td>
                          <td className="direita">{nota(it.nota_humana)}</td>
                          <td className="direita">{nota(it.nota_claude)}</td>
                          <td>
                            {dif === 0 ? (
                              <span className="selo selo-ok">igual</span>
                            ) : dif === 1 ? (
                              <span className="selo">±1</span>
                            ) : (
                              <span className="selo selo-erro">diferente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <BlocoAguardando texto="O arquivo de validação ainda não trouxe a lista de itens." />
            )}
          </Cartao>
        </>
      )}
      <ConferenciaSelicCartao cs={dados.conferencia_selic} />
    </div>
  );
}
