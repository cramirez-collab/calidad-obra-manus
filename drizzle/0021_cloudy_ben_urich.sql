ALTER TABLE `proyecto_usuarios` MODIFY COLUMN `rolEnProyecto` enum('admin','supervisor','jefe_residente','residente','desarrollador') NOT NULL DEFAULT 'residente';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('superadmin','admin','supervisor','jefe_residente','residente','desarrollador') NOT NULL DEFAULT 'residente';--> statement-breakpoint
ALTER TABLE `empresas` ADD `residenteId` int;--> statement-breakpoint
ALTER TABLE `empresas` ADD `jefeResidenteId` int;