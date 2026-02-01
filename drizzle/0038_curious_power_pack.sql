CREATE TABLE `actividad_usuarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`proyectoId` int NOT NULL,
	`tipoActividad` enum('click_calidad','click_secuencias','crear_item','subir_foto_despues','aprobar_item','rechazar_item') NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actividad_usuarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`grupoUrl` text,
	`apiKey` varchar(255),
	`activo` boolean NOT NULL DEFAULT true,
	`ultimoEnvio` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_config_proyectoId_unique` UNIQUE(`proyectoId`)
);
