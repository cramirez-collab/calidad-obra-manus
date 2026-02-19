CREATE TABLE `bitacora_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidenteId` int NOT NULL,
	`proyectoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`accion_bitacora` enum('creacion','cambio_estado','asignacion','edicion','eliminacion_mensaje','nota_voz','foto_enviada','foto_marcada','mensaje_enviado','exportar_pdf','cambio_severidad') NOT NULL,
	`detalle` text,
	`valorAnterior` text,
	`valorNuevo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bitacora_seguridad_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `incidentes_seguridad` ADD `asignadoA` int;