CREATE TABLE `mensajes_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidente_id` int NOT NULL,
	`usuario_id` int NOT NULL,
	`texto` text NOT NULL,
	`audio_url` text,
	`transcripcion` text,
	`bullets` text,
	`duracion_segundos` int,
	`tipo` enum('texto','voz') NOT NULL DEFAULT 'texto',
	`editado` boolean NOT NULL DEFAULT false,
	`eliminado` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mensajes_seguridad_id` PRIMARY KEY(`id`)
);
