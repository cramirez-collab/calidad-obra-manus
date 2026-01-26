CREATE TABLE `espacios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int,
	`unidadId` int,
	`nombre` varchar(255) NOT NULL,
	`codigo` varchar(50),
	`descripcion` text,
	`orden` int DEFAULT 0,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `espacios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `especialidades` ADD `residenteId` int;