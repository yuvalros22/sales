import bcrypt from 'bcryptjs';
import getDB, { initDB } from './db';
import { randomUUID } from 'crypto';

export async function seedDB() {
  await initDB();
  const db = getDB();
  
  // Check if admin exists
  const existing = await db.execute("SELECT id FROM users WHERE username = 'admin'");
  if (existing.rows.length > 0) return;

  const adminPw = await bcrypt.hash('admin123', 10);
  const agentPw = await bcrypt.hash('agent123', 10);
  const customerPw = await bcrypt.hash('customer123', 10);

  await db.executeMultiple(`
    INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES 
      ('${randomUUID()}', 'admin', '${adminPw}', 'מנהל ראשי', 'admin');
    INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES 
      ('${randomUUID()}', 'agent1', '${agentPw}', 'דוד כהן - סוכן', 'agent');
    INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES 
      ('${randomUUID()}', 'customer1', '${customerPw}', 'משתל הצפון', 'customer');
  `);
  console.log('DB seeded');
}
