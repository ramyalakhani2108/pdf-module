-- Add missing columns that were added to schema but not migrated
ALTER TABLE `pdf_inputs` 
    ADD COLUMN `defaultVisible` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `borderRadius` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `borderEnabled` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `borderWidth` DOUBLE NULL DEFAULT 1,
    ADD COLUMN `borderStyle` VARCHAR(191) NULL DEFAULT 'solid',
    ADD COLUMN `borderColor` VARCHAR(191) NULL DEFAULT '#000000',
    ADD COLUMN `imageFit` VARCHAR(191) NULL DEFAULT 'contain',
    ADD COLUMN `placeholder` VARCHAR(191) NULL;

-- Update FILLABLE to inputType enum if not exists
ALTER TABLE `pdf_inputs` MODIFY `inputType` ENUM('TEXT', 'DATE', 'NUMBER', 'EMAIL', 'ICON', 'SIGNATURE', 'IMAGE', 'FILLABLE') NOT NULL;

-- Update all ICON fields to have defaultVisible = false
UPDATE `pdf_inputs` 
SET `defaultVisible` = false 
WHERE `inputType` = 'ICON';
