const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.baseItem.count().then(c => console.log('Count:', c));
