CREATE TABLE `analisis_8ms_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`programaId` int NOT NULL,
	`especialidad` varchar(255) NOT NULL,
	`itemsHash` varchar(64) NOT NULL,
	`resultado` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analisis_8ms_cache_id` PRIMARY KEY(`id`)
);
