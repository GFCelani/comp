import Link from "next/link";
import { dados } from "@/lib/dados";
import { dataCurta } from "@/lib/formato";
import { fraseUltimaVerificacao } from "@/lib/verificacao";

export async function Rodape() {
  const verificacao = await fraseUltimaVerificacao();
  return (
    <footer className="mt-20 bg-fundo-2 border-t border-borda">
      <div className="mx-auto max-w-[1180px] px-4 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr] text-sm text-texto-2">
        <div>
          <p className="font-semibold text-texto">Tradutor do Copom</p>
          <p className="mt-2 max-w-[48ch]">
            Leitura automática das atas do Comitê de Política Monetária, parágrafo por parágrafo, sempre com o trecho
            exato que sustenta cada conclusão.
          </p>
          <p className="mt-3 num">
            {verificacao}{" "}
            O site se atualiza sozinho quando o Banco Central publica uma ata nova.
          </p>
        </div>
        <div>
          <p className="etiqueta etiqueta-sem-ponto mb-3">fonte dos dados</p>
          <p>
            Banco Central do Brasil,{" "}
            <a href="https://www.bcb.gov.br/publicacoes/atascopom" target="_blank" rel="noopener noreferrer" className="link">
              atas do Copom
            </a>
            ; Selic meta (SGS 432) e Relatório Focus.
          </p>
          <p className="num mt-2">
            Selic até {dataCurta(dados.datas_dados.selic)} · Focus de {dataCurta(dados.datas_dados.focus)} · gerado em{" "}
            {dataCurta(dados.gerado_em.slice(0, 10))}
          </p>
        </div>
        <div>
          <p className="etiqueta etiqueta-sem-ponto mb-3">mais</p>
          <ul className="space-y-1">
            <li>
              <Link href="/painel" className="link">
                painel de verificação
              </Link>
            </li>
            <li>
              <a href="https://github.com/GFCelani/comp" target="_blank" rel="noopener noreferrer" className="link">
                código e dados no GitHub
              </a>
            </li>
          </ul>
          <p className="mt-4 text-texto-3">Isto é interpretação de texto, não recomendação de investimento.</p>
        </div>
      </div>
    </footer>
  );
}
