function pickEnv(
  e: NodeJS.ProcessEnv,
  key: string,
  defaultValue: string,
): string {
  const v = e[key];
  return v !== undefined && v !== '' ? v : defaultValue;
}

export function resolveDatabaseUrl(e: NodeJS.ProcessEnv = process.env): string {
  const raw = e.DATABASE_URL;
  if (raw !== undefined && raw.trim() !== '') {
    return raw.trim();
  }

  const host = pickEnv(e, 'DB_HOST', 'localhost');
  const port = pickEnv(e, 'DB_PORT', '5432');
  const user = pickEnv(e, 'DB_USER', 'postgres');
  const password = pickEnv(e, 'DB_PASSWORD', '');
  const name = pickEnv(e, 'DB_NAME', 'vidwave');

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=public`;
}
