CREATE TABLE `githubAuthAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`githubId` varchar(64) NOT NULL,
	`githubLogin` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `githubAuthAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `githubAuthAccounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `githubAuthAccounts_githubId_unique` UNIQUE(`githubId`)
);
--> statement-breakpoint
CREATE TABLE `passwordCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `passwordCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordCredentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `passwordCredentials_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `githubOAuthStates` MODIFY COLUMN `userId` int;--> statement-breakpoint
ALTER TABLE `githubOAuthStates` ADD `intent` enum('connection','login') DEFAULT 'connection' NOT NULL;