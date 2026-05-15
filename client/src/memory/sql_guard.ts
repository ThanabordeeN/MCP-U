export function assertReadonlySql(sql: string): void {
  const withoutComments = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const normalized = withoutComments.trim().toLowerCase();

  if (!/^(select|with)\b/.test(normalized)) {
    throw new Error("Only SELECT/WITH queries are allowed");
  }

  if (normalized.includes(";")) {
    throw new Error("Only one SQL statement is allowed");
  }

  const blocked = [
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "replace",
    "truncate",
    "attach",
    "detach",
    "vacuum",
    "pragma",
    "reindex",
    "begin",
    "commit",
    "rollback",
    "grant",
    "revoke",
    "call",
    "exec",
    "merge"
  ];

  for (const word of blocked) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(normalized)) {
      throw new Error(`Blocked SQL keyword: ${word}`);
    }
  }
}
