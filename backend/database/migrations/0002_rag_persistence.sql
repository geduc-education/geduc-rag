-- CreateTable
CREATE TABLE `document` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'pending',
    `error_message` VARCHAR(500) NULL,
    `embedding_model` VARCHAR(191) NULL,
    `embedding_version` VARCHAR(20) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `document_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_chunk` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `embedding` BLOB NOT NULL,
    `dimensions` INTEGER NOT NULL,
    `embedding_model` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_chunk_tenant_id_dimensions_idx`(`tenant_id`, `dimensions`),
    INDEX `document_chunk_document_id_idx`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `conversation_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_message` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `role` ENUM('user', 'assistant') NOT NULL,
    `content` TEXT NOT NULL,
    `citations` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_message_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document` ADD CONSTRAINT `document_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document` ADD CONSTRAINT `document_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_chunk` ADD CONSTRAINT `document_chunk_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_message` ADD CONSTRAINT `conversation_message_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

