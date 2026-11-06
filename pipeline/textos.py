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
Plano B sem LLM (Claude indisponível, com erro ou reprovado): mudanças escolhidas por código a partir do
diff e das notas de tom, trecho = primeira oração do parágrafo, explicação e impacto por modelo de texto
fixo com números dos dados. Campo `origem` ("claude" | "automatico") nas mudanças e no impacto.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import claude_cli  # noqa: E402
import modelo_base  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
ARQ_DIFF = RAIZ / "saida" / "diff_ultimas.json"
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_INDICE = RAIZ / "banco" / "indice.json"
ARQ_INDICE_MODELO = RAIZ / "banco" / "indice_modelo.json"
ARQ_FOCUS = RAIZ / "data" / "case1_focus" / "focus_anuais.csv"
ARQ_SGS = RAIZ / "data" / "case1_focus" / "sgs_realizado.csv"
ARQ_SAIDA = RAIZ / "saida" / "textos.json"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
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


def br(x: float, casas: int = 2) -> str:
    return f"{x:.{casas}f}".replace(".", ",")


def notas_de(ata: int) -> dict[int, int]:
    out = {}
    if ARQ_ROTULOS.exists():
        with ARQ_ROTULOS.open(encoding="utf-8") as f:
            for l in f:
                if l.strip():
                    r = json.loads(l)
                    if r["ata"] == ata:
                        out[r["paragrafo"]] = r["nota"]          # última linha vence
    return out


def mudancas_automaticas(diff: dict, atual: int, anterior: int, par_atual: dict, par_anterior: dict) -> list[dict]:
    """As 3 mudanças com maior |nota| (novos/removidos) ou maior variação de nota (alterados), por código."""
    na, nb = notas_de(atual), notas_de(anterior)
    cand = []
    for x in diff["novos"]:
        n, v = x["paragrafo"], na.get(x["paragrafo"], 0)
        if v and n in par_atual:
            cand.append((abs(v), abs(v), {"paragrafo": n, "tipo": "novo", "efeito": "endureceu" if v > 0 else "suavizou",
                         "trecho": modelo_base.primeira_oracao(par_atual[n]),
                         "explicacao": f"Parágrafo novo na ata {atual}, com nota {v:+d} na régua de tom de -2 a +2. "
                                       f"Por isso, ele deixa a comunicação do Copom mais "
                                       f"{'dura' if v > 0 else 'branda'}."}))
    for x in diff["alterados"]:
        n, m = x["paragrafo_atual"], x["paragrafo_anterior"]
        v, w = na.get(n, 0), nb.get(m, 0)
        if v != w and n in par_atual:
            cand.append((abs(v - w), abs(v), {"paragrafo": n, "tipo": "alterado",
                         "efeito": "endureceu" if v > w else "suavizou",
                         "trecho": modelo_base.primeira_oracao(par_atual[n]),
                         "explicacao": f"O parágrafo foi reescrito e a nota de tom passou de {w:+d} na ata {anterior} "
                                       f"para {v:+d} na ata {atual}. Por isso, a comunicação do Copom ficou mais "
                                       f"{'dura' if v > w else 'branda'} neste ponto."}))
    for x in diff["removidos"]:
        n, w = x["paragrafo"], nb.get(x["paragrafo"], 0)
        if w and n in par_anterior:
            cand.append((abs(w), abs(w), {"paragrafo": n, "tipo": "removido", "efeito": "suavizou" if w > 0 else "endureceu",
                         "trecho": modelo_base.primeira_oracao(par_anterior[n]),
                         "explicacao": f"Este parágrafo da ata {anterior}, com nota {w:+d}, saiu da ata {atual}. "
                                       f"Sem ele, a comunicação do Copom fica mais {'branda' if w > 0 else 'dura'}."}))
    cand.sort(key=lambda c: (c[0], c[1]), reverse=True)
    return [c[2] for c in cand[:3]]


def impacto_automatico(atual: int, anterior: int) -> str:
    arq = ARQ_INDICE_MODELO if ARQ_INDICE_MODELO.exists() else ARQ_INDICE
    por = {a["ata"]: a.get("indice") for a in json.loads(arq.read_text(encoding="utf-8"))["atas"]}
    ata = {a["numero"]: a for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))}.get(atual, {})
    i, i0 = por.get(atual), por.get(anterior)
    frases = []
    d = None
    if i is not None and i0 is not None:
        d = round(i - i0, 2)
        frases.append(f"O índice de tom da ata {atual} ficou em {br(i)}, contra {br(i0)} na ata {anterior}, "
                      f"uma variação de {'+' if d >= 0 else '-'}{br(abs(d))} na escala de -2 a +2.")
    elif i is not None:
        frases.append(f"O índice de tom da ata {atual} ficou em {br(i)} na escala de -2 a +2.")
    pp, selic, dec = ata.get("decisao_pp"), ata.get("selic_apos"), ata.get("decisao")
    if dec and selic is not None:
        acao = {"alta": f"subir a Selic em {br(abs(pp or 0))} ponto percentual",
                "corte": f"cortar a Selic em {br(abs(pp or 0))} ponto percentual",
                "manutencao": "manter a Selic"}[dec]
        frases.append(f"Na reunião, o Copom decidiu {acao}, e a meta passou a {br(selic)}% ao ano.")
    if d is not None and d > 0.1:
        frases.append("Se esse tom mais duro se mantiver, os juros futuros tendem a ficar mais altos e a próxima "
                      "decisão pode manter a Selic por mais tempo ou interromper cortes.")
    elif d is not None and d < -0.1:
        frases.append("Se esse tom mais brando se mantiver, os juros futuros tendem a recuar e a próxima decisão "
                      "pode trazer novo corte da Selic.")
    else:
        frases.append("Com o tom pouco alterado, a próxima decisão tende a seguir a linha desta reunião, "
                      "salvo surpresa nos dados de inflação e de atividade.")
    return " ".join(frases)


def via_claude(diff: dict, atual: int, anterior: int, par_atual: dict, par_anterior: dict, mercado: str):
    """Devolve (mudanças válidas, impacto válido ou None, erros, reescritas)."""
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
    return validas, impacto, erros, reescritas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--sem-claude", action="store_true", help="gera só a versão automática")
    args = ap.parse_args()

    diff = json.loads(ARQ_DIFF.read_text(encoding="utf-8"))
    atual, anterior = diff["ata_atual"], diff["ata_anterior"]
    if ARQ_SAIDA.exists() and not args.forcar:
        velho = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        if velho.get("ata_atual") == atual and velho.get("ata_anterior") == anterior:
            print(f"Textos já gerados para a ata {atual}; não chama o Claude.")
            return 0

    par_atual, par_anterior = paragrafos_de(atual), paragrafos_de(anterior)
    try:
        mercado, data_selic, data_focus = dados_mercado()
    except Exception as e:
        print(f"  aviso: sem dados de mercado ({e})")
        mercado, data_selic, data_focus = "(indisponível)", None, None

    validas, impacto, erros, reescritas = [], None, [], 0
    if args.sem_claude or not claude_cli.disponivel():
        erros = ["Claude indisponível (sem CLAUDE_CODE_OAUTH_TOKEN)"]
        print("Sem Claude: textos automáticos (plano B).")
    else:
        try:
            validas, impacto, erros, reescritas = via_claude(diff, atual, anterior, par_atual, par_anterior, mercado)
        except Exception as e:
            erros = [f"Claude falhou: {e}"]
            print(f"Claude falhou ({e}); textos automáticos (plano B).")
    if erros:
        print(f"Descartados após {reescritas} reescritas: {erros}")

    origem = "claude"
    if not validas:
        validas, origem = mudancas_automaticas(diff, atual, anterior, par_atual, par_anterior), "automatico"
    origem_impacto = "claude"
    if not impacto:
        impacto, origem_impacto = impacto_automatico(atual, anterior), "automatico"

    if origem == origem_impacto == "automatico" and ARQ_SAIDA.exists():
        velho = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        chave = (velho.get("ata_atual"), velho.get("ata_anterior"), velho.get("mudancas"),
                 (velho.get("impacto") or {}).get("texto"))
        if chave == (atual, anterior, validas, impacto):
            print("Textos automáticos iguais aos já gravados; nada muda.")
            return 0
    saida = {"ata_atual": atual, "ata_anterior": anterior,
             "gerado_em": datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds"),
             "origem": origem, "mudancas": validas,
             "impacto": {"texto": impacto, "data_selic": data_selic, "data_focus": data_focus, "origem": origem_impacto},
             "verificacao": {"reescritas": reescritas, "descartados": erros, "chamadas_claude": claude_cli.CHAMADAS}}
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"saida/textos.json: {len(validas)} mudanças ({origem}), impacto {origem_impacto}, {reescritas} reescritas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
