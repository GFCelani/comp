import { dados } from "@/lib/dados";
import { dataCurta, dataHora } from "@/lib/formato";

export function Rodape() {
  const verificacao = dataHora(dados.ultima_verificacao);
  return (
    <footer className="border-t border-borda mt-16">
      <div className="mx-auto max-w-[1100px] px-4 py-8 text-sm text-texto-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p>
            Fonte: Banco Central do Brasil,{" "}
            <a
              href="https://www.bcb.gov.br/publicacoes/atascopom"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              atas do Copom
            </a>
            ; Selic meta (SGS 432) e Relatório Focus.
          </p>
          <p className="num">
            Dados de Selic até {dataCurta(dados.datas_dados.selic)}; Focus de {dataCurta(dados.datas_dados.focus)}; gerado em{" "}
            {dataCurta(dados.gerado_em.slice(0, 10))}.
          </p>
          <p className="num mt-2">
            {verificacao ? `Última verificação automática: ${verificacao}.` : "Verificação automática ainda não rodou."}{" "}
            O site se atualiza sozinho quando o Banco Central publica uma ata nova.
          </p>
        </div>
        <div className="sm:text-right">
          <p>
            <a
              href="https://github.com/GFCelani/comp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              código e dados no GitHub
            </a>
            {" · "}
            <a href="/painel" className="underline underline-offset-4">
              painel de verificação
            </a>
          </p>
          <p>Isto é interpretação de texto, não recomendação de investimento.</p>
        </div>
      </div>
    </footer>
  );
}
