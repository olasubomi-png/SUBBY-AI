CREATE TABLE `githubConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`githubLogin` varchar(120) NOT NULL,
	`tokenCiphertext` text NOT NULL,
	`tokenIv` varchar(64) NOT NULL,
	`tokenAuthTag` varchar(64) NOT NULL,
	`refreshCiphertext` text,
	`refreshIv` varchar(64),
	`refreshAuthTag` varchar(64),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `githubConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `githubConnections_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `githubOAuthStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`codeVerifier` varchar(160) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `githubOAuthStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `githubOAuthStates_stateHash_unique` UNIQUE(`stateHash`)
);
--> statement-breakpoint
CREATE TABLE `githubRepositories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`connectionId` int NOT NULL,
	`owner` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`fullName` varchar(300) NOT NULL,
	`defaultBranch` varchar(120) NOT NULL,
	`isPrivate` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `githubRepositories_id` PRIMARY KEY(`id`),
	CONSTRAINT `githubRepositories_projectId_unique` UNIQUE(`projectId`),
	CONSTRAINT `githubRepositories_connection_full_name_unique` UNIQUE(`connectionId`,`fullName`)
);
