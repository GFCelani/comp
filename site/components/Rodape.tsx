import Link from "next/link";
import { dados } from "@/lib/dados";
import { dataCurta, dataHora } from "@/lib/formato";
import { fraseUltimaVerificacao } from "@/lib/verificacao";

export async function Rodape() {
  const verificacao = await fraseUltimaVerificacao();
  const gerado = dataHora(dados.gerado_em);
  return (
    <footer className="mt-28 sm:mt-36 border-t border-tinta">
      <div className="envelope py-12 sm:py-16 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr] text-sm text-tinta-2">
        <div>
          <p className="titulo-serifa text-xl font-semibold text-tinta">Tradutor do Copom</p>
          <p className="mt-3 max-w-[44ch] leading-relaxed">
            Leitura das atas do Comitê de Política Monetária, parágrafo por parágrafo, sempre com o trecho exato que
            sustenta cada conclusão. O site se atualiza sozinho quando o Banco Central publica uma ata nova.
          </p>
          <p className="mt-5 text-tinta font-medium">Não é recomendação de investimento.</p>
          <p className="mt-1 max-w-[44ch]">É interpretação de texto público, com método e acertos abertos.</p>
        </div>
        <div>
          <p className="font-medium text-tinta">Fontes</p>
          <ul className="mt-3 grid gap-2">
            <li>
              <a href="https://www.bcb.gov.br/publicacoes/atascopom" target="_blank" rel="noopener noreferrer" className="link-tinta">
                Atas do Copom, Banco Central
              </a>
            </li>
            <li>Selic meta, série SGS 432 do BC</li>
            <li>Relatório Focus, mediana da Selic</li>
            <li>Calendário oficial do Copom</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-tinta">Datas dos dados</p>
          <dl className="mt-3 grid gap-2 num">
            <div className="flex justify-between gap-4">
              <dt>Selic até</dt>
              <dd className="text-tinta">{dataCurta(dados.datas_dados.selic)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Focus de</dt>
              <dd className="text-tinta">{dataCurta(dados.datas_dados.focus)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dados gerados em</dt>
              <dd className="text-tinta">{gerado ?? "aguardando"}</dd>
            </div>
          </dl>
          <p className="mt-4 leading-relaxed">{verificacao}</p>
        </div>
      </div>
      <div className="border-t border-linha">
        <div className="envelope py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-tinta-3">
          <a href="https://github.com/GFCelani/comp" target="_blank" rel="noopener noreferrer" className="link-tinta">
            código e dados no GitHub
          </a>
          <Link href="/painel" className="link-tinta">
            painel
          </Link>
        </div>
      </div>
    </footer>
  );
}
