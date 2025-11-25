-- CreateTable
CREATE TABLE `pdf_files` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `pageCount` INTEGER NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pdf_files_filePath_key`(`filePath`),
    INDEX `pdf_files_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdf_inputs` (
    `id` VARCHAR(191) NOT NULL,
    `pdfFileId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `inputType` ENUM('TEXT', 'DATE', 'NUMBER', 'EMAIL', 'CHECKBOX', 'RADIO', 'SIGNATURE', 'IMAGE') NOT NULL,
    `pageNumber` INTEGER NOT NULL,
    `xCoord` DOUBLE NOT NULL,
    `yCoord` DOUBLE NOT NULL,
    `width` DOUBLE NOT NULL,
    `height` DOUBLE NOT NULL,
    `fontSize` INTEGER NOT NULL DEFAULT 12,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pdf_inputs_pdfFileId_idx`(`pdfFileId`),
    INDEX `pdf_inputs_pageNumber_idx`(`pageNumber`),
    UNIQUE INDEX `pdf_inputs_pdfFileId_slug_key`(`pdfFileId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signature_images` (
    `id` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `signature_images_filePath_key`(`filePath`),
    INDEX `signature_images_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pdf_inputs` ADD CONSTRAINT `pdf_inputs_pdfFileId_fkey` FOREIGN KEY (`pdfFileId`) REFERENCES `pdf_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
