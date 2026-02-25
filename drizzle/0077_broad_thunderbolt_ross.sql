CREATE TABLE `mensaje_reacciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mensajeId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mensaje_reacciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mensajes` ADD `tipo` enum('texto','voz','foto') DEFAULT 'texto' NOT NULL;--> statement-breakpoint
ALTER TABLE `mensajes` ADD `fotoUrl` text;