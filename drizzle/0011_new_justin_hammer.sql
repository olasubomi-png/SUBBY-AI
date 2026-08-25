CREATE TABLE `proposalReviewComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewFileId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`lineNumber` int,
	`side` enum('old','new') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposalReviewComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowRunSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`repositoryId` int,
	`branch` varchar(255) NOT NULL,
	`runId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL,
	`conclusion` varchar(32),
	`event` varchar(64),
	`runNumber` int,
	`url` varchar(1000) NOT NULL,
	`createdAtGithub` timestamp NOT NULL,
	`updatedAtGithub` timestamp NOT NULL,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflowRunSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflowRunSnapshots_user_repo_run_unique` UNIQUE(`userId`,`repositoryId`,`runId`)
);
