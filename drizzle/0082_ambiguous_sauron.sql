CREATE TABLE `archivos_pago` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitudPagoId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`tamano` int,
	`tipo` varchar(50) NOT NULL DEFAULT 'adjunto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archivos_pago_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solicitudes_pago` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyectoId` int NOT NULL,
	`concepto` text NOT NULL,
	`monto` decimal(12,2) NOT NULL,
	`moneda` varchar(10) NOT NULL DEFAULT 'MXN',
	`proveedor` varchar(255),
	`noFactura` varchar(100),
	`notas` text,
	`statusPago` varchar(30) NOT NULL DEFAULT 'pendiente',
	`solicitanteId` int NOT NULL,
	`autorizadorId` int,
	`fechaAutorizacion` timestamp,
	`fechaEjecucion` timestamp,
	`motivoRechazo` text,
	`motivoCancelacion` text,
	`datosExtraidosIA` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `solicitudes_pago_id` PRIMARY KEY(`id`)
);
