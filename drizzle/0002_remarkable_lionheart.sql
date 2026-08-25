CREATE TABLE `workspaceFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`path` varchar(240) NOT NULL,
	`language` varchar(32) NOT NULL DEFAULT 'plaintext',
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaceFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaceFiles_project_path_unique` UNIQUE(`projectId`,`path`)
);
