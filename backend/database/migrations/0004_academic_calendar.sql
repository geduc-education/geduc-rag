-- CreateTable
CREATE TABLE `school` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `deleted_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `school_tenant_id_name_key`(`tenant_id`, `name`),
    INDEX `school_tenant_id_active_idx`(`tenant_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_calendar` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `school_year` SMALLINT NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `all_schools` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `deleted_by_id` VARCHAR(191) NULL,

    INDEX `academic_calendar_tenant_id_school_year_idx`(`tenant_id`, `school_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_calendar_school` (
    `calendar_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NOT NULL,

    INDEX `academic_calendar_school_school_id_idx`(`school_id`),
    PRIMARY KEY (`calendar_id`, `school_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_calendar_day` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `calendar_id` VARCHAR(191) NOT NULL,
    `day_date` DATE NOT NULL,
    `day_type` ENUM('SCHOOL_DAY', 'NON_SCHOOL_DAY', 'OPTIONAL_DAY', 'LESSON_PLANNING', 'TEACHER_TRAINING') NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `academic_calendar_day_calendar_id_day_date_key`(`calendar_id`, `day_date`),
    INDEX `academic_calendar_day_tenant_id_calendar_id_day_date_idx`(`tenant_id`, `calendar_id`, `day_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `school` ADD CONSTRAINT `school_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school` ADD CONSTRAINT `school_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school` ADD CONSTRAINT `school_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar` ADD CONSTRAINT `academic_calendar_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar` ADD CONSTRAINT `academic_calendar_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar` ADD CONSTRAINT `academic_calendar_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar_school` ADD CONSTRAINT `academic_calendar_school_calendar_id_fkey` FOREIGN KEY (`calendar_id`) REFERENCES `academic_calendar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar_school` ADD CONSTRAINT `academic_calendar_school_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar_day` ADD CONSTRAINT `academic_calendar_day_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar_day` ADD CONSTRAINT `academic_calendar_day_calendar_id_fkey` FOREIGN KEY (`calendar_id`) REFERENCES `academic_calendar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_calendar_day` ADD CONSTRAINT `academic_calendar_day_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
