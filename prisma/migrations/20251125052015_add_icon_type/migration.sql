/*
  Warnings:

  - The values [CHECKBOX,RADIO,CHECK,CROSS] on the enum `pdf_inputs_inputType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `fontSize` on the `pdf_inputs` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `pdf_inputs` ADD COLUMN `iconColor` VARCHAR(191) NULL DEFAULT '#000000',
    ADD COLUMN `iconVariant` VARCHAR(191) NULL DEFAULT 'CHECK',
    MODIFY `inputType` ENUM('TEXT', 'DATE', 'NUMBER', 'EMAIL', 'ICON', 'SIGNATURE', 'IMAGE') NOT NULL,
    MODIFY `fontSize` DOUBLE NOT NULL DEFAULT 12;
