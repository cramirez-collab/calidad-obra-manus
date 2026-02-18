CREATE TABLE `checklist_items_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checklistId` int NOT NULL,
	`categoria` varchar(100) NOT NULL,
	`pregunta` varchar(500) NOT NULL,
	`cumple_check` enum('si','no','na') NOT NULL DEFAULT 'na',
	`observacion` text,
	`orden` int NOT NULL DEFAULT 0,
	CONSTRAINT `checklist_items_seguridad_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklists_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`creadoPor` int NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`ubicacion` varchar(255),
	`unidadId` int,
	`completado` boolean NOT NULL DEFAULT false,
	`puntajeTotal` int DEFAULT 0,
	`puntajeObtenido` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklists_seguridad_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidentes_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`reportadoPor` int NOT NULL,
	`tipo_incidente` enum('caida','golpe','corte','electrico','derrumbe','incendio','quimico','epp_faltante','condicion_insegura','acto_inseguro','casi_accidente','otro') NOT NULL,
	`severidad_incidente` enum('baja','media','alta','critica') NOT NULL,
	`descripcion` text NOT NULL,
	`ubicacion` varchar(255),
	`unidadId` int,
	`fotoUrl` text,
	`fotoBase64` text,
	`estado_incidente` enum('abierto','en_proceso','cerrado') NOT NULL DEFAULT 'abierto',
	`accionCorrectiva` text,
	`cerradoPor` int,
	`fechaCierre` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidentes_seguridad_id` PRIMARY KEY(`id`)
);
