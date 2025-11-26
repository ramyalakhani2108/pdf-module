-- Update all ICON fields to have defaultVisible = false
UPDATE `pdf_inputs` 
SET `defaultVisible` = false 
WHERE `inputType` = 'ICON' AND (`defaultVisible` IS NULL OR `defaultVisible` = true);
