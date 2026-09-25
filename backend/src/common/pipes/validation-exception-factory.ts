import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

/**
 * `ValidationError.constraints` só expõe a mensagem já renderizada em inglês
 * (class-validator não repassa os argumentos do constraint ao exceptionFactory) —
 * por isso os tradutores abaixo extraem número/lista da mensagem original em vez
 * de recalcular a partir de metadata.
 */
type Translator = (property: string, originalMessage: string) => string;

const firstNumber = (message: string): string =>
  message.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '';

const valuesList = (message: string): string =>
  message.split(': ').slice(1).join(': ');

/** Um tradutor por constraint key do class-validator (ver decorators usados no projeto). */
const TRANSLATORS: Record<string, Translator> = {
  isString: (p) => `${p} deve ser um texto.`,
  isNotEmpty: (p) => `${p} não pode ser vazio.`,
  isDefined: (p) => `${p} é obrigatório.`,
  isBoolean: (p) => `${p} deve ser um valor booleano (true/false).`,
  isBooleanString: (p) => `${p} deve ser um texto booleano ("true"/"false").`,
  isInt: (p) => `${p} deve ser um número inteiro.`,
  isNumber: (p) => `${p} deve ser um número.`,
  isNumberString: (p) => `${p} deve ser um texto numérico.`,
  isArray: (p) => `${p} deve ser uma lista.`,
  isObject: (p) => `${p} deve ser um objeto.`,
  isEmail: (p) => `${p} deve ser um e-mail válido.`,
  isUuid: (p) => `${p} deve ser um UUID válido.`,
  isHexColor: (p) => `${p} deve ser uma cor hexadecimal válida.`,
  minLength: (p, m) => `${p} deve ter no mínimo ${firstNumber(m)} caracteres.`,
  maxLength: (p, m) => `${p} deve ter no máximo ${firstNumber(m)} caracteres.`,
  isLength: (p, m) => {
    if (m.includes('longer than or equal to')) {
      return `${p} deve ter no mínimo ${firstNumber(m)} caracteres.`;
    }
    if (m.includes('shorter than or equal to')) {
      return `${p} deve ter no máximo ${firstNumber(m)} caracteres.`;
    }
    return `${p} tem um tamanho inválido.`;
  },
  min: (p, m) => `${p} deve ser maior ou igual a ${firstNumber(m)}.`,
  max: (p, m) => `${p} deve ser menor ou igual a ${firstNumber(m)}.`,
  matches: (p) => `${p} está em um formato inválido.`,
  isIn: (p, m) => `${p} deve ser um dos seguintes valores: ${valuesList(m)}.`,
  isEnum: (p, m) => `${p} deve ser um dos seguintes valores: ${valuesList(m)}.`,
  // Gerada pelo forbidNonWhitelisted — a própria "property" já é o campo não permitido.
  whitelistValidation: (p) => `Campo não permitido: ${p}.`,
};

interface FlatConstraint {
  property: string;
  key: string;
  message: string;
}

/** Achata `children` (DTOs aninhados/@ValidateNested) em `pai.filho`, como o Nest faz internamente. */
function flatten(
  errors: ValidationError[],
  parentPath?: string,
): FlatConstraint[] {
  const result: FlatConstraint[] = [];
  for (const error of errors) {
    const property = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    for (const [key, message] of Object.entries(error.constraints ?? {})) {
      result.push({ property, key, message });
    }
    if (error.children?.length) {
      result.push(...flatten(error.children, property));
    }
  }
  return result;
}

/**
 * exceptionFactory do ValidationPipe global — traduz as mensagens default do
 * class-validator (sempre em inglês) para pt-br. Constraint sem tradutor
 * mapeado cai no fallback da mensagem original (nunca quebra a request).
 */
export function buildValidationException(
  errors: ValidationError[],
): BadRequestException {
  const message = flatten(errors).map(
    ({ property, key, message: original }) => {
      const translate = TRANSLATORS[key];
      return translate ? translate(property, original) : original;
    },
  );

  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}
