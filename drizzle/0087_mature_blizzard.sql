CREATE TABLE `buenas_practicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`descripcion` text,
	`categoria` varchar(100) NOT NULL,
	`prioridad` varchar(20) NOT NULL DEFAULT 'media',
	`estado` varchar(30) NOT NULL DEFAULT 'activa',
	`ubicacion` varchar(255),
	`empresaId` int,
	`creadoPorId` int NOT NULL,
	`aprobadoPorId` int,
	`fechaAprobacion` timestamp,
	`beneficio` text,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buenas_practicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidencias_bp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buenaPracticaId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`descripcion` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidencias_bp_id` PRIMARY KEY(`id`)
);
