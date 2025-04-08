import 'tsconfig-paths/register';
import prisma from '@/lib/db';
import { hash } from '@/lib/hash';

async function main() {
  await prisma.user.create({
    data: {
      name: 'Test',
      email: 'test@gmail.com',
      password: await hash('test12345'),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
