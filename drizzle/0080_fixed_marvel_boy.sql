CREATE TABLE `meta_eficiencia_usuario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`metaEficiencia` int NOT NULL DEFAULT 80,
	`metaCumplimiento` int NOT NULL DEFAULT 80,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_eficiencia_usuario_id` PRIMARY KEY(`id`)
);
