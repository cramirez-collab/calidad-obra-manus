CREATE TABLE `empresa_especialidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`especialidadId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empresa_especialidades_id` PRIMARY KEY(`id`)
);
