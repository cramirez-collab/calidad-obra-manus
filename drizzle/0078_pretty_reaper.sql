CREATE TABLE `programa_actividad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`programaId` int NOT NULL,
	`especialidad` varchar(255) NOT NULL,
	`actividad` varchar(500) NOT NULL,
	`nivel` varchar(100),
	`area` varchar(255),
	`referenciaEje` varchar(100),
	`unidad_medida` enum('m','m2','m3','ml','pza','kg','lt','jgo','lote','otro') NOT NULL DEFAULT 'm2',
	`cantidadProgramada` decimal(12,2) NOT NULL,
	`cantidadRealizada` decimal(12,2),
	`porcentajeAvance` decimal(5,2),
	`orden` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `programa_actividad_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `programa_plano` (
	`id` int AUTO_INCREMENT NOT NULL,
	`programaId` int NOT NULL,
	`nivel` varchar(100),
	`tipo_plano` enum('planta','fachada','corte','otro') NOT NULL DEFAULT 'planta',
	`titulo` varchar(255),
	`imagenUrl` text NOT NULL,
	`imagenKey` varchar(255),
	`orden` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `programa_plano_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `programa_semanal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`semanaInicio` timestamp NOT NULL,
	`semanaFin` timestamp NOT NULL,
	`fechaEntrega` timestamp,
	`fechaCorte` timestamp,
	`status_programa` enum('borrador','entregado','corte_realizado') NOT NULL DEFAULT 'borrador',
	`eficienciaGlobal` decimal(5,2),
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `programa_semanal_id` PRIMARY KEY(`id`)
);
