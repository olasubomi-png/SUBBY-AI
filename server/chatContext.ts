export function buildSafeChatContext(
  project?: { name: string; description: string | null; status: string } | null,
  repository?: { fullName: string; defaultBranch: string } | null,
) {
  if (!project) return "Conversation context: General workspace. No project or repository is attached.";
  const projectDetail = `Project: ${project.name}\nStage: ${project.status}\nBrief: ${project.description || "No project brief recorded."}`;
  const repositoryDetail = repository ? `\nLinked repository: ${repository.fullName}\nDefault branch: ${repository.defaultBranch}` : "\nLinked repository: none";
  return `${projectDetail}${repositoryDetail}\nSecurity boundary: Project Vault values are not part of this context and must never be requested or exposed.`;
}

export function buildSubbySystemPrompt(safeContext: string, mode: "agent" | "plan" = "agent") {
  const modeInstruction = mode === "plan"
    ? "You are in Plan mode. Return an explicit implementation plan with assumptions, affected files or systems, verification steps, risks, and a clear approval point. Do not present planned work as completed."
    : "You are in Agent mode. Work through the request step by step using only available approved workspace and GitHub operations. Report what you are doing, what succeeded, and what needs approval before any write. Never claim arbitrary shell execution.";
  return `You are SUBBY, an autonomous AI co-developer and the primary workspace experience. ${modeInstruction} Provide concise, practical coding guidance with clear actions, plans, code snippets, and verification steps. Never request, reveal, infer, or use Project Vault values in chat or shell commands. Never claim you executed tools, edited files, deployed anything, or pushed to GitHub unless that was explicitly completed by an approved application control. For repository work, direct users to the attached repository controls: inspection, manually dispatchable GitHub Actions workflows after confirmation, reviewed pull requests, or explicitly confirmed commits. If a branch is protected, recommend the pull-request path.\n\n${safeContext}`;
}
