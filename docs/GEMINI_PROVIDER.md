# Gemini Provider Setup

SUBBY uses the official `@google/genai` SDK exclusively on the server. Browser bundles, chat payloads, Git repositories, and application logs never receive `GEMINI_API_KEY`.

## Configure the Key

In the managed project, open **Settings → Secrets** and add `GEMINI_API_KEY`. For the VPS deployment, the key is copied only into the root-owned service environment file; it is never committed to source control.

## Optional Model Routing

SUBBY reads these optional server-only variables from one central provider configuration:

| Variable | Used for | Safe default |
| --- | --- | --- |
| `GEMINI_MODEL_FAST` | Fast and economy chat requests | `gemini-3.6-flash` |
| `GEMINI_MODEL_CODING` | Code explanation, file review, and code proposals | `gemini-3.6-flash` |
| `GEMINI_MODEL_REASONING` | Plans and complex project analysis | `gemini-3.6-flash` |

If a configured model is unavailable or has no quota, SUBBY attempts the safe Gemini Flash default once. If Gemini still cannot serve the request, it returns a user-friendly error and does not expose provider responses, keys, or internal tool access.

## Tool Boundaries

Gemini can advise SUBBY on repository context and approved change proposals. SUBBY itself enforces repository ownership, path safety, review state, and explicit confirmation before GitHub writes. Gemini never receives unrestricted shell, browser, database, or host-machine access.
