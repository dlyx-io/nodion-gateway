import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { serviceAccounts } from '../db/schema/index.js';
import type { ServiceAccount } from '../types.js';

export async function createServiceAccount(
  label: string,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(serviceAccounts).values({
    id,
    label,
    email,
    passwordEncrypted: password,
    totpSecretEncrypted: totpSecret ?? null,
    createdAt: new Date().toISOString(),
  });
  return { id };
}

export async function listServiceAccounts(): Promise<
  Pick<ServiceAccount, 'id' | 'label' | 'email' | 'createdAt'>[]
> {
  const rows = await db
    .select({
      id: serviceAccounts.id,
      label: serviceAccounts.label,
      email: serviceAccounts.email,
      createdAt: serviceAccounts.createdAt,
    })
    .from(serviceAccounts)
    .orderBy(serviceAccounts.createdAt);
  return rows;
}

export async function getServiceAccount(id: string): Promise<ServiceAccount | null> {
  const rows = await db.select().from(serviceAccounts).where(eq(serviceAccounts.id, id));
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    label: row.label,
    email: row.email,
    passwordEncrypted: row.passwordEncrypted,
    totpSecretEncrypted: row.totpSecretEncrypted,
    createdAt: row.createdAt,
  };
}

export async function updateServiceAccount(
  id: string,
  updates: { label?: string; password?: string; totpSecret?: string },
): Promise<boolean> {
  const set: Record<string, string> = {};
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.password !== undefined) set.passwordEncrypted = updates.password;
  if (updates.totpSecret !== undefined) set.totpSecretEncrypted = updates.totpSecret;
  if (Object.keys(set).length === 0) return false;

  const result = await db.update(serviceAccounts).set(set).where(eq(serviceAccounts.id, id));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function deleteServiceAccount(id: string): Promise<boolean> {
  const result = await db.delete(serviceAccounts).where(eq(serviceAccounts.id, id));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}
