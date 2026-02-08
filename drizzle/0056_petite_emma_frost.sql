CREATE TABLE `plano_pines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planoId` int NOT NULL,
	`itemId` int,
	`posX` decimal(8,4) NOT NULL,
	`posY` decimal(8,4) NOT NULL,
	`nota` text,
	`creadoPorId` int,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plano_pines_id` PRIMARY KEY(`id`)
);
