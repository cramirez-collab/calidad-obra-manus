CREATE TABLE `reportes_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`generadoPorId` int NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`markdown` text NOT NULL,
	`resumenCorto` text,
	`totalIncidentes` int DEFAULT 0,
	`abiertos` int DEFAULT 0,
	`enProceso` int DEFAULT 0,
	`prevencion` int DEFAULT 0,
	`cerrados` int DEFAULT 0,
	`totalSeguristas` int DEFAULT 0,
	`fotosEvidenciaUrls` text,
	`fechaGeneracion` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportes_seguridad_id` PRIMARY KEY(`id`)
);
