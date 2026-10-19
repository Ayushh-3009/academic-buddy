/**
 * Academic Buddy Database Client
 * Uses sql.js (WebAssembly SQLite) with file-backed disk persistence.
 * Zero native compilation requirements on any OS.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config/config');
const { SCHEMA_SQL } = require('./schema');

let dbInstance = null;
const dbFilePath = config.databasePath;

// Ensure database directory exists
try {
  const dbDir = path.dirname(dbFilePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (err) {
  console.warn('Could not ensure db directory:', err.message);
}

/**
 * Persists the in-memory SQLite database to disk
 */
function persistToDisk() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.warn('Failed to persist database to disk:', err.message);
  }
}

/**
 * Initializes the SQLite database
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  // Search candidate paths for sql-wasm.wasm
  const wasmCandidates = [
    path.join(__dirname, 'sql-wasm.wasm'),
    path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  const foundWasm = wasmCandidates.find(p => fs.existsSync(p));

  const SQL = await initSqlJs(foundWasm ? {
    locateFile: () => foundWasm
  } : undefined);

  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read existing DB file, creating fresh DB:', err.message);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Always run schema migration to guarantee all tables exist
  try {
    dbInstance.run(SCHEMA_SQL);
    persistToDisk();
  } catch (err) {
    console.error('Schema migration error:', err.message);
  }

  return dbInstance;
}

/**
 * Execute a query with parameters and return array of objects
 */
async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Execute a single-row query with parameters
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE query and persist
 */
async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  persistToDisk();
  return true;
}

module.exports = {
  getDb,
  query,
  queryOne,
  run,
  persistToDisk,
};
