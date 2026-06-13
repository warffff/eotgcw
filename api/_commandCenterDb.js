function cleanPrefix(prefix) {
  const value = String(prefix || 'mcore_').trim();
  if (!/^[A-Za-z0-9_]{0,48}$/.test(value)) return 'mcore_';
  return value;
}

function table(name) {
  const prefix = cleanPrefix(process.env.COMMAND_CENTER_DB_PREFIX || process.env.DB_PREFIX || 'mcore_');
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid table name');
  return '`' + prefix + name + '`';
}

function dbConfig() {
  const host = process.env.COMMAND_CENTER_DB_HOST || process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.COMMAND_CENTER_DB_USER || process.env.MYSQL_USER || process.env.DB_USER;
  const password = process.env.COMMAND_CENTER_DB_PASSWORD || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.COMMAND_CENTER_DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_NAME;
  const port = Number(process.env.COMMAND_CENTER_DB_PORT || process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  if (!host || !user || !database) {
    throw new Error('MySQL env vars are not configured for command center');
  }
  return {
    host,
    user,
    password: password || '',
    database,
    port,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    charset: 'utf8mb4',
    decimalNumbers: true
  };
}

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      let mysql;
      try {
        mysql = require('mysql2/promise');
      } catch (err) {
        throw new Error('Dependency mysql2 is not installed. Run npm install after updating package.json.');
      }
      return mysql.createPool(dbConfig());
    })();
  }
  return poolPromise;
}

async function query(sql, params) {
  const pool = await getPool();
  const [rows] = await pool.execute(sql, params || []);
  return rows;
}

module.exports = { query, table };
