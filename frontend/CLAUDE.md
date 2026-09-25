# CLAUDE.md — Frontend (Flutter) · GEDUC RAG

App Flutter Web. Stack: **flutter_modular** (DI + rotas) · **Dio** via
`ApiClient` · **flutter_secure_storage** (JWT) · **shared_preferences**
(preferências não sensíveis) · serialização JSON manual · **ChangeNotifier +
AnimatedBuilder** (estado) · **intl**.

Sem Riverpod, sem BLoC, sem `freezed`/`json_serializable`/`build_runner`.
Versão do Flutter via **FVM** (`.fvmrc`). Todo comando prefixado com `fvm`.

Base (tema, componentes, shell, auth) copiada do **geduc-suporte** — mesmas
regras de design system.

## Arquitetura

```text
lib/
  core/{auth,config,errors,http,routing,storage,tenancy,theme}/ + core_module.dart
  modules/<name>/{data,presentation}/ + <name>_module.dart
  shared/{components,utils}/
  app_module.dart · app_widget.dart · main.dart
```

- `data/` é o único lugar que fala HTTP (via `ApiClient`); modelos com
  `fromJson`/`toJson` à mão.
- Controller de lista = `addLazySingleton` no escopo do shell; controller de
  form = instanciado na página e descartado no `dispose`.
- Abas do shell seguem a **reancoragem**: `registerXBinds(c)` no `register` do
  `homeModule` e `registerXRoutes(r)` no `children` da rota do shell.

## Sessão, permissões e tenant

- `SessionService` é a fonte única da sessão: grava o JWT, popula o
  `PermissionService` e sincroniza o `TenantContext`.
- `PermissionService.can/canAny/canAll` — espelho da união de perfis do
  backend; SUPERADMIN libera tudo. Chaves em `core/auth/app_permissions.dart`
  (espelho de `backend/src/common/rbac/permissions.ts` — mudou lá, muda aqui).
- `TenantContext` guarda o tenant ativo (só entre os vínculos do usuário) e o
  `ApiClient` envia o header `tenant-id` automaticamente. Nenhuma tela monta
  esse header. Seletor no header do shell (`TenantSelector`).
- O frontend **apenas esconde UI**; a autoridade é o backend.

## Navegação

`Modular.to.navigate()` (substitui pilha) / `pushNamed()` (empilha). Menu
declarativo em `core/routing/nav_destinations.dart` (permission-aware).

## Widgets & Design System

- Widgets são classes, nunca funções `Widget _buildXxx()` soltas.
- Cores via `context.colors.*`, dimensões via `AppDimensions`, texto via
  `context.textStyles`. Nunca `Colors.*`/hex soltos.
- Feedback efêmero = `showAppToast` (SnackBar proibido). Erro de validação
  dentro de formulário/diálogo = `AppErrorBanner`.
- Campo novo de formulário vira componente em `shared/components/forms/`,
  compondo o `AppTextField`.

## Comandos

```bash
fvm flutter pub get
fvm flutter run -d chrome
fvm flutter analyze
fvm flutter test
```

## NUNCA FAÇA

1. Dio fora do `ApiClient` · 2. Token em `SharedPreferences` · 3. Lógica de
negócio em widgets · 4. `Navigator.push` direto · 5. `Map` montado fora de
`fromJson`/`toJson` · 6. `dynamic` em modelos/repos/controllers · 7. Widget
como função · 8. `print()` (use `debugPrint`) · 9. Header `tenant-id` montado
em tela.

## Code Standards

Inglês; máx 100 chars/linha, 300 linhas/arquivo, 40 linhas/função.
`snake_case` nos arquivos, `PascalCase` classes, `camelCase` membros.
