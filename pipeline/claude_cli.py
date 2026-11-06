"""
Chamada ao Claude Code em modo não interativo, compartilhada por rotular.py e textos.py.

Sempre `claude -p --model sonnet --output-format json`, prompt pela stdin.
Timeout de 300 s por chamada e 1 nova tentativa em erro.
"""
import json
import os
import re
import shutil
import subprocess
import time

MODELO = "sonnet"
TIMEOUT = 300

CHAMADAS = 0   # contador de chamadas ao Claude nesta execução (para checar idempotência)


def _executavel() -> str:
    exe = shutil.which("claude") or shutil.which("claude.cmd") or shutil.which("claude.exe")
    if not exe:
        raise RuntimeError("Claude Code (comando 'claude') não encontrado no PATH")
    return exe


def chamar(prompt: str, tentativas: int = 2) -> str:
    """Devolve o texto da resposta (campo `result`). Levanta RuntimeError após as tentativas."""
    global CHAMADAS
    exe = _executavel()
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}
    ultimo_erro = None
    for t in range(tentativas):
        CHAMADAS += 1
        if os.environ.get("COPOM_REGISTRO_CHAMADAS"):          # rodar.py conta as chamadas por aqui
            with open(os.environ["COPOM_REGISTRO_CHAMADAS"], "a", encoding="utf-8") as f:
                f.write("1\n")
        try:
            r = subprocess.run([exe, "-p", "--model", MODELO, "--output-format", "json"],
                               input=prompt, capture_output=True, text=True, encoding="utf-8",
                               timeout=TIMEOUT, env=env)
            if r.returncode != 0:
                raise RuntimeError(f"código {r.returncode}: {(r.stderr or r.stdout)[:300]}")
            dados = json.loads(r.stdout)
            if dados.get("is_error"):
                raise RuntimeError(f"erro do Claude: {str(dados.get('result'))[:300]}")
            return dados.get("result", "")
        except Exception as e:   # timeout, JSON inválido, erro de execução
            ultimo_erro = e
            if t + 1 < tentativas:
                time.sleep(3)
    raise RuntimeError(f"claude -p falhou {tentativas}x: {ultimo_erro}")


def extrair_json(texto: str):
    """Primeiro bloco JSON (lista ou objeto) do texto, tolerando cercas ```json."""
    m = re.search(r"```(?:json)?\s*(.*?)```", texto, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    dec = json.JSONDecoder()
    for i, c in enumerate(texto):
        if c in "[{":
            try:
                return dec.raw_decode(texto[i:])[0]
            except json.JSONDecodeError:
                continue
    raise ValueError("nenhum JSON na resposta")


def normalizar(s: str) -> str:
    """Normaliza aspas tipográficas, travessões e espaços para comparar trechos."""
    trocas = {"“": '"', "”": '"', "„": '"', "‘": "'", "’": "'",
              " ": " ", "–": "-", "—": "-", "…": "..."}
    for a, b in trocas.items():
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def trecho_ok(trecho: str, texto: str, max_palavras: int = 25) -> bool:
    t = normalizar(trecho or "")
    if not t or len(t.split()) > max_palavras:
        return False
    return t in normalizar(texto)


def ram_percentual() -> float:
    try:
        import psutil
        return psutil.virtual_memory().percent
    except ImportError:
        pass
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "$o=Get-CimInstance Win32_OperatingSystem; "
                            "[math]::Round(100*(1-$o.FreePhysicalMemory/$o.TotalVisibleMemorySize),1)"],
                           capture_output=True, text=True, timeout=30)
        return float(r.stdout.strip().replace(",", "."))
    except Exception:
        return 0.0
