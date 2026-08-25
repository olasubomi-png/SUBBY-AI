export type ReviewedFileChange = {
  path: string;
  content: string;
  commitMessage: string;
  summary: string;
  baseSha?: string;
};

export type GitTreeBlob = {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
};

export function normalizeReviewedChanges(changes: ReviewedFileChange[], maxFiles = 8) {
  const unique = new Map<string, ReviewedFileChange>();
  for (const change of changes) {
    const path = change.path.trim().replace(/^\/+/, "");
    if (!path || path.includes("..") || path.startsWith(".git/")) continue;
    unique.set(path, {
      path,
      content: change.content,
      commitMessage: change.commitMessage.trim(),
      summary: change.summary.trim(),
      ...(change.baseSha ? { baseSha: change.baseSha } : {}),
    });
  }
  return Array.from(unique.values()).slice(0, maxFiles);
}

export function buildGitTreeBlobs(changes: ReviewedFileChange[], blobShas: string[]): GitTreeBlob[] {
  return changes.map((change, index) => ({
    path: change.path,
    mode: "100644" as const,
    type: "blob" as const,
    sha: blobShas[index],
  }));
}

export function combinedCommitMessage(changes: ReviewedFileChange[]) {
  const first = changes[0]?.commitMessage || "Apply reviewed SUBBY changes";
  return changes.length === 1 ? first : `${first} (+${changes.length - 1} reviewed file${changes.length === 2 ? "" : "s"})`;
}

export function combinedSummary(changes: ReviewedFileChange[]) {
  return changes.map((change) => `- ${change.path}: ${change.summary}`).join("\n");
}
