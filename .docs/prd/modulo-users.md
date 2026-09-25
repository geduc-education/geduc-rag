# Módulo de usuários (1º módulo) — escopo e decisões

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Nome do monorepo | `geduc-rag` |
| Arquitetura backend | Híbrida: plataforma no padrão geduc-suporte (Controller → Service → Prisma); RAG mantém a Clean Architecture do rag-api |
| Autenticação | Própria (argon2 + JWT HS256), independente do geduc-api |
| Multi-tenant | Tenant simples: `Tenant` + `UserTenant` N:N; header `tenant-id` validado contra o vínculo; perfis globais |

## API

| Rota | Permissão | Observação |
|---|---|---|
| `POST /auth/login` | pública | e-mail normalizado; mensagem genérica em falha |
| `POST /auth/change-password` | autenticado | liberada com troca pendente; devolve token novo |
| `GET /auth/me` | autenticado | perfis, permissões, tenants, flags |
| `GET /users` | `user:read` | paginado (`page`, `limit`, `search`, `active`, `tenantId`) e restrito ao alcance |
| `GET /users/:id` | `user:read` | 404 fora do alcance |
| `POST /users` | `user:manage` | senha temporária + perfis + tenants numa escrita |
| `PATCH /users/:id` | `user:manage` | `profileIds` substitui o conjunto |
| `PUT /users/:id/tenants` | `user:manage` | preserva vínculos fora do alcance |
| `POST /users/:id/reset-password` | `user:manage` | nova senha temporária; 409 se inativo |
| `PATCH /users/:id/activate` · `/deactivate` | `user:manage` | |
| `DELETE /users/:id` | `user:manage` | exclusão lógica |
| `GET /profiles` | `profile:read` ou `user:manage` | opções do formulário |
| `GET/POST/PATCH /tenants` | `tenant:read` / `tenant:manage` (`GET` lista também com `user:manage`) | criador nasce vinculado |

## Regras de negócio

1. **Alcance**: quem não é SUPERADMIN só vê/opera usuários com tenant em comum.
2. **Tenants**: só se vincula ou desvincula tenant do próprio alcance (403
   `TENANT_NOT_GRANTABLE`). Criar usuário exige ≥ 1 tenant (exceto SUPERADMIN).
3. **Perfis**: ninguém concede nem retira perfil com permissão que não tem (403
   `PERMISSION_NOT_GRANTABLE`).
4. **SUPERADMIN**: só outro SUPERADMIN o altera; ninguém o inativa ou exclui.
5. Ninguém inativa ou exclui a si mesmo.
6. E-mail único e normalizado; conflito responde 409 neutro.
7. Senha criada/redefinida pelo admin é temporária (`mustChangePassword`).

## Diferenças em relação ao geduc-suporte

- **Sem e-mail transacional ainda.** O admin informa a senha temporária em vez de
  o sistema gerar e enviar. "Esqueci minha senha" fica para quando existir o
  módulo de e-mail.
- **Perfis globais**, sem perfil por licenciado nem autorização de dois níveis.

## Próximos passos sugeridos

1. Telas de Tenants e Perfis (a API de tenants já existe; perfis ainda são só
   leitura/seed).
2. Persistir documentos, conversas e chunks no MySQL, com um **vector store
   externo** (Qdrant/Pinecone) — o MySQL não tem busca vetorial indexada.
3. Providers reais de embedding/LLM atrás dos gateways existentes.
4. Fila real (BullMQ) no lugar do `InMemoryQueueClient`.
5. Telas do RAG: Documentos (upload + status) e Assistente (chat com citações).
6. Módulo de e-mail (senha temporária por e-mail, esqueci minha senha).
