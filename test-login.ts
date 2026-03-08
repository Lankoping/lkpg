import { loginFn } from './src/server/functions/auth'

async function run() {
  try {
    const res = await loginFn({ data: { email: 'elias.lindholm2010@outlook.com', passwordHash: 'Tigern16h' } })
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", (err as Error).message);
  }
}

run();
