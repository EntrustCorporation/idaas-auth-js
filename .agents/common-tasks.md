# Common Tasks for AI Agents

Linked from `AGENTS.md`. Step-by-step playbooks for recurring changes to this SDK.

### Adding a New Authentication Method

1. Check if it exists in OpenAPI types (`src/models/openapi-ts/`)
2. Add method-specific types to `src/models/index.ts`
3. Update `RbaClient` or `AuthClient` with the new method logic
4. Add a manual test page in `test/test-manual/[method-name]/`
5. Update README/guides with usage examples

### Adding a New Utility Function

1. Add it to the appropriate `src/utils/` file (or a new one, categorized like the existing files)
2. Add unit tests in `test/unit/`
3. Only export from `src/index.ts` if it's meant to be public

### Modifying Token Storage

1. Update `Store`/`StorageManager` in `src/storage/StorageManager.ts` (memory and localStorage implementations both live in this one file)
2. Add tests in `test/unit/storage/`
3. Consider a migration path for existing stored data

### Adding API Endpoints

1. Update the OpenAPI spec (`bun run api:download`) and regenerate types (`bun run api:generate`)
2. Add an API client function to `src/api.ts`
3. Update client classes to use the new endpoint, add tests
