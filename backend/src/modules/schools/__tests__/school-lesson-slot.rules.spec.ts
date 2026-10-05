import { HttpException } from '@nestjs/common';
import {
  assertNoSlotOverlap,
  assertSlotRange,
  nextSlotPosition,
} from '../school-lesson-slot.rules';

function codeOf(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const body = (error as HttpException).getResponse() as { code: string };
    return { status: (error as HttpException).getStatus(), code: body.code };
  }
  return undefined;
}

function slot(id: string, startTime: string, endTime: string, position = 1) {
  return { id, startTime, endTime, position };
}

describe('school-lesson-slot.rules', () => {
  it('assertSlotRange exige fim maior que início', () => {
    expect(codeOf(() => assertSlotRange('07:00', '07:50'))).toBeUndefined();
    expect(codeOf(() => assertSlotRange('07:50', '07:50'))).toEqual({
      status: 400,
      code: 'LESSON_SLOT_INVALID_RANGE',
    });
    expect(codeOf(() => assertSlotRange('08:00', '07:50'))).toEqual({
      status: 400,
      code: 'LESSON_SLOT_INVALID_RANGE',
    });
  });

  it('assertNoSlotOverlap recusa horário que cruza outro da escola', () => {
    const others = [slot('a', '07:00', '07:50'), slot('b', '07:50', '08:40')];

    expect(
      codeOf(() =>
        assertNoSlotOverlap({ startTime: '08:40', endTime: '09:30' }, others),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        assertNoSlotOverlap({ startTime: '07:30', endTime: '08:00' }, others),
      ),
    ).toEqual({ status: 409, code: 'LESSON_SLOT_OVERLAP' });
    expect(
      codeOf(() =>
        assertNoSlotOverlap({ startTime: '06:00', endTime: '10:00' }, others),
      ),
    ).toEqual({ status: 409, code: 'LESSON_SLOT_OVERLAP' });
  });

  it('assertNoSlotOverlap ignora o próprio horário na edição', () => {
    const others = [slot('a', '07:00', '07:50'), slot('b', '07:50', '08:40')];

    expect(
      codeOf(() =>
        assertNoSlotOverlap(
          { startTime: '07:00', endTime: '07:45' },
          others,
          'a',
        ),
      ),
    ).toBeUndefined();
  });

  it('nextSlotPosition devolve a maior posição + 1 (1 sem horários)', () => {
    expect(nextSlotPosition([])).toBe(1);
    expect(
      nextSlotPosition([
        slot('a', '07:00', '07:50', 3),
        slot('b', '07:50', '08:40', 1),
      ]),
    ).toBe(4);
  });
});
