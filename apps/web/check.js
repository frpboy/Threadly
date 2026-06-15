const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const guesses = await prisma.guess.findMany({
      orderBy: { createdAt: "desc" }
    });
    console.log("GUESSES IN DB:");
    console.log(JSON.stringify(guesses, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
