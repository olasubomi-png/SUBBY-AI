export function selectRepositoryBranch(branches: string[], requestedBranch?: string, fallbackBranch = "main") {
  if (requestedBranch && branches.includes(requestedBranch)) return requestedBranch;
  if (branches.includes(fallbackBranch)) return fallbackBranch;
  return branches[0] ?? fallbackBranch;
}
