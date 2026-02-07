CREATE TABLE `avisos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int,
	`creadoPorId` int NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`contenido` text NOT NULL,
	`prioridad` enum('normal','urgente') NOT NULL DEFAULT 'normal',
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `avisos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `avisos_lecturas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`avisoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`leidoAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avisos_lecturas_id` PRIMARY KEY(`id`)
);
