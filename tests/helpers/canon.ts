export const canonicalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();
