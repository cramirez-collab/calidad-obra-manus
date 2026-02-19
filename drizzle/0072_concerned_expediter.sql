CREATE TABLE `evidencias_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidenteId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`fotoUrl` text NOT NULL,
	`descripcion` text,
	`tipo_evidencia` enum('seguimiento','resolucion','prevencion') NOT NULL DEFAULT 'seguimiento',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidencias_seguridad_id` PRIMARY KEY(`id`)
);
