CREATE TABLE `projectSecrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` varchar(64) NOT NULL,
	`authTag` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectSecrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectSecrets_project_name_unique` UNIQUE(`projectId`,`name`)
);
