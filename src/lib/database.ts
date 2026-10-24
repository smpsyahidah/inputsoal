import postgres, { type Sql } from "postgres";
import {
  starterQuestions,
  starterTeachers,
  type Question,
  type Teacher,
} from "@/lib/ruangsoal";

export type StoredData = {
  questions: Question[];
  teachers: Teacher[];
};

export type StoredDataVersion = {
  data: StoredData;
  revision: number;
};

declare global {
  var ruangSoalDatabase: Sql | undefined;
  var ruangSoalSchemaPromise: Promise<void> | undefined;
}

function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  globalThis.ruangSoalDatabase ??= postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
  });
  return globalThis.ruangSoalDatabase;
}

function ensureSchema(sql: Sql) {
  const initialData: StoredData = {
    questions: starterQuestions,
    teachers: starterTeachers,
  };
  globalThis.ruangSoalSchemaPromise ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ruangsoal_data (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1
      )
    `;
    await sql`
      ALTER TABLE ruangsoal_data
      ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ruangsoal_passwords (
        account_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      )
    `;
    await sql`
      INSERT INTO ruangsoal_data (id, payload)
      VALUES (1, ${sql.json(initialData)})
      ON CONFLICT (id) DO NOTHING
    `;
  })().catch((cause: unknown) => {
    globalThis.ruangSoalSchemaPromise = undefined;
    throw cause;
  });
  return globalThis.ruangSoalSchemaPromise;
}

export async function getAccountPasswordHash(accountId: string) {
  const sql = getDatabase();
  await ensureSchema(sql);
  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM ruangsoal_passwords WHERE account_id = ${accountId}
  `;
  return row?.password_hash ?? null;
}

export async function createAccountPasswordHashIfMissing(accountId: string, passwordHash: string) {
  const sql = getDatabase();
  await ensureSchema(sql);
  await sql`
    INSERT INTO ruangsoal_passwords (account_id, password_hash)
    VALUES (${accountId}, ${passwordHash})
    ON CONFLICT (account_id) DO NOTHING
  `;
  return getAccountPasswordHash(accountId);
}

export async function setAccountPasswordHash(accountId: string, passwordHash: string) {
  const sql = getDatabase();
  await ensureSchema(sql);
  await sql`
    INSERT INTO ruangsoal_passwords (account_id, password_hash)
    VALUES (${accountId}, ${passwordHash})
    ON CONFLICT (account_id)
    DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
}

export async function getStoredData(): Promise<StoredDataVersion> {
  const sql = getDatabase();
  await ensureSchema(sql);

  const [row] = await sql<{ payload: StoredData; revision: number }[]>`
    SELECT payload, revision FROM ruangsoal_data WHERE id = 1
  `;

  if (!row) throw new Error("Data RuangSoal tidak ditemukan di database.");
  return { data: row.payload, revision: row.revision };
}

export async function updateStoredData(
  update: (data: StoredData) => StoredData,
  expectedRevision?: number,
): Promise<StoredDataVersion | null> {
  const sql = getDatabase();
  await ensureSchema(sql);

  return sql.begin(async (transaction) => {
    const [row] = await transaction<{ payload: StoredData; revision: number }[]>`
      SELECT payload, revision FROM ruangsoal_data WHERE id = 1 FOR UPDATE
    `;
    if (!row) throw new Error("Data RuangSoal tidak ditemukan di database.");
    if (expectedRevision !== undefined && row.revision !== expectedRevision) return null;

    const nextData = update(row.payload);
    await transaction`
      UPDATE ruangsoal_data
      SET payload = ${transaction.json(nextData)}, revision = revision + 1
      WHERE id = 1
    `;
    return { data: nextData, revision: row.revision + 1 };
  });
}
