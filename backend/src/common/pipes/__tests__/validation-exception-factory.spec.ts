import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ChangePasswordDto } from '../../../modules/auth/dto/change-password.dto';
import { buildValidationException } from '../validation-exception-factory';

const makeError = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => {
  const error = new ValidationError();
  error.property = property;
  error.constraints = constraints;
  error.children = children;
  return error;
};

describe('buildValidationException', () => {
  it('traduz isString/isNotEmpty para pt-br', () => {
    const exception = buildValidationException([
      makeError('currentPassword', {
        isString: 'currentPassword must be a string',
        isNotEmpty: 'currentPassword should not be empty',
      }),
    ]);

    const body = exception.getResponse() as { code: string; message: string[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toEqual([
      'currentPassword deve ser um texto.',
      'currentPassword não pode ser vazio.',
    ]);
  });

  it('extrai o número de minLength/maxLength da mensagem original', () => {
    const exception = buildValidationException([
      makeError('confirmPassword', {
        minLength:
          'confirmPassword must be longer than or equal to 8 characters',
      }),
    ]);

    const body = exception.getResponse() as { message: string[] };
    expect(body.message).toEqual([
      'confirmPassword deve ter no mínimo 8 caracteres.',
    ]);
  });

  it('extrai a lista de valores de isEnum/isIn', () => {
    const exception = buildValidationException([
      makeError('status', {
        isEnum: 'status must be one of the following values: OPEN, CLOSED',
      }),
    ]);

    const body = exception.getResponse() as { message: string[] };
    expect(body.message).toEqual([
      'status deve ser um dos seguintes valores: OPEN, CLOSED.',
    ]);
  });

  it('traduz whitelistValidation (forbidNonWhitelisted) usando o nome do campo', () => {
    const exception = buildValidationException([
      makeError('extraField', {
        whitelistValidation: 'property extraField should not exist',
      }),
    ]);

    const body = exception.getResponse() as { message: string[] };
    expect(body.message).toEqual(['Campo não permitido: extraField.']);
  });

  it('cai no fallback (mensagem original) para constraint sem tradutor mapeado', () => {
    const exception = buildValidationException([
      makeError('custom', {
        someUnknownConstraint: 'custom failed some unknown constraint',
      }),
    ]);

    const body = exception.getResponse() as { message: string[] };
    expect(body.message).toEqual(['custom failed some unknown constraint']);
  });

  it('achata children (DTO aninhado / @ValidateNested) em pai.filho', () => {
    const exception = buildValidationException([
      makeError('address', undefined as unknown as Record<string, string>, [
        makeError('zip', { isString: 'zip must be a string' }),
      ]),
    ]);

    const body = exception.getResponse() as { message: string[] };
    expect(body.message).toEqual(['address.zip deve ser um texto.']);
  });

  // Integração com o class-validator de verdade (não os ValidationError
  // construídos à mão acima) — é o bug original: ChangePasswordDto exige
  // confirmPassword e o payload do frontend não enviava o campo.
  it('traduz os erros reais do class-validator ao faltar confirmPassword', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'senha-atual',
      newPassword: 'novaSenha123',
      // confirmPassword ausente de propósito
    });

    const errors = await validate(dto);
    const exception = buildValidationException(errors);

    const body = exception.getResponse() as { code: string; message: string[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toEqual(
      expect.arrayContaining([
        'confirmPassword deve ser um texto.',
        'confirmPassword deve ter no mínimo 8 caracteres.',
      ]),
    );
    expect(body.message.some((m) => /[a-z]+ (must|should)/.test(m))).toBe(
      false,
    );
  });
});
