-- AddColumn isActive and updatedAt to api_keys table
ALTER TABLE `api_keys` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `api_keys` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
