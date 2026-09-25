# Arquitetura e Padrões — Backend RAG (`api-rag`)

> **Nota (geduc-rag):** documento herdado do `rag-api`. No monorepo, o que
> mudou: a autenticação é **própria** (`common/guards/jwt-auth.guard.ts`, login em
> `modules/auth`) em vez de validar o JWT do geduc-api; o `tenant-id` é validado
> contra o vínculo `UserTenant` pelo `TenantGuard` (`@TenantScoped()`/`@TenantId()`
> em `common/tenancy/`), substituindo o `tenancyMiddleware`; env validada por
> `config/env.validation.ts` (class-validator) no lugar da config Joi; erros pelo
> `AllExceptionsFilter` do geduc-suporte (`{ statusCode, message, code? }`).
> O restante (estrutura dos módulos RAG, fronteiras, providers) segue valendo.

> Fonte única do detalhe arquitetural do backend de RAG (Retrieval-Augmented Generation).
> Mesmo espírito do [.docs/architecture.md](../../geduc-api/.docs/architecture.md) do
> `geduc-api`: NestJS + TypeScript, Clean Architecture, módulos isolados por gateway.
> Um `CLAUDE.md` na raiz do projeto deve carregar só as regras invioláveis e apontar pra cá.

## Visão geral

API de RAG em NestJS + TypeScript seguindo Clean Architecture. Duas pipelines de dados
distintas convivem no mesmo backend:

```text
Pipeline de ingestão (write path, assíncrona):
  Documento bruto → Parsing → Chunking → Embedding → Vector Store

Pipeline de consulta (read path, síncrona/streaming):
  Pergunta → Embedding da query → Retrieval (busca vetorial/híbrida) → Rerank
    → Augmentation (monta prompt com contexto) → Generation (LLM) → Resposta (+ citações)
```

Fluxo de dependência de camadas (igual ao geduc-api):

```text
Controllers → Application (Use Cases) → Domain (Entities) → Infrastructure (Repositories, Gateways)
```

## Módulos sugeridos

| Módulo | Responsabilidade | Observação |
|---|---|---|
| `documents` | Upload, metadados, versionamento e ciclo de vida do documento fonte | Dono da tabela `documents` |
| `ingestion` | Orquestra parsing → chunking → disparo de embedding (fila/assíncrono) | Consome `documents` via gateway |
| `embedding` | Gera embeddings (via gateway de provider) e persiste vetores (via gateway de vector store) | Não sabe de onde veio o chunk, só processa |
| `retrieval` | Busca semântica/híbrida no vector store, rerank, montagem do contexto | Só leitura |
| `chat` (ou `query`) | Orquestra RAG end-to-end: recebe pergunta, chama `retrieval`, monta prompt, chama `generation`, persiste histórico | Módulo "de borda", concentra a maior parte dos gateways externos |
| `generation` | Prompt templates, chamada ao LLM, parsing de output, streaming | Pode ser submódulo de `chat` em vez de módulo isolado, dependendo do tamanho |
| `evaluation` *(opcional)* | Feedback do usuário (thumbs up/down), métricas de qualidade de resposta | Fase 2 |

Cada módulo é dono das próprias tabelas. Nenhum módulo consulta tabela de outro
diretamente — sempre via gateway (ver [Regras de fronteira](#regras-de-fronteira-entre-módulos)).

## Estrutura de pastas de módulo

```text
src/modules/{module-name}/
├── __tests__/                           # todos os specs do módulo agrupados aqui
├── application/
│   ├── usecase/{entity}/{action}-{entity}.usecase.ts
│   ├── interface/repository/{entity}.repository.interface.ts
│   ├── interface/gateways/{service}.gateway.interface.ts
│   ├── interface/database/datasource/{entity}.datasource.interface.ts
│   ├── dtos/{entity}-{action}.dto.ts
│   ├── services/{service-name}.service.ts       # ex: chunking.service.ts, prompt-builder.service.ts
│   ├── query-service/{entity}/{query-name}.queryservice.ts
│   └── shared/
│       ├── dtos/{shared-type}.dto.ts
│       └── utils/{utility-name}.ts
├── domain/
│   └── entities/
│       ├── {entity}.entity.ts                   # ex: document.entity.ts, chunk.entity.ts
│       └── value-objects/{value-object}.vo.ts    # ex: embedding-vector.vo.ts, citation.vo.ts
├── infra/
│   ├── database/
│   │   ├── repositories/{entity}.repository.ts
│   │   ├── datasource/{entity}.datasource.ts
│   │   ├── factory/{entity}-repository.factory.ts
│   │   └── queries/{entity}.query.ts
│   ├── gateways/{service}.gateway.ts             # vector store, embedding provider, LLM provider
│   ├── queue/{job-name}.processor.ts             # workers de ingestão assíncrona (BullMQ/SQS)
│   └── exceptions/{error-name}-error.ts
├── controllers/
│   ├── {entity}.controller.ts
│   └── dtos/{action}-{entity}.dto.ts
├── providers/
│   ├── {module-name}-{context}.providers.ts
│   └── {module-name}-core.providers.ts
├── {module-name}.module.ts
└── {module-name}.providers.ts
```

## Multi-tenancy / isolamento por workspace

Se o produto for multi-cliente (SaaS), todo request exige um identificador de workspace
(`workspace-id` ou `tenant-id`, igual ao padrão do geduc-api). `TenancyMiddleware` extrai e
anexa em `req.tenantId`.

**Ponto crítico de RAG multi-tenant:** o isolamento não pode parar no banco relacional —
precisa valer também no **vector store**. Toda busca vetorial filtra por `tenantId`
(namespace/collection separado por tenant, ou metadata filter na query), senão um tenant
pode recuperar chunks de documentos de outro. Trate isso como regra de fronteira tão
inviolável quanto as de módulo.

## Provider Token Standard

| O que está provendo | Tipo de token | Exemplo |
|---|---|---|
| Repository (interface-backed) | String | `provide: 'IChunkRepository'` |
| Gateway (interface-backed) | String | `provide: 'IVectorStoreGateway'` |
| Data source (interface-backed) | String | `provide: 'IDocumentDataSource'` |
| Use case (classe concreta) | Class token | `provide: RetrieveContextUseCase` |
| Query service (classe concreta) | Class token | `provide: SearchChunksQueryService` |
| Factory / Adapter | Class token | `provide: ChunkRepositoryFactory` |

**Porquê:** interfaces TypeScript são apagadas em runtime. Tokens string permitem tipar o
construtor do use case contra uma interface mantendo-o injetável. Tokens de classe para use
cases evitam exigir `@Inject()`.

Registre providers no módulo via spread: `...Object.values(RETRIEVAL_PROVIDERS.USE_CASES)`.

## Regras de fronteira entre módulos

Um módulo só consome dados de outro por:

1. **Import de módulo NestJS**: `imports: [OtherModule]` — só se `OtherModule` exporta o provider
2. **Gateway** em `infra/gateways/` do módulo consumidor — pode referenciar os use cases
   exportados pelo módulo provedor no `useFactory inject:[]`

Serviço externo (provider de embedding, provider de LLM, vector store gerenciado) segue a
**mesma regra de gateway** — nunca chame o SDK do provider direto de dentro de um use case.

**Permitido:**
```text
chat/infra/gateways/document-context.gateway.ts
  → constructor recebe SearchChunksQueryService (exportado por RetrievalModule)
  → transforma os dados para o formato esperado pelo prompt builder

retrieval/infra/gateways/vector-store.gateway.ts
  → implementa IVectorStoreGateway
  → encapsula o SDK do vector store (Pinecone/Qdrant/pgvector/Weaviate)
```

**Proibido:**
```text
chat.providers.ts
  → inject: [SearchChunksQueryService]   ← em provider não-gateway

embedding/application/usecase/
  → importando o SDK da OpenAI/Cohere diretamente, sem passar por gateway
```

**Contrato de gateway:** toda dependência cross-module ou serviço externo exige:
1. Interface em `application/interface/gateways/{service}.gateway.interface.ts` (módulo consumidor)
2. Implementação em `infra/gateways/{service}.gateway.ts` (módulo consumidor)
3. O módulo provedor deve `export` o use case/service do qual o gateway depende (se cross-module)

**Isolamento de estado:** cada módulo é dono de suas próprias tabelas/coleções. Se o módulo B
precisa de dados do módulo A, vai por gateway — nunca consultando as tabelas de A diretamente.

### Comandos de detecção de violação

```bash
# Imports cross-module fora de gateways
grep -r "from.*modules/" src/modules --include="*.ts" \
  | grep -v "infra/gateways" | grep -v "\.spec\.ts"

# SDK de provider externo importado fora de gateway (ajuste os nomes dos pacotes usados)
grep -rn "from 'openai'\|from '@anthropic-ai\|from '@pinecone-database\|from 'cohere-ai'" src/modules \
  | grep -v "infra/gateways"

# Entidades sem contexto de domínio no nome
grep -r "export class " src/modules --include="*.entity.ts" | grep -v "Entity"
```

## Fluxo de dados

### Ingestão (write path — deve ser assíncrona)

```text
POST /documents (upload)
    ↓
Controller        — valida shape HTTP, extrai DTO, enfileira job
    ↓
Use Case          — persiste Document (status: pending), publica job na fila
    ↓
Queue Processor   — parsing → chunking → (por chunk) embedding → grava no vector store
    ↓
Document.status = ready | failed
```

Ingestão **nunca** deve ser síncrona no request HTTP — documentos grandes geram centenas de
chunks e chamadas de embedding, o que estoura timeout de request. Sempre fila
(BullMQ/SQS/etc), com endpoint de consulta de status (`GET /documents/:id/status`).

### Consulta (read path — síncrona ou streaming)

```text
POST /chat/query
    ↓
Controller        — valida shape HTTP, extrai DTO
    ↓
Use Case          — orquestra o pipeline abaixo
    ↓
    ├── Gateway (Embedding Provider) — embedding da pergunta
    ├── Gateway (Vector Store)       — busca por similaridade, filtrada por tenant
    ├── Service (Reranker)           — opcional, reordena por relevância
    ├── Service (Prompt Builder)     — monta prompt com contexto + histórico
    └── Gateway (LLM Provider)       — gera resposta (streaming via SSE, se aplicável)
    ↓
Repository        — persiste turno da conversa (pergunta, resposta, chunks usados/citações)
```

| Necessidade | Use |
|---|---|
| CRUD simples na tabela do próprio módulo | Repository |
| Leitura complexa / join otimizado nas tabelas do módulo | Data Source |
| Resultado agregado / paginado de múltiplos Data Sources | Query Service |
| Dado de outro módulo | Gateway |
| Embedding provider, LLM provider, vector store, storage de arquivo (S3) | Gateway |

## Camadas — regras por tipo

**Controllers**
- Injetam use cases **só por construtor**; nunca repositories/gateways/datasources
- Sempre `@HttpCode()`, `@UseGuards()`, `@ValidateInput()`, `@ValidateOutput()`, DTOs tipados
- Endpoint de geração com streaming usa `@Sse()` ou response manual — mas a orquestração
  do streaming vive no use case/service, o controller só repassa o stream
- Sem lógica de negócio; sem `@Injectable()`; sem field injection
- Nunca lançam exceções — deixam propagar para o `AllExceptionFilter` global

**Use Cases**
- Sempre implementam `IUseCase` com `execute(input)`
- Sempre `Logger` + `try/catch`, lançam exceções específicas de domínio
- **Nunca** `@Inject()` no construtor (são classes puras instanciadas por `useFactory`)
- Nunca acessam request HTTP, nunca escrevem SQL, nunca chamam SDK de provider externo direto
- Use cases de geração devem logar tokens consumidos e latência do provider (observability
  de custo é parte do use case, não um afterthought)

**Repositories & Data Sources**
- Interface antes da implementação (`I{Entity}Repository` → `{Entity}Repository`)
- Recebem `IDatabaseConnection` via construtor
- Retornam entidades/DTOs, nunca raw DB rows
- Data Sources: leituras otimizadas, nunca mutações
- Query Services compõem Data Sources, nunca escrevem SQL

**Gateways**
- Interface antes da implementação: `I{Service}Gateway` → `{Service}Gateway`
- Todo gateway implementa sua interface — sem gateways concrete-only
- Sempre transformam dados para o formato do módulo consumidor
- Pasta sempre `infra/gateways/` (plural)
- Gateways de LLM/embedding devem ser trocáveis sem tocar em use case (troca de provider =
  troca de implementação, interface não muda) — é o principal motivo de existir o gateway aqui
- Vector store gateway expõe operações no vocabulário do domínio (`upsertChunks`,
  `searchSimilar(query, filters)`), nunca vaza detalhe do SDK (ex: `namespace`, `topK` cru)
  para fora da própria implementação

**Entities & Value Objects**
- Entidades expõem `static createOutput(data)` para mapear de raw DB data
- VOs em `domain/entities/value-objects/`, validam na criação via `static create()`, nunca
  expõem propriedades mutáveis
- `EmbeddingVectorVO` valida dimensão do vetor na criação (ex: 1536 para
  `text-embedding-3-small`) — prometer o tamanho errado silenciosamente é o tipo de bug que
  só aparece no vector store, difícil de depurar depois
- `CitationVO` amarra um trecho de resposta ao(s) chunk(s)/documento(s) fonte que a
  sustentam — trate grounding/citação como modelo de domínio, não como string solta

## Hierarquia de exceções

| Cenário | Exceção | Local |
|---|---|---|
| Input inválido / regra de negócio | Módulo-específica estendendo `HttpException(400)` | `infra/exceptions/{name}-error.ts` |
| Entidade não encontrada | `NotFoundError` | Use case |
| Não autorizado | `UnauthorizedError` | Guard ou use case |
| Falha de banco | `ConnectDatabaseError` | Repository / Data Source |
| Falha do provider de embedding | `EmbeddingProviderError` | Gateway |
| Falha do provider de LLM (rate limit, timeout, content filter) | `LLMProviderError` | Gateway |
| Falha do vector store | `VectorStoreError` | Gateway |
| Prompt monta contexto maior que a janela do modelo | `ContextWindowExceededError` | Use case (antes de chamar o gateway) |
| **Nunca** | `BadRequestException` direto de `@nestjs/common` | Nunca em use cases |

Gateways de provider externo devem tratar erros de rate limit/timeout com retry (backoff
exponencial) **dentro do próprio gateway** — o use case não deveria saber que existe retry.

## Testes

**O que testar:** use cases (todos os branches), entidades de domínio (`createOutput`,
validações de VOs), query services, prompt builder (dado um input, o prompt gerado é
determinístico e testável sem chamar LLM real).
**O que NÃO testar:** repositories (integração), controllers, adapters, chamadas reais a
provider de LLM/embedding (sempre mock — custam dinheiro e são não-determinísticos).

- Arquivo: `src/modules/{module-name}/__tests__/{action}-{entity}.usecase.spec.ts`
- Instanciação direta (`new FooUseCase(mock)`) — sem `TestingModule`
- `jest.Mocked<ILLMGateway>`, `jest.Mocked<IVectorStoreGateway>` para mocks tipados —
  **nunca** bater em provider real nos testes unitários
- Sempre uma factory `makeInput(overrides?)` com defaults válidos
- Describes por comportamento: `'quando a busca não retorna chunks relevantes'`, não por
  nome de método
- Testes de regressão de qualidade (resposta permanece "boa" após mudar prompt/modelo) são
  um problema separado de eval, fora do escopo do Jest — não tente simular isso em spec

## Convenções de nomenclatura

Todos os nomes de arquivo em **inglês**.

| Tipo | Padrão | Exemplo |
|---|---|---|
| Arquivos | `kebab-case.ts` | `vector-store.gateway.ts` |
| Use Cases | `{action}-{entity}.usecase.ts` | `retrieve-context.usecase.ts` |
| Repositories | `{entity}.repository.ts` | `chunk.repository.ts` |
| Interfaces (arquivo) | `{name}.interface.ts` | `vector-store.gateway.interface.ts` |
| DTOs | `{action}-{entity}.dto.ts` | `query-chat.dto.ts` |
| Entities | `{entity}.entity.ts` — nome com contexto de domínio | `DocumentEntity`, `ChunkEntity` |
| Value Objects | `{name}.vo.ts` | `embedding-vector.vo.ts`, `citation.vo.ts` |
| Gateways | `{service}.gateway.ts` | `llm-provider.gateway.ts` |
| Queue Processors | `{job-name}.processor.ts` | `chunk-embedding.processor.ts` |
| Classes | `PascalCase` | `RetrieveContextUseCase` |
| Interfaces (tipo) | `I{Name}` | `IVectorStoreGateway` |
| Variáveis | `camelCase` | `vectorStoreGateway` |
| Constantes | `UPPER_SNAKE_CASE` | `DEFAULT_CHUNK_SIZE` |
| Namespace de provider | `{MODULE}_PROVIDERS` | `RETRIEVAL_PROVIDERS` |
| Sub-namespaces | `REPOSITORY`, `USE_CASES`, `GATEWAY` (**não** `GETAWAY`), `DATA_SOURCE`, `SERVICES` | — |
| Pasta de gateway | `infra/gateways/` (plural, nunca `infra/gateway/`) | — |

## Estilo de código

- Máx. **100 chars** por linha (ESLint + Prettier)
- Funções/métodos: propósito único, preferiv. **< 30 linhas**
- Classes: máx. **300 linhas**; arquivos: máx. **400 linhas**
- Máx. **3–4 parâmetros** — prefira objetos DTO
- Máx. **2 níveis** de if/else — prefira early returns
- Métodos fazem mutação OU query, nunca ambos
- Nunca use flag parameters — extraia em métodos específicos
- Imports por origem: NestJS → `@core` → módulos locais
- Nunca hardcode config (modelo de LLM, dimensão de embedding, chunk size) — use
  `ConfigService` ou `.env`; trocar de modelo não deveria exigir deploy de código
- Nunca `any` em controllers, use cases, gateways, services ou DTOs — use tipos concretos
  ou `unknown`. Exceção: raw DB rows em `createOutput()`, resposta bruta de SDK de provider
  externo antes do gateway normalizar (`// raw provider response`)
- Prompts de LLM vivem em arquivo próprio versionado (`{name}.prompt.ts` ou template
  externo), nunca como string inline dentro do use case — facilita revisão e versionamento
  de prompt separado de lógica

## Autenticação

1. Cliente envia `Authorization: Bearer <jwt>` + header `tenant-id` (se multi-tenant)
2. `JwtAuthGuard` valida token, role e permissões via `@Roles()` e `@RolePermissions()`
3. Expiração de JWT curta; refresh tokens fazem re-auth
4. `accesskey.guard.ts` trata auth system-to-system (ex: pipeline de ingestão automatizada
   via API key, sem usuário humano no fluxo)

## Variáveis de ambiente principais

| Variável | Propósito |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | Banco relacional (metadados, documentos, histórico de chat) |
| `VECTOR_STORE_URL`, `VECTOR_STORE_API_KEY`, `VECTOR_STORE_NAMESPACE_PREFIX` | Conexão com o vector store |
| `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | Provider de embedding |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MAX_OUTPUT_TOKENS` | Provider de geração |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Estratégia default de chunking |
| `RETRIEVAL_TOP_K`, `RERANK_ENABLED` | Parâmetros default de busca |
| `QUEUE_URL` / `REDIS_URL` | Fila de ingestão assíncrona |
| `JWT_SECRET`, `JWT_EXPIRATION_TIME` | Tokens de auth |
| `RATE_LIMIT_TTL`, `RATE_LIMIT` | Throttling (proteção de custo de LLM, não só de infra) |
| `NODE_ENV` | Controla logging, stack traces em respostas de erro |

## Pontos específicos de RAG que não têm equivalente direto no geduc-api

- **Versionamento de embedding**: se trocar de modelo de embedding, os vetores antigos ficam
  incompatíveis com os novos (dimensão/espaço vetorial diferentes). Guarde `embeddingModel` e
  `embeddingVersion` no chunk/vetor para permitir reprocessamento seletivo, nunca assuma que
  "reembedar tudo de uma vez" é sempre viável em produção.
- **Idempotência de ingestão**: reprocessar o mesmo documento (retry de job, upload duplicado)
  não pode duplicar chunks no vector store — chave de idempotência por `documentId + hash do
  conteúdo` no upsert.
- **Custo e observability**: cada chamada a embedding/LLM tem custo direto e mensurável.
  Logue tokens de entrada/saída e latência por request desde o início — não é uma métrica
  "nice to have" para adicionar depois.
- **Grounding/citação**: toda resposta gerada deveria conseguir apontar para os chunks que a
  sustentam. Se o use case de generation não recebe e não repassa os IDs dos chunks usados,
  não dá para auditar "de onde veio essa resposta" depois.
