-- AlterTable
ALTER TABLE `pdf_inputs` ADD COLUMN `fontFamily` VARCHAR(191) NULL DEFAULT 'Arial, sans-serif',
    ADD COLUMN `fontStyle` VARCHAR(191) NULL DEFAULT 'normal',
    ADD COLUMN `fontWeight` VARCHAR(191) NULL DEFAULT 'normal',
    ADD COLUMN `textAlign` VARCHAR(191) NULL DEFAULT 'left',
    ADD COLUMN `textColor` VARCHAR(191) NULL DEFAULT '#000000';
