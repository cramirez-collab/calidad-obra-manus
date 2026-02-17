CREATE TABLE `catalogo_pruebas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`sistema` varchar(100) NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`descripcion` text,
	`orden` int NOT NULL DEFAULT 0,
	`requiereEvidencia` boolean NOT NULL DEFAULT true,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogo_pruebas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pruebas_bitacora` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`unidadId` int NOT NULL,
	`pruebaId` int NOT NULL,
	`resultadoId` int,
	`accion_bitacora` enum('evaluacion','correccion','liberacion','revocacion') NOT NULL,
	`intento_bitacora` enum('intento_1','intento_final') NOT NULL,
	`estadoAnterior` varchar(20),
	`estadoNuevo` varchar(20) NOT NULL,
	`observacion` text,
	`evidenciaUrl` text,
	`usuarioId` int NOT NULL,
	`usuarioNombre` varchar(255) NOT NULL,
	`hashActual` varchar(64) NOT NULL,
	`hashAnterior` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pruebas_bitacora_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pruebas_resultado` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`unidadId` int NOT NULL,
	`pruebaId` int NOT NULL,
	`intento` enum('intento_1','intento_final') NOT NULL,
	`estado_prueba` enum('verde','rojo','na','pendiente') NOT NULL DEFAULT 'pendiente',
	`observacion` text,
	`evidenciaUrl` text,
	`evidenciaKey` varchar(500),
	`evaluadoPorId` int NOT NULL,
	`evaluadoPorNombre` varchar(255),
	`evaluadoAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pruebas_resultado_id` PRIMARY KEY(`id`)
);
