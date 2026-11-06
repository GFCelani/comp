"""
Gera as 3 principais mudanças da última ata e o impacto provável → saida/textos.json.

    .venv/Scripts/python.exe pipeline/textos.py            # só se a última ata mudou
    .venv/Scripts/python.exe pipeline/textos.py --forcar

Uma chamada `claude -p --model sonnet` com saida/diff_ultimas.json, o índice das 2 últimas atas
e Selic/Focus com datas. Verificação por código:
  - o trecho (≤25 palavras) existe literalmente no parágrafo da ata certa
    (ata atual para "novo"/"alterado", ata anterior para "removido");
  - todo número da explicação e do impacto existe entre os números fornecidos no prompt.
Até 2 reescritas; o que ainda falhar é descartado.
"""
import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import claude_cli  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
ARQ_DIFF = RAIZ / "saida" / "diff_ultimas.json"
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_INDICE = RAIZ / "banco" / "indice.json"
ARQ_INDICE_MODELO = RAIZ / "banco" / "indice_modelo.json"
ARQ_FOCUS = RAIZ / "data" / "case1_focus" / "focus_anuais.csv"
ARQ_SGS = RAIZ / "data" / "case1_focus" / "sgs_realizado.csv"
ARQ_SAIDA = RAIZ / "saida" / "textos.json"
MAX_REESCRITAS = 2

PROMPT = """Você explica atas do Copom (Banco Central do Brasil) para quem não é economista.
Compare a ata {atual} com a ata {anterior} usando SOMENTE os dados abaixo.

## Índice de tom (−2 muito brando … +2 muito duro; média das notas dos parágrafos, ignorando neutros)
{indices}

## Dados de mercado (com a data de cada um)
{mercado}

## Parágrafos novos na ata {atual}
{novos}

## Parágrafos removidos (existiam na ata {anterior})
{removidos}

## Parágrafos alterados (texto completo na ata {atual}, depois o diff: ~~removido~~ **adicionado**)
{alterados}

## Tarefa
1. Escolha as 3 mudanças mais importantes para a política de juros. Para cada uma:
   - "paragrafo": número do parágrafo (na ata {atual} para novo/alterado; na ata {anterior} para removido);
   - "trecho": cópia LITERAL e contínua de até 25 palavras desse parágrafo (sem ~~ ou **, sem reticências);
   - "efeito": "endureceu" ou "suavizou" (o tom da comunicação ficou mais duro ou mais brando);
   - "explicacao": exatamente 2 frases simples, para leigos;
   - "tipo": "novo", "alterado" ou "removido".
2. "impacto": 2 ou 3 frases em linguagem condicional ("pode", "tende a", "se ... então") sobre o efeito
   provável na Selic, nos juros futuros, no câmbio ou na inflação esperada.
Regras: não use nenhum número que não esteja nos dados acima (não invente percentuais, datas ou valores).
Escreva números no padrão brasileiro, com vírgula decimal (ex.: 13,75%). O "tipo" deve corresponder à
seção de onde o parágrafo veio (novos, removidos ou alterados).
Não faça recomendação de investimento.

Responda APENAS com um JSON:
{{"mudancas": [{{"paragrafo": 0, "trecho": "", "efeito": "", "explicacao": "", "tipo": ""}}], "impacto": ""}}"""

PROMPT_REESCRITA = """Sua resposta anterior teve problemas verificados por código:
{erros}

Corrija só o que falhou, mantendo as regras: trecho = cópia literal e contínua de até 25 palavras do
parágrafo indicado; nenhum número que não esteja nos dados fornecidos. Responda APENAS com o JSON completo
no mesmo formato: {{"mudancas": [...], "impacto": "..."}}

Sua resposta anterior:
{anterior}"""

RE_NUM = re.compile(r"\d+(?:[.,]\d+)*")


def numeros(texto: str) -> set[float]:
    saida = set()
    for m in RE_NUM.findall(texto):
        s = m
        if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", s):        # milhar com ponto
            s = s.replace(".", "")
        s = s.replace(",", ".")
        if s.count(".") > 1:
            continue
        try:
            saida.add(round(float(s), 4))
        except ValueError:
            pass
    return saida


def paragrafos_de(ata: int) -> dict[int, str]:
    out = {}
    with ARQ_PARAGRAFOS.open(encoding="utf-8") as f:
        for l in f:
            if l.strip():
                p = json.loads(l)
                if p["ata"] == ata:
                    out[p["paragrafo"]] = p["texto"]
    return out


def dados_mercado() -> tuple[str, str, str]:
    """Texto com Selic/Focus/câmbio/IPCA e datas; devolve (texto, data_selic, data_focus)."""
    sgs = pd.read_csv(ARQ_SGS)
    linhas = []
    sel = sgs[sgs["serie"] == "selic_meta"].sort_values("data").iloc[-1]
    data_selic = str(sel["data"])
    linhas.append(f"- Selic meta em {data_selic}: {sel['valor']:.2f}% ao ano")
    ipca = sgs[sgs["serie"] == "ipca_12m"].sort_values("data").iloc[-1]
    linhas.append(f"- IPCA acumulado em 12 meses (mês {str(ipca['data'])[:7]}): {ipca['valor']:.2f}%")
    dol = sgs[sgs["serie"] == "dolar_ptax_venda"].sort_values("data").iloc[-1]
    linhas.append(f"- Dólar PTAX venda em {dol['data']}: R$ {dol['valor']:.2f}")

    focus = pd.read_csv(ARQ_FOCUS)
    focus = focus[focus["baseCalculo"] == 0]
    data_focus = str(focus["Data"].max())
    ult = focus[focus["Data"] == data_focus]
    ano = int(data_focus[:4])
    nomes = {"Selic": "Selic no fim do ano (% a.a.)", "IPCA": "IPCA no ano (%)", "Câmbio": "Dólar no fim do ano (R$)"}
    for ind, nome in nomes.items():
        for ref in (ano, ano + 1):
            sub = ult[(ult["Indicador"] == ind) & (ult["DataReferencia"].astype(str) == str(ref))]
            if len(sub):
                linhas.append(f"- Focus {data_focus}, mediana {nome}, {ref}: {float(sub['Mediana'].iloc[0]):.2f}")
    return "\n".join(linhas), data_selic, data_focus


def indices(atual: int, anterior: int) -> str:
    arq = ARQ_INDICE_MODELO if ARQ_INDICE_MODELO.exists() else ARQ_INDICE
    por = {a["ata"]: a for a in json.loads(arq.read_text(encoding="utf-8"))["atas"]}
    atas = {a["numero"]: a for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))}
    out = []
    for n in (anterior, atual):
        i, a = por.get(n, {}), atas.get(n, {})
        out.append(f"- Ata {n} (reunião {a.get('data_reuniao')}): índice {i.get('indice')}; decisão: "
                   f"{a.get('decisao')} de {a.get('decisao_pp')} p.p., Selic após a reunião {a.get('selic_apos')}%")
    return "\n".join(out)


def verificar(resp: dict, par_atual: dict, par_anterior: dict, permitidos: set[float],
              ignorar: set[float], tipos: dict) -> tuple[list[dict], str | None, list[str]]:
    """Devolve (mudanças válidas, impacto válido ou None, lista de erros)."""
    erros, validas = [], []

    def nums_ruins(txt: str) -> list[str]:
        return [str(x) for x in numeros(txt) if x not in permitidos and x not in ignorar]

    for i, m in enumerate((resp.get("mudancas") or [])[:3]):
        tipo = m.get("tipo")
        try:
            n = int(m.get("paragrafo"))
        except (TypeError, ValueError):
            n = -1
        fonte = par_anterior if tipo == "removido" else par_atual
        prob = []
        if tipo not in ("novo", "alterado", "removido"):
            prob.append(f"tipo inválido {tipo!r}")
        if m.get("efeito") not in ("endureceu", "suavizou"):
            prob.append(f"efeito inválido {m.get('efeito')!r}")
        if tipo in tipos and n not in tipos[tipo]:
            prob.append(f"parágrafo {n} não está entre os {tipo}s do diff")
        if n not in fonte:
            prob.append(f"parágrafo {n} não existe na ata certa")
        elif not claude_cli.trecho_ok(m.get("trecho", ""), fonte[n]):
            prob.append("trecho não é cópia literal de até 25 palavras do parágrafo")
        ruins = nums_ruins(m.get("explicacao", ""))
        if ruins:
            prob.append(f"números fora dos dados na explicação: {ruins}")
        if prob:
            erros.append(f"mudança {i + 1} (parágrafo {n}): " + "; ".join(prob))
        else:
            validas.append({"paragrafo": n, "trecho": claude_cli.normalizar(m["trecho"]), "efeito": m["efeito"],
                            "explicacao": m["explicacao"].strip(), "tipo": tipo})
    impacto = (resp.get("impacto") or "").strip()
    ruins = nums_ruins(impacto)
    if not impacto:
        erros.append("impacto vazio")
        impacto = None
    elif ruins:
        erros.append(f"números fora dos dados no impacto: {ruins}")
        impacto = None
    return validas, impacto, erros


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forcar", action="store_true")
    args = ap.parse_args()

    diff = json.loads(ARQ_DIFF.read_text(encoding="utf-8"))
    atual, anterior = diff["ata_atual"], diff["ata_anterior"]
    if ARQ_SAIDA.exists() and not args.forcar:
        velho = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        if velho.get("ata_atual") == atual and velho.get("ata_anterior") == anterior:
            print(f"Textos já gerados para a ata {atual}; não chama o Claude.")
            return 0

    if not claude_cli.disponivel():
        print(f"Sem Claude (falta CLAUDE_CODE_OAUTH_TOKEN): textos da ata {atual} ficam pendentes "
              "(textos_pendentes: true em dados_site.json).")
        return 0

    par_atual, par_anterior = paragrafos_de(atual), paragrafos_de(anterior)
    mercado, data_selic, data_focus = dados_mercado()
    fmt = lambda xs: "\n\n".join(f"[{x['paragrafo']}] {x['texto']}" for x in xs) or "(nenhum)"
    alterados = "\n\n".join(f"[{x['paragrafo_atual']}] {par_atual.get(x['paragrafo_atual'], '')}\nDIFF: {x['diff']}"
                            for x in diff["alterados"]) or "(nenhum)"
    prompt = PROMPT.format(atual=atual, anterior=anterior, indices=indices(atual, anterior), mercado=mercado,
                           novos=fmt(diff["novos"]), removidos=fmt(diff["removidos"]), alterados=alterados)
    permitidos = numeros(prompt)
    permitidos |= {abs(x) for x in permitidos}
    ignorar = {float(a) for a in range(2000, 2041)} | {float(atual), float(anterior)}
    ignorar |= {float(n) for n in par_atual} | {float(n) for n in par_anterior}

    tipos = {"novo": {x["paragrafo"] for x in diff["novos"]},
             "removido": {x["paragrafo"] for x in diff["removidos"]},
             "alterado": {x["paragrafo_atual"] for x in diff["alterados"]}}
    texto = claude_cli.chamar(prompt)
    reescritas = 0
    while True:
        try:
            resp = claude_cli.extrair_json(texto)
            validas, impacto, erros = verificar(resp, par_atual, par_anterior, permitidos, ignorar, tipos)
        except Exception as e:
            resp, validas, impacto, erros = {}, [], None, [f"JSON inválido: {e}"]
        if not erros or reescritas >= MAX_REESCRITAS:
            break
        reescritas += 1
        print(f"Reescrita {reescritas}: {erros}", flush=True)
        texto = claude_cli.chamar(prompt + "\n\n" + PROMPT_REESCRITA.format(erros="\n".join(f"- {e}" for e in erros),
                                                                              anterior=texto))
    if erros:
        print(f"Descartados após {reescritas} reescritas: {erros}")

    saida = {"ata_atual": atual, "ata_anterior": anterior, "gerado_em": datetime.now().isoformat(timespec="seconds"),
             "mudancas": validas,
             "impacto": {"texto": impacto, "data_selic": data_selic, "data_focus": data_focus} if impacto else None,
             "verificacao": {"reescritas": reescritas, "descartados": erros, "chamadas_claude": claude_cli.CHAMADAS}}
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"saida/textos.json: {len(validas)} mudanças, impacto {'ok' if impacto else 'descartado'}, "
          f"{reescritas} reescritas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
