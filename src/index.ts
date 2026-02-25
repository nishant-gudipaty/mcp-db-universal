#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { initDB, getDB, getConfig, testConnection, isReadOnly } from "./db.js";
import { loadConfigFromEnv } from "./config.js";
import {
  getListTablesQuery,
  getDescribeTableQuery,
  getTableIndexesQuery,
  getForeignKeysQuery,
  normalizeResults,
} from "./dialects.js";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const config = loadConfigFromEnv();
initDB(config);

const server = new Server(
  {
    name: "mcp-db-universal",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "db_ping",
      description: "Test the database connection and return connection info",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "db_query",
      description:
        "Execute a SELECT SQL query and return results. Use this for all read operations.",
      inputSchema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "A SELECT SQL query. Must be a read-only statement.",
          },
          limit: {
            type: "number",
            description: "Max rows to return (default 100, max 1000)",
          },
        },
        required: ["sql"],
      },
    },
    {
      name: "db_execute",
      description:
        "Execute a write SQL statement: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP. Disabled in read-only mode.",
      inputSchema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "SQL statement to execute",
          },
        },
        required: ["sql"],
      },
    },
    {
      name: "db_list_tables",
      description: "List all tables and views in the database",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "db_describe_table",
      description: "Get the schema of a table: columns, types, nullability, defaults",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
        },
        required: ["table"],
      },
    },
    {
      name: "db_table_indexes",
      description: "Get indexes for a table",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
        },
        required: ["table"],
      },
    },
    {
      name: "db_foreign_keys",
      description: "Get foreign key relationships for a table",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
        },
        required: ["table"],
      },
    },
    {
      name: "db_schema_snapshot",
      description:
        "Get a full schema snapshot of all tables and their columns. Useful for understanding the entire DB structure at once.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const db = getDB();
  const client = getConfig().client;

  try {
    switch (name) {

      // ── Ping ──────────────────────────────────────────────────────────────
      case "db_ping": {
        const msg = await testConnection();
        return text(`✅ ${msg}\n🔒 Read-only mode: ${isReadOnly()}`);
      }

      // ── SELECT query ──────────────────────────────────────────────────────
      case "db_query": {
        const sql = (args!.sql as string).trim();
        const upperSql = sql.toUpperCase().replace(/\s+/g, " ");

        // Basic safety guard — allow only SELECT/WITH/EXPLAIN
        if (
          !upperSql.startsWith("SELECT") &&
          !upperSql.startsWith("WITH") &&
          !upperSql.startsWith("EXPLAIN")
        ) {
          return error(
            `Only SELECT, WITH, or EXPLAIN statements are allowed in db_query. Use db_execute for write operations.`
          );
        }

        const limit = Math.min(Number(args!.limit ?? 100), 1000);

        // Wrap with limit if not already present
        const limitedSql = applyLimit(sql, limit, client);
        const raw = await db.raw(limitedSql);
        const rows = normalizeResults(raw, client);

        return text(
          `${rows.length} row(s) returned:\n\n${JSON.stringify(rows, null, 2)}`
        );
      }

      // ── Write/DDL ─────────────────────────────────────────────────────────
      case "db_execute": {
        if (isReadOnly()) {
          return error(
            "❌ Server is running in read-only mode. Set DB_READONLY=false to allow writes."
          );
        }

        const sql = (args!.sql as string).trim();
        const raw = await db.raw(sql);
        const rows = normalizeResults(raw, client);
        const rowCount =
          raw.rowCount ?? raw.affectedRows ?? rows?.length ?? "unknown";

        return text(
          `✅ Statement executed successfully.\nRows affected: ${rowCount}\n\n${
            rows?.length ? JSON.stringify(rows, null, 2) : ""
          }`
        );
      }

      // ── List Tables ───────────────────────────────────────────────────────
      case "db_list_tables": {
        const raw = await db.raw(getListTablesQuery(client));
        const rows = normalizeResults(raw, client);
        return text(`${rows.length} table(s) found:\n\n${JSON.stringify(rows, null, 2)}`);
      }

      // ── Describe Table ────────────────────────────────────────────────────
      case "db_describe_table": {
        const table = args!.table as string;
        const raw = await db.raw(getDescribeTableQuery(client, table));
        const rows = normalizeResults(raw, client);
        return text(`Schema for "${table}":\n\n${JSON.stringify(rows, null, 2)}`);
      }

      // ── Indexes ───────────────────────────────────────────────────────────
      case "db_table_indexes": {
        const table = args!.table as string;
        const raw = await db.raw(getTableIndexesQuery(client, table));
        const rows = normalizeResults(raw, client);
        return text(`Indexes for "${table}":\n\n${JSON.stringify(rows, null, 2)}`);
      }

      // ── Foreign Keys ──────────────────────────────────────────────────────
      case "db_foreign_keys": {
        const table = args!.table as string;
        const raw = await db.raw(getForeignKeysQuery(client, table));
        const rows = normalizeResults(raw, client);
        return text(`Foreign keys for "${table}":\n\n${JSON.stringify(rows, null, 2)}`);
      }

      // ── Full Schema Snapshot ──────────────────────────────────────────────
      case "db_schema_snapshot": {
        const tablesRaw = await db.raw(getListTablesQuery(client));
        const tables = normalizeResults(tablesRaw, client);

        const snapshot: Record<string, any> = {};

        for (const tableRow of tables) {
          const tableName: string =
            tableRow.table_name ??
            tableRow.TABLE_NAME ??
            tableRow.name ??
            Object.values(tableRow)[0];

          if (!tableName) continue;

          const colRaw = await db.raw(getDescribeTableQuery(client, tableName));
          snapshot[tableName] = normalizeResults(colRaw, client);
        }

        return text(
          `Full schema snapshot (${Object.keys(snapshot).length} tables):\n\n${JSON.stringify(snapshot, null, 2)}`
        );
      }

      default:
        return error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return error(`DB Error: ${err.message}`);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function applyLimit(sql: string, limit: number, client: string): string {
  const upper = sql.toUpperCase();

  // Don't add limit if already present
  if (upper.includes("LIMIT") || upper.includes("FETCH FIRST") || upper.includes("ROWNUM")) {
    return sql;
  }

  // Remove trailing semicolon
  const cleanSql = sql.replace(/;\s*$/, "");

  switch (client) {
    case "oracle":
      return `SELECT * FROM (${cleanSql}) WHERE ROWNUM <= ${limit}`;
    case "mssql":
      // Add TOP if not already there
      if (!upper.includes("TOP ")) {
        return cleanSql.replace(/^SELECT/i, `SELECT TOP ${limit}`);
      }
      return cleanSql;
    default:
      return `${cleanSql} LIMIT ${limit}`;
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `🚀 mcp-db-universal started | client: ${config.client} | db: ${
      config.database || config.filename
    } | read-only: ${config.readOnly ?? false}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
