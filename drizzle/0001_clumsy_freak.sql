CREATE TABLE `atributos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`categoria` varchar(100),
	`descripcion` text,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atributos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`rfc` varchar(20),
	`contacto` varchar(255),
	`telefono` varchar(20),
	`email` varchar(320),
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empresas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `especialidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`codigo` varchar(50),
	`descripcion` text,
	`color` varchar(7) DEFAULT '#3B82F6',
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `especialidades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_historial` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`statusAnterior` varchar(50),
	`statusNuevo` varchar(50) NOT NULL,
	`comentario` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_historial_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`qrCode` varchar(255),
	`empresaId` int NOT NULL,
	`unidadId` int NOT NULL,
	`especialidadId` int NOT NULL,
	`atributoId` int,
	`residenteId` int NOT NULL,
	`jefeResidenteId` int,
	`supervisorId` int,
	`titulo` varchar(255) NOT NULL,
	`descripcion` text,
	`ubicacionDetalle` varchar(255),
	`fotoAntesUrl` text,
	`fotoAntesKey` varchar(255),
	`fotoAntesMarcadaUrl` text,
	`fotoAntesMarcadaKey` varchar(255),
	`fotoDespuesUrl` text,
	`fotoDespuesKey` varchar(255),
	`status` enum('pendiente_foto_despues','pendiente_aprobacion','aprobado','rechazado') NOT NULL DEFAULT 'pendiente_foto_despues',
	`fechaCreacion` timestamp NOT NULL DEFAULT (now()),
	`fechaFotoDespues` timestamp,
	`fechaAprobacion` timestamp,
	`comentarioResidente` text,
	`comentarioJefeResidente` text,
	`comentarioSupervisor` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `items_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `unidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`codigo` varchar(50),
	`descripcion` text,
	`ubicacion` varchar(255),
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unidades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','supervisor','jefe_residente','residente') NOT NULL DEFAULT 'residente';--> statement-breakpoint
ALTER TABLE `users` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `activo` boolean DEFAULT true NOT NULL;