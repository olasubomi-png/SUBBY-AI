CREATE TABLE `commandDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`command` varchar(500) NOT NULL,
	`description` varchar(1000),
	`state` enum('draft','review','ready') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deploymentPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`environment` enum('development','staging','production') NOT NULL,
	`targetUrl` varchar(500),
	`state` enum('planned','ready','released') NOT NULL DEFAULT 'planned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deploymentPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mediaAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`kind` enum('image') NOT NULL DEFAULT 'image',
	`prompt` text NOT NULL,
	`url` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mediaAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repositoryProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`remoteUrl` varchar(500),
	`defaultBranch` varchar(120) NOT NULL DEFAULT 'main',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `repositoryProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `repositoryProfiles_project_unique` UNIQUE(`projectId`)
);
