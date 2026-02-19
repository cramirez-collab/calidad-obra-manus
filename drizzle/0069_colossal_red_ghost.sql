ALTER TABLE `mensajes_seguridad` MODIFY COLUMN `tipo` enum('texto','voz','foto') NOT NULL DEFAULT 'texto';--> statement-breakpoint
ALTER TABLE `mensajes_seguridad` ADD `foto_url` text;