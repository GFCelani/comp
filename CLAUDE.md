# Competição de Claude Code

Pasta de trabalho para um desafio ainda não definido. Repositório privado: GFCelani/comp.

## Como trabalhar

1. Planeje antes de codar: leia o desafio, liste os requisitos e escreva um plano curto em passos.
2. Trabalhe em passos pequenos, uma mudança verificável por vez.
3. Teste cada passo antes de seguir: rode o código, os testes ou abra a página no Playwright.
4. Faça commit a cada passo que funciona, com mensagem clara no imperativo (ex.: "Adiciona validação do formulário").
5. Use subagentes para pesquisa, leitura ampla de código e tarefas independentes em paralelo.
6. Se travar duas vezes no mesmo erro, pare, investigue a causa e mude a abordagem.

## Ferramentas

- Node 24, npm, pnpm, Python 3.13, pip e uv já instalados. Prefira pnpm para Node e uv para Python.
- Instale bibliotecas só quando o desafio pedir, sempre no projeto, nunca global.
- Playwright MCP para abrir páginas e tirar capturas. Salve capturas em .playwright-mcp/.

## Regras

- Nenhuma chave de API ou senha no código, no repositório ou no chat. Use variáveis de ambiente em .env (fora do git) e informe ao usuário o nome da variável.
- Mantenha um .env.example com os nomes das variáveis, sem valores.
- Skills de terceiros só como pasta com SKILL.md. Nada de plugins, hooks ou .mcp.json de terceiros.
- Não altere configurações globais nem outros projetos.

## Relatórios

- Em português, curtos e objetivos: o que foi feito, como foi testado, o que falta.
- Diga claramente quando algo falhou ou não foi testado.
