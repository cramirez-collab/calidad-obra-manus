CREATE TABLE `reportes_ia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`tipo_reporte` enum('analisis_profundo','resumen_ejecutivo') NOT NULL DEFAULT 'analisis_profundo',
	`titulo` varchar(500) NOT NULL,
	`contenido` text NOT NULL,
	`resumenEjecutivo` text,
	`datosAnalizados` text,
	`pdfUrl` text,
	`pdfKey` varchar(500),
	`enviado` boolean NOT NULL DEFAULT false,
	`fechaEnvio` timestamp,
	`destinatariosEnvio` text,
	`version` int NOT NULL DEFAULT 1,
	`creadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportes_ia_id` PRIMARY KEY(`id`)
);
