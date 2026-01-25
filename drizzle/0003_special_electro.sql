CREATE TABLE `bitacora` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`accion` varchar(100) NOT NULL,
	`entidad` varchar(50),
	`entidadId` int,
	`detalles` text,
	`ip` varchar(45),
	`userAgent` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bitacora_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clave` varchar(100) NOT NULL,
	`valor` text,
	`descripcion` varchar(255),
	`soloSuperadmin` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracion_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracion_clave_unique` UNIQUE(`clave`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('superadmin','admin','supervisor','jefe_residente','residente') NOT NULL DEFAULT 'residente';