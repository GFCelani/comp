"""
Comando único do pipeline. Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/rodar.py [--modelo]

atualizar_banco → extrair → diff → selic → rotular (só atas novas) → indice → metricas →
textos (só se a última ata mudou desde saida/textos.json) → gerar_dados_site.
Idempotente: sem ata nova, não chama o Claude e não baixa PDFs (só consulta a lista do BC;
Selic/Focus só são baixados uma vez por dia).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PY = sys.executable


def ultima_ata() -> int | None:
    arq = RAIZ / "banco" / "paragrafos.jsonl"
    with arq.open(encoding="utf-8") as f:
        atas = {json.loads(l)["ata"] for l in f if l.strip()}
    return max(atas) if atas else None


def textos_desatualizados() -> bool:
    arq = RAIZ / "saida" / "textos.json"
    if not arq.exists():
        return True
    return json.loads(arq.read_text(encoding="utf-8")).get("ata_atual") != ultima_ata()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", action="store_true", help="rotula atas novas com o modelo do parceiro")
    args = ap.parse_args()

    registro = Path(tempfile.gettempdir()) / f"copom_chamadas_{os.getpid()}.txt"
    registro.unlink(missing_ok=True)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "COPOM_REGISTRO_CHAMADAS": str(registro)}

    etapas = [("atualizar_banco", ["pipeline/atualizar_banco.py"]),
              ("extrair", ["pipeline/extrair.py"]),
              ("diff", ["pipeline/diff.py"]),
              ("selic", ["pipeline/selic.py"]),
              ("rotular", ["pipeline/rotular.py"] + (["--modelo"] if args.modelo else [])),
              ("indice", ["pipeline/indice.py"]),
              ("metricas", ["pipeline/metricas.py"]),
              ("textos", ["pipeline/textos.py"]),
              ("gerar_dados_site", ["pipeline/gerar_dados_site.py"])]
    tempos, falhas = {}, []
    for nome, cmd in etapas:
        if nome == "textos" and not textos_desatualizados():
            print("== textos: última ata não mudou; pulando (sem chamada ao Claude)")
            tempos[nome] = 0.0
            continue
        print(f"== {nome}", flush=True)
        t0 = time.time()
        r = subprocess.run([PY, *cmd], cwd=RAIZ, env=env)
        tempos[nome] = round(time.time() - t0, 1)
        if r.returncode != 0:
            falhas.append(nome)
            print(f"!! {nome} terminou com código {r.returncode}", flush=True)
            if nome in ("extrair", "indice", "gerar_dados_site"):
                break

    chamadas = len(registro.read_text(encoding="utf-8").splitlines()) if registro.exists() else 0
    registro.unlink(missing_ok=True)
    print("\nTempo por etapa (s): " + ", ".join(f"{k} {v}" for k, v in tempos.items()))
    print(f"Chamadas ao Claude nesta execução: {chamadas}")
    print(f"Falhas: {falhas or '-'}")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
