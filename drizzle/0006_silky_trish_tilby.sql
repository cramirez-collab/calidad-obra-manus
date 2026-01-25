CREATE TABLE `defectos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`codigo` varchar(50),
	`descripcion` text,
	`especialidadId` int,
	`severidad` enum('leve','moderado','grave','critico') NOT NULL DEFAULT 'moderado',
	`tiempoEstimadoResolucion` int,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `defectos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `items` ADD `defectoId` int;