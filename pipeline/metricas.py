"""
Compara o índice de cada ata com a decisão da reunião seguinte → banco/metricas_previsao.json.

    .venv/Scripts/python.exe pipeline/metricas.py

Regra fixa (não ajustada para vencer a base): indice > 0,25 → aperto; < -0,25 → afrouxamento;
senão manutenção. Base ingênua: repete a decisão da reunião atual como previsão da próxima.
Usa banco/indice_modelo.json quando existir (fonte_indice = "modelo"), senão banco/indice.json.

Bloco `metodos` (ver DECISOES.md): ingenua, nivel_tom, variacao_tom e modelo_parceiro, cada um avaliado
num laço leave-one-out (deixa uma ata de fora, "ajusta" nas demais, prevê a de fora). Os três primeiros não
têm parâmetros ajustados aos dados (limiar 0,25 fixado a priori), então a acurácia LOO = acurácia simples;
o laço existe para que um método com parâmetros entre do mesmo jeito. `escolhido` = maior acuracia_loo;
desempate pela ordem ORDEM_METODOS (o mais simples vence).
"""
import json
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_INDICE = RAIZ / "banco" / "indice.json"
ARQ_INDICE_MODELO = RAIZ / "banco" / "indice_modelo.json"
ARQ_SAIDA = RAIZ / "banco" / "metricas_previsao.json"

LIMIAR = 0.25
ROTULOS = ["afrouxamento", "manutencao", "aperto"]
DECISAO = {"alta": "aperto", "corte": "afrouxamento", "manutencao": "manutencao"}
ORDEM_METODOS = ["ingenua", "variacao_tom", "nivel_tom", "arvore", "logistica", "floresta"]
MODELOS = ["arvore", "logistica", "floresta"]
ROTULO_METODO = {"ingenua": "Previsão ingênua (repete a última decisão)",
                 "nivel_tom": "Nível do índice de tom (±0,25)",
                 "variacao_tom": "Variação do índice de tom entre atas (±0,25)",
                 "arvore": "Árvore de decisão (profundidade 2) com tom, Focus e inflação",
                 "logistica": "Regressão logística multinomial com tom, Focus e inflação",
                 "floresta": "Floresta aleatória (300 árvores, profundidade 3) com tom, Focus e inflação"}
MAIS_DURO = {"afrouxamento": "manutencao", "manutencao": "aperto", "aperto": "aperto"}
MAIS_BRANDO = {"aperto": "manutencao", "manutencao": "afrouxamento", "afrouxamento": "afrouxamento"}
ARQ_METRICAS_MODELO = RAIZ / "banco" / "metricas_modelo.json"


def prever_metodo(nome: str, x: dict) -> str:
    """x = {"decisao": sinal da decisão atual, "indice", "indice_ant", "indice_modelo"}."""
    if nome == "ingenua":
        return x["decisao"]
    if nome == "nivel_tom":
        return prever(x["indice"])
    if nome == "modelo_parceiro":
        return prever(x.get("indice_modelo"))
    if nome == "variacao_tom":
        if x["indice"] is None or x["indice_ant"] is None:
            return x["decisao"]
        d = x["indice"] - x["indice_ant"]
        return MAIS_DURO[x["decisao"]] if d > LIMIAR else MAIS_BRANDO[x["decisao"]] if d < -LIMIAR else x["decisao"]
    raise ValueError(nome)


def ajustar(nome: str, treino: list[dict]):
    """Sem parâmetros ajustados aos dados nos métodos atuais: devolve a regra fixa. Ponto de entrada para um
    método com parâmetros (treina só com `treino`, nunca com a ata deixada de fora)."""
    return lambda x: prever_metodo(nome, x)


def avaliar_loo(nome: str, casos: list[dict]) -> dict:
    itens = []
    for k, c in enumerate(casos):
        modelo = ajustar(nome, casos[:k] + casos[k + 1:])
        p = modelo(c)
        itens.append({"ata": c["ata"], "data_reuniao": c["data_reuniao"], "previsto": p,
                      "realizado": c["realizado"], "acertou": p == c["realizado"]})
    r = avaliar(itens)
    return {"disponivel": True, "rotulo_pt": ROTULO_METODO[nome], "acuracia_loo": r["acuracia"],
            "acerto_sinal": r["acerto_sinal"], "n": len(itens), "n_previsoes_direcionais": r["n_previsoes_direcionais"],
            "matriz_confusao": r["matriz_confusao"], "atas": itens}


def prever(indice: float | None) -> str:
    if indice is None:
        return "manutencao"
    return "aperto" if indice > LIMIAR else "afrouxamento" if indice < -LIMIAR else "manutencao"


def avaliar(itens: list[dict]) -> dict:
    n = len(itens)
    matriz = [[0] * 3 for _ in range(3)]
    for it in itens:
        matriz[ROTULOS.index(it["previsto"])][ROTULOS.index(it["realizado"])] += 1
    direcionais = [it for it in itens if it["previsto"] != "manutencao"]
    return {"acuracia": round(sum(it["acertou"] for it in itens) / n, 3) if n else None,
            "acerto_sinal": round(sum(it["previsto"] == it["realizado"] for it in direcionais) / len(direcionais), 3)
            if direcionais else None,
            "n_previsoes_direcionais": len(direcionais),
            "matriz_confusao": {"rotulos": ROTULOS, "valores": matriz},
            "atas": itens}


def main() -> int:
    fonte = "simples"  # banco/indice_modelo.json agora é P(alta) − P(corte) do modelo, não um índice de tom
    indice = json.loads((ARQ_INDICE_MODELO if fonte == "modelo" else ARQ_INDICE).read_text(encoding="utf-8"))
    por_ata = {a["ata"]: a["indice"] for a in indice["atas"]}
    atas = sorted(json.loads(ARQ_ATAS.read_text(encoding="utf-8")), key=lambda a: a["numero"], reverse=True)

    it_ind, it_ing = [], []
    for a in atas:
        if a["numero"] not in por_ata or not a.get("proxima_decisao") or not a.get("decisao"):
            continue                                  # última ata (sem decisão seguinte) ou sem rótulos
        realizado = DECISAO[a["proxima_decisao"]]
        p = prever(por_ata[a["numero"]])
        it_ind.append({"ata": a["numero"], "data_reuniao": a["data_reuniao"], "indice": por_ata[a["numero"]],
                       "previsto": p, "realizado": realizado, "variacao_pp": a["proxima_decisao_pp"],
                       "acertou": p == realizado})
        q = DECISAO[a["decisao"]]
        it_ing.append({"ata": a["numero"], "data_reuniao": a["data_reuniao"], "previsto": q,
                       "realizado": realizado, "acertou": q == realizado})

    ind, ing = avaliar(it_ind), avaliar(it_ing)

    # Métodos comparados por leave-one-out (índice simples para nivel_tom/variacao_tom)
    simples = {a["ata"]: a["indice"] for a in json.loads(ARQ_INDICE.read_text(encoding="utf-8"))["atas"]}
    modelo_idx = ({a["ata"]: a.get("indice") for a in json.loads(ARQ_INDICE_MODELO.read_text(encoding="utf-8"))["atas"]}
                  if ARQ_INDICE_MODELO.exists() else None)
    numeros = sorted(simples)
    casos = []
    for a in sorted(atas, key=lambda a: a["numero"]):
        if a["numero"] not in simples or not a.get("proxima_decisao") or not a.get("decisao"):
            continue
        ant = [n for n in numeros if n < a["numero"]]
        casos.append({"ata": a["numero"], "data_reuniao": a["data_reuniao"], "decisao": DECISAO[a["decisao"]],
                      "indice": simples[a["numero"]], "indice_ant": simples[ant[-1]] if ant else None,
                      "indice_modelo": (modelo_idx or {}).get(a["numero"]),
                      "realizado": DECISAO[a["proxima_decisao"]]})
    casos.sort(key=lambda c: c["ata"], reverse=True)
    metodos = {nome: avaliar_loo(nome, casos) for nome in ORDEM_METODOS if nome not in MODELOS}
    # Validação no tempo (mesmo período dos modelos: 16ª ata em diante), ver modelo/treinar.py
    mm = json.loads(ARQ_METRICAS_MODELO.read_text(encoding="utf-8")) if ARQ_METRICAS_MODELO.exists() else {}
    vt = (mm.get("validacao_tempo") or {}).get("metodos") or {}
    loo = (mm.get("validacao_loo") or {}).get("metodos") or {}
    dec_por_ata = {a["numero"]: DECISAO[a["decisao"]] for a in atas if a.get("decisao")}
    periodo_tempo = None
    if vt.get("ingenua"):
        prevs = vt["ingenua"]["previsoes"]
        periodo_tempo = {"inicio_ata": prevs[0]["ata"], "fim_ata": prevs[-1]["ata"], "n": len(prevs)}
        for nome in ("ingenua", "variacao_tom", "nivel_tom"):
            acertos, vir_ok, vir_n = 0, 0, 0
            for pr in prevs:
                n = pr["ata"]
                ant = [k for k in numeros if k < n]
                x = {"decisao": dec_por_ata[n], "indice": simples.get(n),
                     "indice_ant": simples[ant[-1]] if ant else None}
                real = DECISAO[pr["realizado"]]
                ok = prever_metodo(nome, x) == real
                acertos += ok
                if real != x["decisao"]:
                    vir_n += 1; vir_ok += ok
            metodos[nome]["acuracia_tempo"] = round(acertos / len(prevs), 3)
            metodos[nome]["viradas_tempo"] = {"acertos": vir_ok, "total": vir_n}
            metodos[nome]["n_tempo"] = len(prevs)
    for nome in MODELOS:
        if nome not in vt:
            metodos[nome] = {"disponivel": False, "rotulo_pt": ROTULO_METODO[nome],
                             "motivo": "banco/metricas_modelo.json sem validacao_tempo"}
            continue
        metodos[nome] = {"disponivel": True, "rotulo_pt": ROTULO_METODO[nome],
                         "acuracia_loo": (loo.get(nome) or {}).get("acuracia"), "acerto_sinal": None,
                         "n": (mm.get("validacao_loo") or {}).get("n"),
                         "acuracia_tempo": vt[nome]["acuracia"],
                         "acuracia_balanceada_tempo": vt[nome]["acuracia_balanceada"],
                         "viradas_tempo": vt[nome]["viradas"], "n_tempo": len(vt[nome]["previsoes"]),
                         "fonte_acuracia": "banco/metricas_modelo.json"}
    disp = [n for n in ORDEM_METODOS if metodos[n].get("disponivel") and metodos[n].get("acuracia_tempo") is not None]
    if disp:
        escolhido = max(disp, key=lambda n: (metodos[n]["acuracia_tempo"], -ORDEM_METODOS.index(n)))
        criterio = "acuracia_tempo"
    else:
        disp = [n for n in ORDEM_METODOS if metodos[n].get("disponivel") and metodos[n].get("acuracia_loo") is not None]
        escolhido = max(disp, key=lambda n: (metodos[n]["acuracia_loo"], -ORDEM_METODOS.index(n)))
        criterio = "acuracia_loo"
    # Destaque honesto: empata com o escolhido no geral, mas acerta mais viradas
    destaque = None
    if criterio == "acuracia_tempo":
        e = metodos[escolhido]
        cand = [n for n in disp if n != escolhido and metodos[n]["acuracia_tempo"] == e["acuracia_tempo"]
                and metodos[n]["viradas_tempo"]["acertos"] > e["viradas_tempo"]["acertos"]]
        if cand:
            n = cand[0]
            destaque = {"metodo": n, "acuracia_tempo": metodos[n]["acuracia_tempo"],
                        "viradas": metodos[n]["viradas_tempo"], "escolhido": escolhido,
                        "viradas_escolhido": e["viradas_tempo"]}
    melhor = ("empate" if ind["acuracia"] == ing["acuracia"]
              else "indice" if (ind["acuracia"] or 0) > (ing["acuracia"] or 0) else "ingenua")
    datas = [i["data_reuniao"] for i in it_ind]
    corpo = {"regra": {"aperto": "indice > 0.25", "afrouxamento": "indice < -0.25",
                       "manutencao": "entre -0.25 e 0.25"},
             "fonte_indice": fonte, "n_atas": len(it_ind),
             "periodo": {"inicio": min(datas), "fim": max(datas)} if datas else None,
             "indice": ind, "ingenua": ing, "melhor": melhor,
             "validacao": "leave-one-out (uma ata de fora por vez); limiar 0,25 fixado antes de ver o resultado",
             "ordem_desempate": ORDEM_METODOS, "metodos": metodos, "escolhido": escolhido,
             "criterio_escolha": criterio, "validacao_tempo": periodo_tempo, "destaque_viradas": destaque}
    if ARQ_SAIDA.exists():
        antigo = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        antigo.pop("gerado_em", None)
        if antigo == corpo:
            print(f"Métricas sem mudanças (fonte {fonte}).")
            return 0
    saida = {"regra": corpo["regra"], "fonte_indice": fonte, "gerado_em": datetime.now().isoformat(timespec="seconds"),
             **{k: v for k, v in corpo.items() if k not in ("regra", "fonte_indice")}}
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"banco/metricas_previsao.json (fonte {fonte}, {len(it_ind)} atas): índice acurácia {ind['acuracia']} "
          f"sinal {ind['acerto_sinal']} | ingênua acurácia {ing['acuracia']} sinal {ing['acerto_sinal']} "
          f"| melhor: {melhor}")
    print("  tempo: " + "; ".join(f"{n} {metodos[n].get('acuracia_tempo')} vir {metodos[n].get('viradas_tempo')}" for n in ORDEM_METODOS)
          + f" | escolhido: {escolhido} ({criterio}) | destaque: {destaque}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
