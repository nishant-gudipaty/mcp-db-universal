import knex, { Knex } from "knex";

export type SupportedDB = "postgres" | "mysql" | "mssql" | "sqlite" | "oracle";

export interface DBConfig {
  client: SupportedDB;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  filename?: string;       // sqlite only
  connectionString?: string; // optional override
  readOnly?: boolean;
  pool?: {
    min?: number;
    max?: number;
  };
}

let db: Knex;
let currentConfig: DBConfig;

export function initDB(config: DBConfig): Knex {
  currentConfig = config;

  const clientMap: Record<string, string> = {
    postgres: "pg",
    mysql: "mysql2",
    mssql: "mssql",
    sqlite: "better-sqlite3",
    oracle: "oracledb",
  };

  let connection: any;

  if (config.connectionString) {
    connection = config.connectionString;
  } else if (config.client === "sqlite") {
    connection = { filename: config.filename! };
  } else {
    connection = {
      host: config.host || "localhost",
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    };
  }

  const knexConfig: Knex.Config = {
    client: clientMap[config.client] || config.client,
    connection,
    useNullAsDefault: true,
    pool: config.pool || { min: 1, max: 5 },
  };

  db = knex(knexConfig);
  return db;
}

export function getDB(): Knex {
  if (!db) throw new Error("DB not initialized. Check your configuration.");
  return db;
}

export function getConfig(): DBConfig {
  return currentConfig;
}

export async function testConnection(): Promise<string> {
  const database = getDB();
  await database.raw(getPingQuery(currentConfig.client));
  return `Connected to ${currentConfig.client} database: ${currentConfig.database || currentConfig.filename}`;
}

function getPingQuery(client: string): string {
  switch (client) {
    case "oracle":   return "SELECT 1 FROM DUAL";
    case "mssql":    return "SELECT 1";
    case "sqlite":   return "SELECT 1";
    default:         return "SELECT 1";
  }
}

export function isReadOnly(): boolean {
  return currentConfig?.readOnly === true;
}
