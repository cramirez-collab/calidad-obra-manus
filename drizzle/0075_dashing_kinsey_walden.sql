CREATE TABLE `plantillas_incidencia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`nombre` varchar(100) NOT NULL,
	`tipo_plantilla` enum('caida','golpe','corte','electrico','derrumbe','incendio','quimico','epp_faltante','condicion_insegura','acto_inseguro','casi_accidente','otro') NOT NULL,
	`severidad_plantilla` enum('baja','media','alta','critica') NOT NULL,
	`descripcion` text NOT NULL,
	`activo` boolean NOT NULL DEFAULT true,
	`orden` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plantillas_incidencia_id` PRIMARY KEY(`id`)
);
