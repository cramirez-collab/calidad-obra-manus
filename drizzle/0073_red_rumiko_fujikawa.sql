CREATE TABLE `tipos_incidencia_custom` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`clave` varchar(100) NOT NULL,
	`label` varchar(150) NOT NULL,
	`icono` varchar(50) DEFAULT 'ClipboardList',
	`color` varchar(100) DEFAULT 'bg-gray-100 text-gray-700',
	`iconColor` varchar(50) DEFAULT 'text-gray-600',
	`activo` boolean NOT NULL DEFAULT true,
	`orden` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tipos_incidencia_custom_id` PRIMARY KEY(`id`)
);
