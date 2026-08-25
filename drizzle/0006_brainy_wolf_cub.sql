CREATE TABLE `chatSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`title` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatMessages` ADD `sessionId` int;