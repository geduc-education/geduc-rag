-- CreateTable
-- Horários de aula da escola (ex.: "1ª aula 07:00–07:50"), válidos para
-- todos os dias da semana. `active_name` só tem valor enquanto o horário não
-- foi excluído: o unique `(school_id, active_name)` garante nome único entre
-- os horários vivos da escola e libera o nome após a exclusão lógica.
CREATE TABLE `school_lesson_slot` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `position` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `deleted_by_id` VARCHAR(191) NULL,
    `active_name` VARCHAR(60) AS (IF(`deleted_at` IS NULL, `name`, NULL)) STORED,

    UNIQUE INDEX `school_lesson_slot_school_id_active_name_key`(`school_id`, `active_name`),
    INDEX `school_lesson_slot_tenant_id_school_id_position_idx`(`tenant_id`, `school_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `school_lesson_slot` ADD CONSTRAINT `school_lesson_slot_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_lesson_slot` ADD CONSTRAINT `school_lesson_slot_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_lesson_slot` ADD CONSTRAINT `school_lesson_slot_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_lesson_slot` ADD CONSTRAINT `school_lesson_slot_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
-- A aula referencia o horário da escola; `start_time`/`end_time` seguem como
-- cópia gravada a cada escrita (a leitura prefere as horas do horário).
-- NULL só para aulas gravadas antes desta migration.
ALTER TABLE `weekly_schedule_lesson` ADD COLUMN `lesson_slot_id` VARCHAR(191) NULL AFTER `schedule_day_id`;

-- CreateIndex
CREATE INDEX `weekly_schedule_lesson_lesson_slot_id_idx` ON `weekly_schedule_lesson`(`lesson_slot_id`);

-- AddForeignKey
ALTER TABLE `weekly_schedule_lesson` ADD CONSTRAINT `weekly_schedule_lesson_lesson_slot_id_fkey` FOREIGN KEY (`lesson_slot_id`) REFERENCES `school_lesson_slot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
