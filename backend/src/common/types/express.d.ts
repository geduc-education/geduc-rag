import { AuthenticatedUser } from '../guards/jwt-auth.guard';

// Augmenta o Request do Express com o usuário autenticado (JwtAuthGuard) e o
// tenant validado (TenantGuard). Tipagem de `req` em um único ponto (sem `any`).
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      /** Presente só em rotas `@TenantScoped()`, após o `TenantGuard`. */
      tenantId?: string;
    }
  }
}

export {};
