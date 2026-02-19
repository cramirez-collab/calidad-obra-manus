CREATE TABLE `notas_voz_seguridad` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proyecto_id` int NOT NULL,
	`incidente_id` int,
	`creado_por_id` int NOT NULL,
	`audio_url` text,
	`transcripcion` text,
	`bullets` text,
	`duracion_segundos` int,
	`fecha_creacion` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notas_voz_seguridad_id` PRIMARY KEY(`id`)
);
