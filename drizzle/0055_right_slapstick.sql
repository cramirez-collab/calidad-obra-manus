CREATE TABLE `planos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`nivel` int DEFAULT 0,
	`imagenUrl` text NOT NULL,
	`imagenKey` varchar(500),
	`descripcion` text,
	`orden` int DEFAULT 0,
	`activo` boolean NOT NULL DEFAULT true,
	`creadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planos_id` PRIMARY KEY(`id`)
);
