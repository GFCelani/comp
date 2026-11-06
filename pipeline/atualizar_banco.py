"""
Atualiza o banco de atas do Copom (banco/atas/ e banco/atas.json).

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/atualizar_banco.py [--limite-min 30]

Lista as atas pelo endpoint JSON do BC, filtra reuniões a partir de 2021-01-01,
baixa só as que faltam em banco/atas/ (ata_<numero>_<AAAA-MM-DD>.pdf) e
atualiza banco/atas.json preservando os campos já preenchidos por selic.py.
Idempotente: rodar de novo só adiciona o que falta.
"""
import argparse
import json
import re
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from pypdf import PdfReader

RAIZ = Path(__file__).resolve().parents[1]
PASTA_ATAS = RAIZ / "banco" / "atas"
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ATAS_DO_CASE = RAIZ / "data" / "case2_copom" / "atas"

ENDPOINT = "https://www.bcb.gov.br/api/servico/sitebcb/atascopom/ultimas"
BASE_PDF = "https://www.bcb.gov.br"
DATA_MINIMA = "2021-01-01"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
TIMEOUT = 60


def listar_atas(quantidade: int = 80) -> list[dict]:
    r = requests.get(ENDPOINT, params={"quantidade": quantidade, "filtro": ""},
                     headers={"User-Agent": UA}, timeout=TIMEOUT)
    r.raise_for_status()
    itens = []
    for c in r.json()["conteudo"]:
        numero = _numero(c)
        data = (c.get("DataReferencia") or "")[:10]
        if numero is None or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", data):
            print(f"  aviso: item sem número ou data, ignorado: {c.get('Titulo')!r}")
            continue
        if data < DATA_MINIMA:
            continue
        itens.append({"numero": numero, "data_reuniao": data,
                      "url_pdf": BASE_PDF + c["Url"],
                      "arquivo": f"ata_{numero}_{data}.pdf"})
    itens.sort(key=lambda x: x["numero"], reverse=True)
    return itens


def _numero(c: dict) -> int | None:
    m = re.match(r"\s*(\d+)", c.get("Titulo") or "")
    if m:
        return int(m.group(1))
    m = re.search(r"copom(\d+)", c.get("Url") or "", flags=re.I)
    return int(m.group(1)) if m else None


def data_publicacao(pdf: Path) -> str | None:
    """Data de criação do PDF (metadado CreationDate), ou None."""
    try:
        bruto = (PdfReader(pdf).metadata or {}).get("/CreationDate") or ""
        m = re.search(r"D:(\d{4})(\d{2})(\d{2})", str(bruto))
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None
    except Exception as e:  # PDF corrompido etc.
        print(f"  aviso: sem CreationDate em {pdf.name}: {e}")
        return None


def baixar(url: str, destino: Path) -> bool:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
        r.raise_for_status()
        if not r.content.startswith(b"%PDF"):
            raise ValueError("resposta não é PDF")
        tmp = destino.with_suffix(".tmp")
        tmp.write_bytes(r.content)
        tmp.replace(destino)
        return True
    except Exception as e:
        print(f"  FALHOU {destino.name}: {e}")
        return False


def carregar_banco() -> dict[int, dict]:
    if not ARQ_ATAS.exists():
        return {}
    return {a["numero"]: a for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))}


def salvar_banco(banco: dict[int, dict]) -> None:
    lista = [banco[k] for k in sorted(banco)]
    ARQ_ATAS.write_text(json.dumps(lista, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copiar_atas_do_case() -> None:
    PASTA_ATAS.mkdir(parents=True, exist_ok=True)
    for pdf in sorted(ATAS_DO_CASE.glob("ata_*.pdf")) if ATAS_DO_CASE.exists() else []:
        if not (PASTA_ATAS / pdf.name).exists():
            shutil.copy2(pdf, PASTA_ATAS / pdf.name)
            print(f"  copiada do case: {pdf.name}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite-min", type=float, default=30, help="tempo máximo de downloads")
    ap.add_argument("--quantidade", type=int, default=80)
    args = ap.parse_args()
    inicio = time.monotonic()

    copiar_atas_do_case()
    banco = carregar_banco()
    try:
        listagem = listar_atas(args.quantidade)
    except Exception as e:
        print(f"Não consegui listar as atas no BC: {e}")
        listagem = []
    print(f"{len(listagem)} atas listadas no BC desde {DATA_MINIMA}")

    falhas, novas = [], 0
    for item in listagem:
        destino = PASTA_ATAS / item["arquivo"]
        if not destino.exists():
            if (time.monotonic() - inicio) / 60 > args.limite_min:
                print(f"  tempo esgotado ({args.limite_min} min): parando os downloads")
                falhas.append(item["numero"])
                continue
            print(f"  baixando {item['arquivo']} ...")
            if not baixar(item["url_pdf"], destino):
                falhas.append(item["numero"])
                continue
            novas += 1
        registro = banco.get(item["numero"], {})
        registro.update({"numero": item["numero"], "data_reuniao": item["data_reuniao"],
                         "url_pdf": item["url_pdf"], "arquivo": item["arquivo"]})
        if not registro.get("data_publicacao"):
            registro["data_publicacao"] = data_publicacao(destino)
        banco[item["numero"]] = registro

    # Atas que estão na pasta mas não vieram na listagem (ex.: copiadas do case sem internet)
    for pdf in sorted(PASTA_ATAS.glob("ata_*.pdf")):
        m = re.match(r"ata_(\d+)_(\d{4}-\d{2}-\d{2})\.pdf$", pdf.name)
        if m and int(m.group(1)) not in banco:
            n, d = int(m.group(1)), m.group(2)
            banco[n] = {"numero": n, "data_reuniao": d, "data_publicacao": data_publicacao(pdf),
                        "url_pdf": f"{BASE_PDF}/content/copom/atascopom/Copom{n}-not{d.replace('-', '')}{n}.pdf",
                        "arquivo": pdf.name}

    salvar_banco(banco)
    print(f"Banco: {len(banco)} atas ({min(banco)} a {max(banco)}), {novas} baixadas agora, "
          f"{len(falhas)} falharam: {falhas or '-'}; {(time.monotonic() - inicio) / 60:.1f} min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
