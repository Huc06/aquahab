// Shared types. Names follow docs/architecture/DATA_MODEL.md (§2 enums).

// The five desk ids. The Walrus Keeper is the sixth key and has no desk (see api-types.ts Role).
export type AgentId = "one" | "researcher" | "builder" | "lofi" | "hippo";
