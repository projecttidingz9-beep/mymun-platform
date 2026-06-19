import { readFileSync } from "fs";

const file = process.argv[2] || ".env.vercel.production.check";
const env = readFileSync(file, "utf8");

function inspect(name) {
  const m = env.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return { name, set: false };
  let raw = m[1].trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1);
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { name, set: true, valid: false };
  }
  const params = Object.fromEntries(u.searchParams.entries());
  return {
    name,
    set: true,
    valid: true,
    host: u.hostname,
    port: u.port || (u.protocol === "postgresql:" ? "5432" : ""),
    database: u.pathname.replace(/^\//, ""),
    userMasked: u.username ? `${u.username.slice(0, 4)}***` : "",
    hasPgbouncer: /pgbouncer=true/i.test(u.search),
    sslmode: params.sslmode || null,
    queryKeys: Object.keys(params).sort(),
  };
}

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  console.log(JSON.stringify(inspect(key), null, 2));
}
