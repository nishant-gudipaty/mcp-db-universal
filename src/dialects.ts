import { SupportedDB } from "./db.js";

export function getListTablesQuery(client: SupportedDB): string {
  switch (client) {
    case "postgres":
      return `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
    case "mysql":
      return `SHOW FULL TABLES`;
    case "mssql":
      return `
        SELECT TABLE_NAME as table_name, TABLE_TYPE as table_type
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ORDER BY TABLE_NAME
      `;
    case "sqlite":
      return `SELECT name as table_name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`;
    case "oracle":
      return `SELECT table_name, 'TABLE' as table_type FROM user_tables UNION ALL SELECT view_name, 'VIEW' FROM user_views ORDER BY 1`;
    default:
      return `SELECT table_name FROM information_schema.tables`;
  }
}

export function getDescribeTableQuery(client: SupportedDB, table: string): string {
  // Sanitize table name to prevent injection
  const safeTable = table.replace(/[^a-zA-Z0-9_\.]/g, "");

  switch (client) {
    case "postgres":
      return `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = '${safeTable}'
        ORDER BY ordinal_position
      `;
    case "mysql":
      return `DESCRIBE \`${safeTable}\``;
    case "mssql":
      return `
        SELECT
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          CHARACTER_MAXIMUM_LENGTH as max_length,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${safeTable}'
        ORDER BY ORDINAL_POSITION
      `;
    case "sqlite":
      return `PRAGMA table_info(${safeTable})`;
    case "oracle":
      return `
        SELECT column_name, data_type, data_length, nullable, data_default
        FROM user_tab_columns
        WHERE table_name = UPPER('${safeTable}')
        ORDER BY column_id
      `;
    default:
      return `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${safeTable}'`;
  }
}

export function getTableIndexesQuery(client: SupportedDB, table: string): string {
  const safeTable = table.replace(/[^a-zA-Z0-9_\.]/g, "");

  switch (client) {
    case "postgres":
      return `
        SELECT indexname as index_name, indexdef as definition
        FROM pg_indexes
        WHERE tablename = '${safeTable}'
      `;
    case "mysql":
      return `SHOW INDEX FROM \`${safeTable}\``;
    case "mssql":
      return `
        SELECT i.name as index_name, i.type_desc, c.name as column_name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE OBJECT_NAME(i.object_id) = '${safeTable}'
      `;
    case "sqlite":
      return `PRAGMA index_list(${safeTable})`;
    case "oracle":
      return `
        SELECT index_name, column_name, descend
        FROM user_ind_columns
        WHERE table_name = UPPER('${safeTable}')
        ORDER BY index_name, column_position
      `;
    default:
      return `SELECT * FROM information_schema.statistics WHERE table_name = '${safeTable}'`;
  }
}

export function getForeignKeysQuery(client: SupportedDB, table: string): string {
  const safeTable = table.replace(/[^a-zA-Z0-9_\.]/g, "");

  switch (client) {
    case "postgres":
      return `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='${safeTable}'
      `;
    case "mysql":
      return `
        SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = '${safeTable}' AND REFERENCED_TABLE_NAME IS NOT NULL
      `;
    case "mssql":
      return `
        SELECT
          col.name AS column_name,
          ref_tab.name AS foreign_table,
          ref_col.name AS foreign_column
        FROM sys.foreign_key_columns fkc
        JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id
        JOIN sys.tables tab ON tab.object_id = fkc.parent_object_id
        JOIN sys.columns col ON col.column_id = fkc.parent_column_id AND col.object_id = tab.object_id
        JOIN sys.tables ref_tab ON ref_tab.object_id = fkc.referenced_object_id
        JOIN sys.columns ref_col ON ref_col.column_id = fkc.referenced_column_id AND ref_col.object_id = ref_tab.object_id
        WHERE tab.name = '${safeTable}'
      `;
    case "oracle":
      return `
        SELECT a.column_name, c_pk.table_name r_table_name, b.column_name r_column_name
        FROM user_cons_columns a
        JOIN user_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
        JOIN user_constraints c_pk ON c.r_owner = c_pk.owner AND c.r_constraint_name = c_pk.constraint_name
        JOIN user_cons_columns b ON c_pk.owner = b.owner AND c_pk.constraint_name = b.constraint_name
        WHERE c.constraint_type = 'R' AND a.table_name = UPPER('${safeTable}')
      `;
    default:
      return `SELECT * FROM information_schema.referential_constraints WHERE constraint_name LIKE '%${safeTable}%'`;
  }
}

export function normalizeResults(raw: any, client: SupportedDB): any[] {
  if (!raw) return [];
  // Different drivers return results differently
  if (client === "mssql")  return raw.recordset ?? raw;
  if (client === "postgres") return raw.rows ?? raw;
  if (client === "mysql")  return Array.isArray(raw) ? raw[0] : raw;
  if (client === "sqlite")  return Array.isArray(raw) ? raw : [raw];
  if (client === "oracle")  return raw.rows ?? raw;
  return raw.rows ?? raw[0] ?? raw;
}
