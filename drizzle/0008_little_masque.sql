CREATE TABLE `auditoria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`usuarioNombre` varchar(255),
	`usuarioRol` varchar(50),
	`accion` varchar(100) NOT NULL,
	`categoria` varchar(50) NOT NULL,
	`entidadTipo` varchar(50),
	`entidadId` int,
	`entidadCodigo` varchar(100),
	`valorAnterior` text,
	`valorNuevo` text,
	`detalles` text,
	`ip` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditoria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mensajes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`texto` text NOT NULL,
	`menciones` text,
	`editado` boolean NOT NULL DEFAULT false,
	`eliminado` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mensajes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`rechazados` int NOT NULL DEFAULT 0,
	`aprobadosJefe` int NOT NULL DEFAULT 0,
	`aprobadosSupervisor` int NOT NULL DEFAULT 0,
	`mensajesNoLeidos` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_badges_usuarioId_unique` UNIQUE(`usuarioId`)
);
