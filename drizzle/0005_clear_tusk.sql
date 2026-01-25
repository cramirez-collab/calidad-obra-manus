CREATE TABLE `metas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`descripcion` text,
	`tipo` varchar(50) NOT NULL,
	`valorObjetivo` int NOT NULL,
	`unidadMedida` varchar(50),
	`empresaId` int,
	`unidadId` int,
	`fechaInicio` timestamp,
	`fechaFin` timestamp,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_id` PRIMARY KEY(`id`)
);
