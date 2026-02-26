# mcp-db-universal

A database-agnostic **MCP (Model Context Protocol) server** that lets you chat with your database through Claude or GitHub Copilot. Ask questions in plain English and the AI will write and execute the SQL for you.

## Supported Databases

| Database   | Driver           | Install                    |
|------------|------------------|----------------------------|
| PostgreSQL | `pg`             | `npm install pg`           |
| MySQL      | `mysql2`         | `npm install mysql2`       |
| SQL Server | `mssql`          | `npm install mssql`        |
| SQLite     | `better-sqlite3` | `npm install better-sqlite3` |
| Oracle     | `oracledb`       | `npm install oracledb`     |

---

## Quick Start

### 1. Install globally

```bash
npm install -g fm-db-mcp-universa

# Then install your DB driver:
npm install -g pg           # PostgreSQL
npm install -g mysql2       # MySQL
npm install -g mssql        # SQL Server
npm install -g better-sqlite3  # SQLite
npm install -g oracledb     # Oracle
```

### 2. Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "my-db": {
      "command": "npx",
      "args": ["fm-db-mcp-universal"],
      "env": {
        "DB_CLIENT":   "oracle",
        "DB_HOST":     "localhost",
        "DB_PORT":     "1521",
        "DB_NAME":     "orcl",
        "DB_USER":     "xxx",
        "DB_PASSWORD": "xxx"
      }
    }
  }
}
```

### 3. Connect to VS Code (GitHub Copilot Agent mode)

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "fmcprod-db": {
      "command": "npx",
      "args": ["fm-db-mcp-universal"],
      "env": {
        "DB_CLIENT":   "oracle",
        "DB_HOST":     "localhost",
        "DB_PORT":     "1521",
        "DB_NAME":     "orcl",
        "DB_USER":     "xxx",
        "DB_PASSWORD": "xxx"
      }
    }
  }
}
```

---

## Configuration

All configuration is via environment variables:

| Variable              | Description                                      | Default     |
|-----------------------|--------------------------------------------------|-------------|
| `DB_CLIENT`           | Database type: `postgres`, `mysql`, `mssql`, `sqlite`, `oracle` | `postgres` |
| `DB_HOST`             | Database host                                    | `localhost` |
| `DB_PORT`             | Database port (auto-detected if not set)         | per DB      |
| `DB_USER`             | Username                                         | —           |
| `DB_PASSWORD`         | Password                                         | —           |
| `DB_NAME`             | Database name                                    | —           |
| `DB_FILENAME`         | File path (SQLite only)                          | —           |
| `DB_CONNECTION_STRING`| Full connection string (overrides above)         | —           |
| `DB_READONLY`         | Set `true` to disable writes/DDL                 | `false`     |
| `DB_POOL_MIN`         | Connection pool minimum                          | `1`         |
| `DB_POOL_MAX`         | Connection pool maximum                          | `5`         |

### Using a Connection String

```json
{
  "env": {
    "DB_CLIENT": "postgres",
    "DB_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/mydb"
  }
}
```

---

## Database-Specific Examples

### PostgreSQL
```json
{
  "DB_CLIENT": "postgres",
  "DB_HOST": "localhost",
  "DB_USER": "postgres",
  "DB_PASSWORD": "secret",
  "DB_NAME": "myapp"
}
```

### MySQL / MariaDB
```json
{
  "DB_CLIENT": "mysql",
  "DB_HOST": "localhost",
  "DB_USER": "root",
  "DB_PASSWORD": "secret",
  "DB_NAME": "myapp"
}
```

### SQL Server (MSSQL)
```json
{
  "DB_CLIENT": "mssql",
  "DB_HOST": "localhost",
  "DB_PORT": "1433",
  "DB_USER": "sa",
  "DB_PASSWORD": "YourPassword123!",
  "DB_NAME": "Northwind"
}
```

### SQLite
```json
{
  "DB_CLIENT": "sqlite",
  "DB_FILENAME": "/path/to/database.db"
}
```

### Oracle
```json
{
  "DB_CLIENT": "oracle",
  "DB_HOST": "localhost",
  "DB_PORT": "1521",
  "DB_USER": "myuser",
  "DB_PASSWORD": "mypassword",
  "DB_NAME": "ORCL"
}
```

---

## Available MCP Tools

| Tool                 | Description                                              |
|----------------------|----------------------------------------------------------|
| `db_ping`            | Test connection and confirm it's working                 |
| `db_query`           | Run a SELECT query (read-only, auto-limited to 100 rows) |
| `db_execute`         | Run INSERT/UPDATE/DELETE/DDL (disabled in read-only mode)|
| `db_list_tables`     | List all tables and views                                |
| `db_describe_table`  | Get columns, types, nullability for a table              |
| `db_table_indexes`   | Get index information for a table                        |
| `db_foreign_keys`    | Get foreign key relationships for a table                |
| `db_schema_snapshot` | Full schema dump of all tables at once                   |

---

## Example Chat Interactions

Once connected, just talk naturally:

> **"What tables do I have?"**
> → Calls `db_list_tables`

> **"Show me all users who signed up in the last 30 days"**
> → Writes and executes a SELECT with date filter

> **"How many orders are in 'pending' status?"**
> → COUNT query

> **"What's the schema of the orders table?"**
> → Calls `db_describe_table`

> **"Add an index on users.email"**
> → Calls `db_execute` with CREATE INDEX statement

> **"Give me a summary of sales by region this year"**
> → GROUP BY query with aggregation

---

## Read-Only Mode

To protect production databases, enable read-only mode:

```json
{
  "env": {
    "DB_READONLY": "true",
    ...
  }
}
```

In read-only mode, `db_execute` is disabled — only SELECT queries are allowed.

---

## Running from Source

```bash
git clone https://github.com/yourname/mcp-db-universal
cd mcp-db-universal
npm install
npm install better-sqlite3  # or your DB driver
npm run build
```

Then configure Claude/Copilot to use:
```json
{
  "command": "node",
  "args": ["/path/to/mcp-db-universal/dist/index.js"],
  "env": { ... }
}
```

Or run directly in dev mode:
```bash
DB_CLIENT=sqlite DB_FILENAME=./test.db npm run dev
```

---

## Publishing to npm

```bash
npm run build
npm publish
```

Users can then use `npx`:
```json
{
  "command": "npx",
  "args": ["mcp-db-universal"],
  "env": { ... }
}
```

---

## License

MIT
