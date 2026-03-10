ALTER TABLE `firmas_reporte` MODIFY COLUMN `firmaBase64` longtext;--> statement-breakpoint
ALTER TABLE `incidentes_seguridad` MODIFY COLUMN `fotoBase64` longtext;--> statement-breakpoint
ALTER TABLE `incidentes_seguridad` MODIFY COLUMN `fotoMarcadaBase64` longtext;--> statement-breakpoint
ALTER TABLE `item_rondas` MODIFY COLUMN `fotoAntesBase64` longtext;--> statement-breakpoint
ALTER TABLE `item_rondas` MODIFY COLUMN `fotoAntesMarcadaBase64` longtext;--> statement-breakpoint
ALTER TABLE `item_rondas` MODIFY COLUMN `fotoDespuesBase64` longtext;--> statement-breakpoint
ALTER TABLE `items` MODIFY COLUMN `fotoAntesBase64` longtext;--> statement-breakpoint
ALTER TABLE `items` MODIFY COLUMN `fotoAntesMarcadaBase64` longtext;--> statement-breakpoint
ALTER TABLE `items` MODIFY COLUMN `fotoDespuesBase64` longtext;--> statement-breakpoint
ALTER TABLE `proyectos` MODIFY COLUMN `imagenPortadaBase64` longtext;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `fotoBase64` longtext;