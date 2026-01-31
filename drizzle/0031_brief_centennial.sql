CREATE TABLE `empresa_historial` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`usuarioNombre` varchar(255),
	`tipoAccion` enum('empresa_creada','empresa_editada','usuario_agregado','usuario_eliminado','usuario_rol_cambiado','defecto_agregado','defecto_editado','defecto_eliminado','especialidad_cambiada') NOT NULL,
	`descripcion` text NOT NULL,
	`valorAnterior` text,
	`valorNuevo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empresa_historial_id` PRIMARY KEY(`id`)
);
