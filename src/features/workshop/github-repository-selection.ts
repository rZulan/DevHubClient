import type {GitHubSelection} from "./github-api"

export function readGitHubSelections(value: FormDataEntryValue | null): GitHubSelection[] {
    return value ? JSON.parse(String(value)) as GitHubSelection[] : []
}
