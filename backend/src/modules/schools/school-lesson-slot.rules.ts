import { BadRequestException, ConflictException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';

/**
 * Regras puras dos horários de aula da escola — sem I/O. Horas em `HH:mm`
 * (com zero à esquerda), por isso a comparação de texto é cronológica.
 */

export interface SlotRange {
  startTime: string;
  endTime: string;
}

export interface PositionedSlot extends SlotRange {
  id: string;
  position: number;
}

/** Fim estritamente maior que o início. */
export function assertSlotRange(startTime: string, endTime: string): void {
  if (startTime < endTime) return;
  throw new BadRequestException({
    code: ERROR_CODES.LESSON_SLOT_INVALID_RANGE,
    message: 'O fim do horário deve ser posterior ao início.',
  });
}

/** Encostar (fim de um = início do outro) não é sobreposição. */
export function assertNoSlotOverlap(
  candidate: SlotRange,
  others: readonly PositionedSlot[],
  selfId?: string,
): void {
  const crossed = others.find(
    (other) =>
      other.id !== selfId &&
      candidate.startTime < other.endTime &&
      other.startTime < candidate.endTime,
  );
  if (!crossed) return;
  throw new ConflictException({
    code: ERROR_CODES.LESSON_SLOT_OVERLAP,
    message: `O horário cruza ${crossed.startTime}–${crossed.endTime} da escola.`,
  });
}

/** Maior posição + 1; 1 para a escola sem horários. */
export function nextSlotPosition(slots: readonly PositionedSlot[]): number {
  return slots.reduce((max, slot) => Math.max(max, slot.position), 0) + 1;
}
