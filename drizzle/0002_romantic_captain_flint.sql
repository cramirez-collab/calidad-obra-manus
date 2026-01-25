CREATE TABLE `comentarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`etapa` varchar(50) NOT NULL,
	`texto` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comentarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`itemId` int,
	`tipo` varchar(50) NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`mensaje` text,
	`leida` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificaciones_id` PRIMARY KEY(`id`)
);
