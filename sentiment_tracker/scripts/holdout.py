"""
Baixa e extrai atas ANTERIORES a 2021 para o teste fora da amostra (nunca usadas para montar o modelo).

    .venv/bin/python scripts/holdout.py 227 235

Reaproveita o código do pipeline do time (../pipeline/atualizar_banco.py e ../pipeline/extrair.py),
mas grava só em dados/holdout/ (não toca em ../banco/):
    dados/holdout/atas/ata_<n>_<data>.pdf
    dados/holdout/paragrafos.jsonl   (mesmo formato de banco/paragrafos.jsonl)
    dados/holdout/atas.json          (numero, data_reuniao, url_pdf, data_publicacao do PDF)
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ.parent / "pipeline"))
import atualizar_banco as ab  # noqa: E402
import extrair as ex  # noqa: E402

DEST = RAIZ / "dados" / "holdout"

if __name__ == "__main__":
    ini, fim = int(sys.argv[1]), int(sys.argv[2])
    (DEST / "atas").mkdir(parents=True, exist_ok=True)
    import requests
    itens = requests.get(ab.ENDPOINT, params={"quantidade": 120, "filtro": ""},
                         headers={"User-Agent": ab.UA}, timeout=ab.TIMEOUT).json()["conteudo"]
    lista = []
    for c in itens:                                   # itens antigos podem vir sem Url: ignora
        n = ab._numero(c)
        if n is None or not c.get("Url") or not ini <= n <= fim:
            continue
        data = c["DataReferencia"][:10]
        lista.append({"numero": n, "data_reuniao": data, "url_pdf": ab.BASE_PDF + c["Url"],
                      "arquivo": f"ata_{n}_{data}.pdf"})
    meta, pars = [], []
    for a in sorted(lista, key=lambda a: a["numero"]):
        pdf = DEST / "atas" / a["arquivo"]
        if not pdf.exists() and not ab.baixar(a["url_pdf"], pdf):
            continue
        ps = ex.paragrafos_da_ata(pdf)
        for p in ps:
            p["ata"] = a["numero"]
        pars += ps
        meta.append({**a, "data_publicacao": ab.data_publicacao(pdf)})
        print(f"ata {a['numero']} ({a['data_reuniao']}): {len(ps)} parágrafos")
    (DEST / "atas.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(DEST / "paragrafos.jsonl", "w", encoding="utf-8") as f:
        for p in pars:
            f.write(json.dumps({k: p[k] for k in ("ata", "paragrafo", "secao", "texto")}, ensure_ascii=False) + "\n")
