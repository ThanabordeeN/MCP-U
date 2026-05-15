import Database from 'better-sqlite3';
import { assertReadonlySql } from './sql_guard.js';

export class SqliteReadonlyAdapter {
  constructor(private dbPath: string) {}

  async query(sql: string, maxRows: number = 500) {
    assertReadonlySql(sql);
    
    // Open a fresh readonly connection
    const db = new Database(this.dbPath, {
      readonly: true,
      fileMustExist: true
    });

    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      
      const limited = rows.length > maxRows;
      const resultRows = limited ? rows.slice(0, maxRows) : rows;
      
      const columns = resultRows.length > 0 ? Object.keys(resultRows[0] as object) : [];
      
      return {
        columns,
        rows: resultRows,
        rowCount: resultRows.length,
        limited,
        dialect: "sqlite"
      };
    } finally {
      db.close();
    }
  }
}
