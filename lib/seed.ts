import bcrypt from 'bcryptjs';
import prisma from './db';

export async function seedDB() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) return;

  const adminPw = await bcrypt.hash('admin123', 10);
  const agentPw = await bcrypt.hash('agent123', 10);
  const customerPw = await bcrypt.hash('customer123', 10);

  await prisma.user.createMany({
    data: [
      { username: 'admin', password: adminPw, name: 'מנהל ראשי', role: 'admin' },
      { username: 'agent1', password: agentPw, name: 'דוד כהן - סוכן', role: 'agent' },
      { username: 'customer1', password: customerPw, name: 'משתל הצפון', role: 'customer' },
    ],
    skipDuplicates: true
  });
  
  console.log('DB seeded');
}

seedDB().catch(console.error);
