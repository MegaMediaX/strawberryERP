/**
 * Seed login passwords for tests and smoke scripts.
 *
 * Read from the environment so plaintext bootstrap credentials are NOT committed
 * to the repository. The real dev values live in the untracked `.env` file (see
 * `.env.example` for the variable names) and match the scrypt hashes seeded in
 * `src/lib/auth/credentials.ts`. In CI, inject these via secrets.
 */
function req(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set the seed passwords in your untracked .env (see .env.example).`,
    );
  }
  return value;
}

export const SEED_ADMIN_PW = req("SEED_ADMIN_PW");
export const SEED_REGIONAL_PW = req("SEED_REGIONAL_PW");
export const SEED_RESELLER_PW = req("SEED_RESELLER_PW");
export const SEED_SALES_PW = req("SEED_SALES_PW");

export const SEED_SUPER_EMAIL = "ggkhoueiry@gmail.com";

export const SEED_LOGINS = [
  { name: "Super Admin", email: SEED_SUPER_EMAIL, password: SEED_ADMIN_PW },
  { name: "Regional Director", email: "maya.regional@lebtech.example", password: SEED_REGIONAL_PW },
  { name: "Reseller Admin", email: "admin@beirutdigital.example", password: SEED_RESELLER_PW },
  { name: "Sales Team User", email: "m.elmouallem@leb-tech.com", password: SEED_SALES_PW },
] as const;
