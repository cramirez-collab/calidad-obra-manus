ALTER TABLE `mensajes` ADD `tipo` enum('texto','foto') DEFAULT 'texto' NOT NULL;--> statement-breakpoint
ALTER TABLE `mensajes` ADD `fotoUrl` text;