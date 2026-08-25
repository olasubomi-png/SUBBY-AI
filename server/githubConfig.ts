export function isGitHubOAuthConfigured(
  clientId = process.env.GITHUB_CLIENT_ID ?? "",
  clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "",
) {
  return clientId.trim().length > 0 && clientSecret.trim().length > 0;
}
