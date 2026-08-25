CREATE TABLE `proposalReviewFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`path` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`summary` varchar(1000) NOT NULL,
	`commitMessage` varchar(200) NOT NULL,
	`baseSha` varchar(200) NOT NULL,
	`state` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposalReviewFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `proposalReviewFiles_review_path_unique` UNIQUE(`reviewId`,`path`)
);
--> statement-breakpoint
CREATE TABLE `proposalReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`sessionId` int NOT NULL,
	`repositoryId` int,
	`branch` varchar(255) NOT NULL,
	`state` enum('open','approved','rejected','expired') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposalReviews_id` PRIMARY KEY(`id`)
);
