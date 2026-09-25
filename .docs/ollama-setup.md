# Ollama no Ubuntu — guia de setup

> Passo a passo para rodar o `LLM_PROVIDER=ollama` do backend localmente,
> servindo `qwen2.5:7b` via [Ollama](https://ollama.com). Complementa
> `backend/.env.example` e `.docs/rag-architecture.md`.

## 1. Instalar

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

O instalador registra um serviço `systemd`. Confira que está no ar:

```bash
systemctl status ollama
```

## 2. Conferir a GPU (opcional, mas recomendado)

O Ollama usa GPU NVIDIA automaticamente quando o driver está instalado.
Confirme que a placa é enxergada:

```bash
nvidia-smi
```

Sem GPU (ou sem `nvidia-smi`), o Ollama cai para CPU — funciona, mas a
resposta fica bem mais lenta.

## 3. Baixar o modelo

```bash
ollama pull qwen2.5:7b
```

O download é de alguns gigabytes (o modelo Q4 default fica em torno de
4,7 GB). Uma vez baixado, fica em cache local (`~/.ollama/models`).

## 4. Testar pela CLI

```bash
ollama run qwen2.5:7b "teste"
```

Deve responder no terminal. `Ctrl+D` ou `/bye` encerra a sessão.

## 5. Testar a API HTTP

O backend fala com o Ollama por HTTP (`LLM_BASE_URL`, default
`http://localhost:11434`), não pela CLI. Confirme que o servidor HTTP
responde e que o modelo baixado aparece na lista:

```bash
curl http://localhost:11434/api/tags
```

## 6. Configurar o backend

Em `backend/.env` (a partir de `backend/.env.example`):

```bash
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:7b
LLM_TIMEOUT_MS=120000
LLM_CONTEXT_WINDOW_TOKENS=8192
```

O `OllamaLlmProviderGateway` chama `POST /api/generate` com
`options.num_ctx = LLM_CONTEXT_WINDOW_TOKENS` — sem isso o Ollama usa o
contexto padrão dele e trunca o prompt do RAG (pergunta + chunks
recuperados) em silêncio.

## Observações de hardware

- **RTX 4060 8 GB (notebook ou desktop):** o `qwen2.5:7b` em quantização Q4
  (o default do `ollama pull`) ocupa cerca de 4,7 GB de VRAM, cabendo com
  folga em 8 GB. Evite subir `LLM_CONTEXT_WINDOW_TOKENS` muito além de 8192 —
  o KV cache cresce com o contexto e pode estourar a VRAM disponível junto
  com o peso do modelo.
- **14 GB de RAM:** suficiente para o Ollama em CPU (sem GPU) com esse
  modelo, mas espere respostas bem mais lentas que em GPU. Se a máquina tiver
  outros serviços do monorepo no ar (MySQL, backend, `EMBEDDING_PROVIDER=local`
  carregando o modelo de embedding), monitore o uso de memória — o modelo de
  embedding (`Xenova/multilingual-e5-small`) é pequeno (dezenas de MB) e não
  compete de forma relevante com o LLM.
- Trocar de modelo (`LLM_MODEL`) exige um novo `ollama pull` antes de apontar
  o `.env` para ele.
