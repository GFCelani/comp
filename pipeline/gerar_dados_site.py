"""
Monta os dados do site → saida/dados_site.json e saida/busca.json, e copia os dois para site/data/.

    .venv/Scripts/python.exe pipeline/gerar_dados_site.py

Usa banco/indice.json para a série de tom; banco/indice_modelo.json (P(alta) − P(corte) do modelo de decisão) vai no campo indice_modelo.
Inclui banco/metricas_previsao.json, banco/metricas_modelo.json quando existirem.
dados_site.json só leva trechos curtos (≤25 palavras); o texto completo vai só para busca.json,
que o site lê apenas no servidor.
"""
import json
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
B, S = RAIZ / "banco", RAIZ / "saida"
ARQ_FOCUS = RAIZ / "data" / "case1_focus" / "focus_anuais.csv"
ARQ_SGS = RAIZ / "data" / "case1_focus" / "sgs_realizado.csv"
SITE = RAIZ / "site" / "data"

COMO_MEDIMOS = {
    "regua": ("Cada parágrafo numerado das atas recebe uma nota inteira de −2 a +2: +2 muito duro "
              "(sinaliza alta de juros ou juros altos por mais tempo, com ênfase), +1 duro, 0 neutro ou "
              "descritivo, −1 brando, −2 muito brando (sinaliza corte de juros, com ênfase). As notas são dadas "
              "pelo Claude (Sonnet), uma ata por vez, com a mesma régua para todas as atas, e vêm com um trecho "
              "de até 25 palavras copiado do parágrafo que justifica a nota."),
    "agregacao": ("O índice de cada ata é a média das notas ignorando zeros: parágrafos neutros (fatos e dados) "
                  "não diluem o sinal. Se nenhum parágrafo tiver nota diferente de zero, o índice fica vazio. "
                  "A média simples de todas as notas também é calculada e guardada para comparação."),
    "validacao": ("Checagem por código: todo trecho exibido é conferido como cópia literal do parágrafo, com no máximo 25 "
                  "palavras; o que não passa é marcado como inválido. Nos textos de mudanças e impacto, todo "
                  "número precisa existir nos dados fornecidos."),
}


def ler(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def jsonl(p: Path) -> list[dict]:
    with p.open(encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def datas_dados() -> dict:
    out = {"selic": None, "focus": None}
    if ARQ_SGS.exists():
        sgs = pd.read_csv(ARQ_SGS)
        out["selic"] = str(sgs[sgs["serie"] == "selic_meta"]["data"].max())
    if ARQ_FOCUS.exists():
        out["focus"] = str(pd.read_csv(ARQ_FOCUS, usecols=["Data"])["Data"].max())
    return out


def metricas_previsao_publica(m: dict | None, mm: dict | None) -> dict | None:
    """Versão pública: só o modelo de nota de tom. Ingênua, nível e variação do tom ficam fora (DECISOES.md)."""
    if not mm:
        return None
    met = mm.get("metricas") or {}
    return {"gerado_em": mm.get("gerado_em"), "n_atas": mm.get("n_atas_treino"), "periodo": met.get("periodo"),
            "escolhido": mm.get("tipo"), "criterio_escolha": mm.get("criterio_escolha"),
            "metodos": {mm.get("tipo"): {"acuracia_tempo": met.get("acuracia"),
                                         "acuracia_balanceada": met.get("acuracia_balanceada"),
                                         "n_tempo": met.get("n"), "viradas_tempo": mm.get("viradas"),
                                         "disponivel": True}}}


def checagens(rotulos: list, paragrafos: list, textos: dict, status: dict | None) -> dict:
    """Checagens por código: trechos dos rótulos, citações do relatório e portão de qualidade."""
    validos = sum(bool(r.get("trecho_valido")) for r in rotulos)
    texto_par = {(p["ata"], p["paragrafo"]): p["texto"] for p in paragrafos}
    ver = tot = 0
    for s in textos.get("secoes") or []:
        for p in s.get("paragrafos") or []:
            for c in p.get("citacoes") or []:
                tot += 1
                t = texto_par.get((c.get("ata"), c.get("paragrafo")), "")
                tr = c.get("trecho") or ""
                ver += bool(tr) and tr in t and len(tr.split()) <= 25
    port = (status or {}).get("portao")
    portao = ({"resultado": port.get("resultado"), "motivo": port.get("motivo"), "verificado_em": port.get("verificado_em")}
              if isinstance(port, dict) else None)
    return {"trechos": {"validos": validos, "invalidos": len(rotulos) - validos, "total": len(rotulos)},
            "citacoes_relatorio": {"verificadas": ver, "total": tot, "ok": ver == tot},
            "portao_qualidade": portao}


def manchete(textos: dict, ult: int) -> dict | None:
    if textos.get("ata_atual") != ult or not textos.get("manchete"):
        return None
    return {"texto": textos["manchete"], "linha_fina": textos.get("linha_fina"), "origem": textos.get("origem")}


def relatorio(textos: dict, ult: int, por_num: dict) -> dict | None:
    """Seções do relatório; cada citação ganha url_pdf e data_reuniao. Só trechos ≤ 25 palavras."""
    if textos.get("ata_atual") != ult or not textos.get("secoes"):
        return None
    secoes = []
    for s in textos["secoes"]:
        pars = []
        for p in s["paragrafos"]:
            cits = []
            for c in p["citacoes"]:
                if len(c["trecho"].split()) > 25:
                    raise RuntimeError(f"trecho longo demais no relatório: ata {c['ata']} §{c['paragrafo']}")
                a = por_num.get(c["ata"], {})
                cits.append({**c, "url_pdf": a.get("url_pdf"), "data_reuniao": a.get("data_reuniao")})
            pars.append({"texto": p["texto"], "citacoes": cits})
        secoes.append({"id": s["id"], "titulo": s["titulo"], "paragrafos": pars})
    return {"origem": textos.get("origem"), "gerado_em": textos.get("gerado_em"), "reescritas": textos.get("reescritas"),
            "secoes": secoes}


def main() -> int:
    atas = sorted(ler(B / "atas.json"), key=lambda a: a["numero"])
    por_num = {a["numero"]: a for a in atas}
    paragrafos = jsonl(B / "paragrafos.jsonl")
    rotulos = jsonl(B / "rotulos.jsonl")
    fonte = "simples"  # indice_modelo.json agora é P(alta) − P(corte) do modelo de decisão, não índice de tom
    indice = ler(B / ("indice_modelo.json" if fonte == "modelo" else "indice.json"))
    ind = {i["ata"]: i for i in indice["atas"]}
    textos = ler(S / "textos.json") or {}

    rot = {}
    for r in rotulos:
        rot[(r["ata"], r["paragrafo"])] = r
    pars_por_ata = {}
    for p in paragrafos:
        pars_por_ata.setdefault(p["ata"], []).append(p)

    serie, lista = [], []
    for a in atas:
        n = a["numero"]
        i = ind.get(n, {})
        serie.append({"ata": n, "data_reuniao": a["data_reuniao"], "indice": i.get("indice"),
                      "selic_apos": a.get("selic_apos"), "decisao": a.get("decisao"), "decisao_pp": a.get("decisao_pp")})
        nz = []
        for p in sorted(pars_por_ata.get(n, []), key=lambda x: x["paragrafo"]):
            r = rot.get((n, p["paragrafo"]))
            if r and r["nota"] != 0:
                trecho = r["trecho"] if r.get("trecho_valido") else None
                if trecho and len(trecho.split()) > 25:
                    trecho = None
                nz.append({"paragrafo": p["paragrafo"], "nota": r["nota"], "trecho": trecho})
        lista.append({"numero": n, "data_reuniao": a["data_reuniao"], "url_pdf": a["url_pdf"],
                      "indice": i.get("indice"), "n_paragrafos": i.get("n_paragrafos", len(pars_por_ata.get(n, []))),
                      "n_nao_zero": i.get("n_nao_zero", len(nz)), "paragrafos": nz})

    ult = atas[-1]
    agora = datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds")   # Brasília, também no runner (UTC)
    como = dict(COMO_MEDIMOS)
    dados = {
        "gerado_em": agora,
        "exemplo": False,
        "ultima_verificacao": agora,
        "textos_pendentes": False,
        "fonte_indice": fonte,
        "resumo": {
            "ultima_ata": {"numero": ult["numero"], "data_reuniao": ult["data_reuniao"], "decisao": ult.get("decisao"),
                           "decisao_pp": ult.get("decisao_pp"), "selic_apos": ult.get("selic_apos"),
                           "indice": ind.get(ult["numero"], {}).get("indice"), "url_pdf": ult["url_pdf"]},
            "n_atas": len(atas), "n_paragrafos": len(paragrafos),
            "n_trechos_invalidos": sum(not r["trecho_valido"] for r in rotulos),
            "periodo": {"inicio": atas[0]["data_reuniao"], "fim": ult["data_reuniao"]},
        },
        "serie": serie,
        "mudancas": textos.get("mudancas", []) if textos.get("ata_atual") == ult["numero"] else [],
        "mudancas_origem": textos.get("origem", "claude") if textos.get("ata_atual") == ult["numero"] else None,
        "impacto": textos.get("impacto") if textos.get("ata_atual") == ult["numero"] else None,
        "atas": lista,
        "previsao": ler(B / "previsao.json"),
        "manchete": manchete(textos, ult["numero"]),
        "relatorio": relatorio(textos, ult["numero"], por_num),
        "como_medimos": como,
        "metricas_previsao": metricas_previsao_publica(ler(B / "metricas_previsao.json"), ler(B / "metricas_modelo.json")),
        "metricas_modelo": ler(B / "metricas_modelo.json"),
        "checagens_automaticas": checagens(rotulos, paragrafos, textos, ler(S / "status.json")),
        "datas_dados": datas_dados(),
        "conferencia_selic": ler(S / "conferencia_selic.json"),
        "validacao_selic_oficial": ler(S / "validacao_selic_oficial.json"),
        "indice_modelo": ler(B / "indice_modelo.json"),
        "forcas_fraquezas": ler(RAIZ / "modelo" / "forcas_fraquezas.json"),
        "status": ler(S / "status.json"),
    }

    # Nenhum texto longo no JSON público: trechos ≤ 25 palavras
    longos = [(a["numero"], p["paragrafo"]) for a in lista for p in a["paragrafos"]
              if p["trecho"] and len(p["trecho"].split()) > 25]
    longos += [m["paragrafo"] for m in dados["mudancas"] if len(m["trecho"].split()) > 25]
    if longos:
        raise RuntimeError(f"trechos longos demais no dados_site.json: {longos}")

    busca = [{"ata": p["ata"], "data_reuniao": por_num[p["ata"]]["data_reuniao"], "paragrafo": p["paragrafo"],
              "texto": p["texto"], "url_pdf": por_num[p["ata"]]["url_pdf"]}
             for p in sorted(paragrafos, key=lambda x: (x["ata"], x["paragrafo"])) if p["ata"] in por_num]

    S.mkdir(exist_ok=True)
    (S / "dados_site.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (S / "busca.json").write_text(json.dumps(busca, ensure_ascii=False) + "\n", encoding="utf-8")
    SITE.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(S / "dados_site.json", SITE / "dados_site.json")
    shutil.copyfile(S / "busca.json", SITE / "busca.json")
    sem_rotulo = [a["numero"] for a in lista if a["indice"] is None]
    print(f"saida/dados_site.json e busca.json → site/data/: {len(atas)} atas, {len(paragrafos)} parágrafos, "
          f"{len(busca)} na busca, fonte {fonte}, textos_pendentes {dados['textos_pendentes']}, "
          f"atas sem índice: {sem_rotulo or '-'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
