import { DBConfig, SupportedDB } from "./db.js";

export function loadConfigFromEnv(): DBConfig {
  const client = (process.env.DB_CLIENT || "postgres") as SupportedDB;

  const config: DBConfig = {
    client,
    host:     process.env.DB_HOST || "localhost",
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE || "",
    filename: process.env.DB_FILENAME,
    connectionString: process.env.DB_CONNECTION_STRING,
    readOnly: process.env.DB_READONLY === "true",
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || "1"),
      max: parseInt(process.env.DB_POOL_MAX || "5"),
    },
  };

  // Set default ports per DB
  if (!process.env.DB_PORT) {
    const defaultPorts: Record<string, number> = {
      postgres: 5432,
      mysql:    3306,
      mssql:    1433,
      oracle:   1521,
    };
    config.port = defaultPorts[client];
  } else {
    config.port = parseInt(process.env.DB_PORT);
  }

  validateConfig(config);
  return config;
}

function validateConfig(config: DBConfig): void {
  const valid: SupportedDB[] = ["postgres", "mysql", "mssql", "sqlite", "oracle"];
  if (!valid.includes(config.client)) {
    throw new Error(`Unsupported DB client: "${config.client}". Valid options: ${valid.join(", ")}`);
  }

  if (config.client === "sqlite" && !config.filename && !config.connectionString) {
    throw new Error("SQLite requires DB_FILENAME or DB_CONNECTION_STRING");
  }

  if (config.client !== "sqlite" && !config.connectionString) {
    if (!config.database) {
      throw new Error("DB_NAME is required");
    }
  }
}
