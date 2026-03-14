CREATE TABLE `asistente_conversaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`proyectoId` int,
	`pregunta` text NOT NULL,
	`respuesta` text NOT NULL,
	`categoria` varchar(100) DEFAULT 'general',
	`util` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asistente_conversaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asistente_sugerencias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`descripcion` text NOT NULL,
	`categoria` varchar(100) NOT NULL,
	`frecuencia` int NOT NULL DEFAULT 1,
	`estado` varchar(50) NOT NULL DEFAULT 'pendiente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asistente_sugerencias_id` PRIMARY KEY(`id`)
);
