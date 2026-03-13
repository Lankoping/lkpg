export async function getDb() {
  const { db } = await import('./index')
  return db
}