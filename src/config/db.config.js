const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbDialect = process.env.DB_DIALECT || 'sqlite';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbName = process.env.DB_NAME || 'proctoring_system';

let sequelize;

if (dbDialect === 'mysql') {
  console.log(`[Database] Connecting to MySQL database '${dbName}' on ${dbHost}:${dbPort}...`);
  sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  console.log('[Database] Connecting to SQLite local database (proctoring.sqlite)...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './proctoring.sqlite',
    logging: false
  });
}

// Authenticate on startup
sequelize.authenticate()
  .then(() => {
    console.log(`[Database] Connection established successfully using dialect: ${sequelize.getDialect()}`);
  })
  .catch((err) => {
    console.error(`[Database ERROR] Failed to connect to the database (${dbDialect}):`, err.message);
    if (dbDialect === 'mysql') {
      console.warn('[Database WARNING] Ensure your MySQL service is running and credentials in .env are correct.');
    }
  });

module.exports = sequelize;
