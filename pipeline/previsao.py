"""
Previsão para a próxima reunião do Copom ainda não realizada → banco/previsao.json.

    .venv/Scripts/python.exe pipeline/previsao.py

- Calendário oficial do BC: https://www.bcb.gov.br/api/servico/sitebcb/calendario/anual
  (lista "Reuniões do Copom", a mesma que alimenta o "Calendário do Copom" em
  https://www.bcb.gov.br/controleinflacao/copom). Cada reunião tem 2 dias; a data da decisão é o 2º.
- Última decisão conhecida: https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros
  (tabela oficial de decisões), conferida com a série SGS 432. Pode ser de uma reunião cuja ata ainda
  não saiu (`ata_publicada: false`).
- Sinal: índice de tom da última ata com índice (banco/indice_modelo.json se existir, senão
  banco/indice.json). Regra fixa: aperto se índice > 0,25; afrouxamento se < −0,25; senão manutenção.
- `previsto` = previsão do MÉTODO ESCOLHIDO em banco/metricas_previsao.json (maior acurácia leave-one-out entre
  ingenua, nivel_tom, variacao_tom e modelo_parceiro; ver DECISOES.md). `previsto_nivel_tom` guarda a regra de nível.
- Acerto histórico do sinal e da previsão ingênua (repetir a última decisão): banco/metricas_previsao.json.
- Focus: mediana da Selic no fim do ano da próxima reunião, na data de coleta mais recente.
Sem calendário (BC fora do ar e nenhuma data futura já gravada), `proxima_reuniao.data` fica null e
`fonte` = "indisponível". Nunca inventa datas. Só regrava o arquivo se o conteúdo (fora gerado_em) mudar.
"""
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

RAIZ = Path(__file__).resolve().parents[1]
B = RAIZ / "banco"
ARQ_SAIDA = B / "previsao.json"
ARQ_FOCUS = RAIZ / "data" / "case1_focus" / "focus_anuais.csv"
ARQ_SGS = RAIZ / "data" / "case1_focus" / "sgs_realizado.csv"
URL_CAL = "https://www.bcb.gov.br/api/servico/sitebcb/calendario/anual"
URL_HIST = "https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros"
FONTE_CAL = "BCB, calendário oficial do Copom (bcb.gov.br/controleinflacao/copom)"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
LIMIAR = 0.25
PARA_SINAL = {"alta": "aperto", "corte": "afrouxamento", "manutencao": "manutencao"}


def ler(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def baixar(url: str, params: dict | None = None):
    erro = None
    for t in range(3):
        try:
            r = requests.get(url, params=params, headers={"User-Agent": UA, "accept": "application/json"}, timeout=60)
            r.raise_for_status()
            return r.json()["conteudo"]
        except Exception as e:
            erro = e
            time.sleep(2 * (t + 1))
    raise RuntimeError(f"{url}: {erro}")


def dia(s: str) -> date:
    # "2026-11-04T03:00:00Z" = meia-noite de Brasília em UTC
    return (datetime.fromisoformat(s.replace("Z", "+00:00")) - timedelta(hours=3)).date()


def calendario(hoje: date) -> list[date]:
    """Datas de decisão (2º dia de cada reunião) do ano anterior até 2 anos à frente."""
    itens = baixar(URL_CAL, {"inicioAgenda": f"'{hoje.year - 1}-01-01'", "fimAgenda": f"'{hoje.year + 2}-12-31'",
                             "lista": "Reuniões do Copom"})
    dias = sorted({dia(e["dataEvento"]) for e in itens if "copom" in (e.get("evento") or "").lower()})
    decisoes = []
    for d in dias:                       # dias consecutivos = mesma reunião; fica o último
        if decisoes and (d - decisoes[-1]).days <= 2:
            decisoes[-1] = d
        else:
            decisoes.append(d)
    return decisoes


def historico() -> list[dict]:
    itens = baixar(URL_HIST)
    out = [{"numero": int(i["NumeroReuniaoCopom"]), "data": dia(i["DataReuniaoCopom"]), "selic": float(i["MetaSelic"]),
            "extra": bool(i.get("ReuniaoExtraordinaria"))} for i in itens if i.get("MetaSelic") is not None]
    return sorted(out, key=lambda x: (x["data"], x["numero"]))


def selic_sgs(d: date) -> float | None:
    if not ARQ_SGS.exists():
        return None
    sgs = pd.read_csv(ARQ_SGS)
    s = sgs[(sgs["serie"] == "selic_meta") & (sgs["data"] > d.isoformat())].sort_values("data")
    return float(s["valor"].iloc[0]) if len(s) else None


def classificar(pp: float) -> str:
    return "alta" if pp > 0 else "corte" if pp < 0 else "manutencao"


def main() -> int:
    hoje = datetime.now(timezone(timedelta(hours=-3))).date()
    atas = sorted(ler(B / "atas.json"), key=lambda a: a["numero"])
    ult_ata = atas[-1]
    fonte_ind = "simples"  # banco/indice_modelo.json agora guarda P(alta) − P(corte) do modelo (ver CONTRATO.md)
    ind = ler(B / ("indice_modelo.json" if fonte_ind == "modelo" else "indice.json"))
    com_ind = sorted((i for i in ind["atas"] if i.get("indice") is not None), key=lambda i: i["ata"])
    base = com_ind[-1]
    indice = base["indice"]
    previsto = "aperto" if indice > LIMIAR else "afrouxamento" if indice < -LIMIAR else "manutencao"
    velho = ler(ARQ_SAIDA) or {}

    # Última decisão conhecida (pode ser posterior à última ata publicada)
    ultima = None
    try:
        hist = historico()
        ordinarias = [h for h in hist if not h["extra"]]
        h = ordinarias[-1]
        anteriores = [x for x in hist if x["data"] < h["data"]]
        pp = round(h["selic"] - anteriores[-1]["selic"], 2) if anteriores else 0.0
        sgs = selic_sgs(h["data"])
        ultima = {"numero": h["numero"], "data": h["data"].isoformat(), "selic": h["selic"], "decisao_pp": pp,
                  "decisao": classificar(pp), "ata_publicada": h["numero"] <= ult_ata["numero"],
                  "fonte": "BCB, histórico das taxas de juros (bcb.gov.br/controleinflacao/historicotaxasjuros)",
                  "confere_sgs432": (sgs == h["selic"]) if sgs is not None else None}
    except Exception as e:
        print(f"  aviso: histórico oficial indisponível ({e}); usa a última ata")
    if ultima is None:
        ultima = {"numero": ult_ata["numero"], "data": ult_ata["data_reuniao"], "selic": ult_ata.get("selic_apos"),
                  "decisao_pp": ult_ata.get("decisao_pp"), "decisao": ult_ata.get("decisao"), "ata_publicada": True,
                  "fonte": "banco/atas.json (SGS 432)", "confere_sgs432": True}
    data_ult = date.fromisoformat(ultima["data"])

    # Próxima reunião ainda não realizada
    prox = {"numero": None, "data": None, "fonte": "indisponível"}
    try:
        futuras = [d for d in calendario(hoje) if d > data_ult and d >= hoje]
        if futuras:
            prox = {"numero": ultima["numero"] + 1, "data": futuras[0].isoformat(), "fonte": FONTE_CAL}
    except Exception as e:
        print(f"  aviso: calendário do BC indisponível ({e})")
        vp = velho.get("proxima_reuniao") or {}
        if vp.get("data") and date.fromisoformat(vp["data"]) >= hoje and date.fromisoformat(vp["data"]) > data_ult:
            prox = vp                                          # data oficial já baixada antes e ainda futura

    met = ler(B / "metricas_previsao.json") or {}
    mi, mg = met.get("indice") or {}, met.get("ingenua") or {}
    acerto = {"indice": {"acuracia": mi.get("acuracia"), "acerto_sinal": mi.get("acerto_sinal"),
                         "n": met.get("n_atas"), "n_direcionais": mi.get("n_previsoes_direcionais")},
              "ingenua": {"acuracia": mg.get("acuracia"), "acerto_sinal": mg.get("acerto_sinal"),
                          "n": met.get("n_atas"), "n_direcionais": mg.get("n_previsoes_direcionais"),
                          "previsto": PARA_SINAL.get(ultima["decisao"])},
              "periodo": met.get("periodo"), "melhor": met.get("melhor")}

    focus = None
    if ARQ_FOCUS.exists():
        f = pd.read_csv(ARQ_FOCUS)
        f = f[(f["Indicador"] == "Selic") & (f["baseCalculo"] == 0)]
        ano = int((prox["data"] or hoje.isoformat())[:4])
        sub = f[f["DataReferencia"].astype(str) == str(ano)].sort_values("Data")
        if len(sub):
            focus = {"mediana": float(sub["Mediana"].iloc[-1]), "ano_referencia": ano, "data": str(sub["Data"].iloc[-1])}

    # Previsão de cada método para a próxima reunião; publica a do escolhido
    MAIS_DURO = {"afrouxamento": "manutencao", "manutencao": "aperto", "aperto": "aperto"}
    MAIS_BRANDO = {"aperto": "manutencao", "manutencao": "afrouxamento", "afrouxamento": "afrouxamento"}
    nivel = lambda v: None if v is None else "aperto" if v > LIMIAR else "afrouxamento" if v < -LIMIAR else "manutencao"
    dec_atual = PARA_SINAL.get(ultima["decisao"]) or "manutencao"
    simp = sorted((i for i in ler(B / "indice.json")["atas"] if i.get("indice") is not None), key=lambda i: i["ata"])
    if len(simp) >= 2:
        delta = round(simp[-1]["indice"] - simp[-2]["indice"], 3)
        prev_var = MAIS_DURO[dec_atual] if delta > LIMIAR else MAIS_BRANDO[dec_atual] if delta < -LIMIAR else dec_atual
    else:
        delta, prev_var = None, dec_atual
    mm = ler(B / "metricas_modelo.json") or {}
    pa = mm.get("previsao_atual") or {}
    por_modelo = pa.get("por_modelo") or {}
    probs_proximas = {}
    proximas = {"ingenua": dec_atual, "nivel_tom": nivel(simp[-1]["indice"]) if simp else None,
                "variacao_tom": prev_var}
    for nome in ("arvore", "logistica", "floresta"):
        pr = por_modelo.get(nome)
        # só vale se a linha de previsão do modelo é a da próxima reunião
        if pr and pa.get("reuniao") == prox.get("numero"):
            proximas[nome] = PARA_SINAL.get(max(pr, key=pr.get))
            probs_proximas[nome] = pr
        else:
            proximas[nome] = None
    mets = met.get("metodos") or {}
    metodos = []
    for nome in ("ingenua", "variacao_tom", "nivel_tom", "arvore", "logistica", "floresta"):
        m = mets.get(nome) or {}
        disp = bool(m.get("disponivel")) and proximas[nome] is not None
        metodos.append({"nome": nome, "rotulo_pt": m.get("rotulo_pt"), "acuracia_loo": m.get("acuracia_loo"),
                        "acuracia_tempo": m.get("acuracia_tempo"), "n_tempo": m.get("n_tempo"),
                        "viradas_tempo": m.get("viradas_tempo"),
                        "acerto_sinal": m.get("acerto_sinal"), "n": m.get("n"),
                        "probabilidades": probs_proximas.get(nome) if disp else None,
                        "previsto_proxima": proximas[nome] if disp else None, "disponivel": disp})
    escolhido = met.get("escolhido") if proximas.get(met.get("escolhido") or "") else "ingenua"
    previsto_nivel = previsto
    previsto = proximas[escolhido]

    saida = {"gerado_em": datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds"),
             "base_ata": base["ata"], "base_data_reuniao": base.get("data_reuniao"), "fonte_indice": fonte_ind,
             "indice": indice, "regra": {"aperto": "indice > 0.25", "afrouxamento": "indice < -0.25"},
             "previsto": previsto, "metodo_escolhido": escolhido,
             "acuracia_escolhido": (mets.get(escolhido) or {}).get("acuracia_tempo",
                                                                   (mets.get(escolhido) or {}).get("acuracia_loo")),
             "criterio_escolha": met.get("criterio_escolha"), "validacao_tempo": met.get("validacao_tempo"),
             "destaque_viradas": met.get("destaque_viradas"),
             "previsto_nivel_tom": previsto_nivel,
             "variacao_tom": {"delta": delta, "ata": simp[-1]["ata"] if simp else None,
                              "ata_anterior": simp[-2]["ata"] if len(simp) >= 2 else None},
             "metodos": metodos, "proxima_reuniao": prox,
             "ultima_decisao_conhecida": ultima if not ultima["ata_publicada"] else None,
             "ultima_decisao": ultima, "acerto": acerto, "focus_selic": focus}
    sem_data = lambda d: {k: v for k, v in d.items() if k != "gerado_em"}
    if sem_data(velho) == sem_data(saida):
        print("banco/previsao.json sem mudança.")
        return 0
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"banco/previsao.json: {previsto} pelo método {escolhido}; nível do tom: {previsto_nivel} (índice {indice} da ata {base['ata']}) para a reunião "
          f"{prox['numero']} em {prox['data']}; última decisão {ultima['numero']} {ultima['decisao']} "
          f"({'ata publicada' if ultima['ata_publicada'] else 'ata não publicada'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
