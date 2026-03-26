import Database from 'better-sqlite3';
import { getDatabase, closeDatabase, setDatabase } from '../../src/db/connection';

afterEach(() => {
  closeDatabase();
});

describe('Database Connection', () => {
  it('should create an in-memory database', () => {
    const db = getDatabase(':memory:');
    expect(db).toBeDefined();
    expect(db.open).toBe(true);
  });

  it('should return the same instance on subsequent calls (singleton)', () => {
    const db1 = getDatabase(':memory:');
    const db2 = getDatabase(':memory:');
    expect(db1).toBe(db2);
  });

  it('should close the database and allow re-creation', () => {
    const db1 = getDatabase(':memory:');
    closeDatabase();
    const db2 = getDatabase(':memory:');
    expect(db1).not.toBe(db2);
  });

  it('should allow setting an external database', () => {
    const externalDb = new Database(':memory:');
    setDatabase(externalDb);
    const retrieved = getDatabase();
    expect(retrieved).toBe(externalDb);
    externalDb.close();
  });

  it('should handle closeDatabase when no connection exists', () => {
    // Should not throw
    closeDatabase();
    closeDatabase();
  });
});
