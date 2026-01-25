CREATE TABLE `proyecto_usuarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`rolEnProyecto` enum('admin','supervisor','jefe_residente','residente') NOT NULL DEFAULT 'residente',
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proyecto_usuarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proyectos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`nombreReporte` varchar(255),
	`codigo` varchar(50),
	`descripcion` text,
	`logoUrl` text,
	`direccion` varchar(500),
	`cliente` varchar(255),
	`fechaInicio` timestamp,
	`fechaFin` timestamp,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proyectos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `empresas` ADD `proyectoId` int;--> statement-breakpoint
ALTER TABLE `especialidades` ADD `proyectoId` int;--> statement-breakpoint
ALTER TABLE `items` ADD `proyectoId` int;--> statement-breakpoint
ALTER TABLE `unidades` ADD `proyectoId` int;--> statement-breakpoint
ALTER TABLE `unidades` ADD `empresaId` int;