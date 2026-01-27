CREATE TABLE `empresa_residentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`tipoResidente` enum('residente','jefe_residente') NOT NULL DEFAULT 'residente',
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empresa_residentes_id` PRIMARY KEY(`id`)
);
