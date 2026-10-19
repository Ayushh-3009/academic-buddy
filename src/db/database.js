/**
 * Academic Buddy Database Client
 * Uses sql.js (WebAssembly SQLite) with file-backed disk persistence.
 * Zero native compilation requirements on any OS.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config/config');

let dbInstance = null;
const dbFilePath = config.databasePath;

// Ensure database directory exists
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
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
    console.error('Failed to persist database to disk:', err.message);
  }
}

/**
 * Initializes the SQLite database
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Run schema migration
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.run(schemaSql);
    persistToDisk();
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
