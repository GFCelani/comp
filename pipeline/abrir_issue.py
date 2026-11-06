"""
Abre uma issue no GitHub sem duplicar: se já houver issue aberta com o mesmo título, só comenta nela.

    python pipeline/abrir_issue.py "<título>" "<corpo em markdown>"

Usa o `gh` com GH_TOKEN (no workflow, o GITHUB_TOKEN). Sai com 0 mesmo se o gh falhar,
mas imprime ::warning:: para o aviso aparecer no run.
"""
import json
import subprocess
import sys


def gh(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")


def main() -> int:
    titulo, corpo = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ""
    r = gh("issue", "list", "--state", "open", "--limit", "200", "--json", "number,title")
    if r.returncode != 0:
        print(f"::warning::não consegui listar issues: {r.stderr[:300]}")
        return 0
    iguais = [i for i in json.loads(r.stdout or "[]") if i["title"] == titulo]
    if iguais:
        n = str(iguais[0]["number"])
        print(f"Issue #{n} já aberta com o título {titulo!r}; não duplica.")
        print(f"::warning::{titulo} (issue #{n} já aberta)")
        return 0
    r = gh("issue", "create", "--title", titulo, "--body", corpo)
    if r.returncode != 0:
        print(f"::warning::não consegui abrir a issue {titulo!r}: {r.stderr[:300]}")
        return 0
    print(f"::warning::{titulo} — issue aberta: {r.stdout.strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
