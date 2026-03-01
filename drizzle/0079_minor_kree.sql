CREATE TABLE `programa_plantilla` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`descripcion` text,
	`actividades` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `programa_plantilla_id` PRIMARY KEY(`id`)
);
