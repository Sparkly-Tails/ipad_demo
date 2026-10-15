import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

// Each serverless instance should hold a single connection to the Supabase
// transaction pooler. Opening Prisma's default pool of 5 at cold start timed
// out ("Timed out fetching a new connection") and pushed webhook responses past
// Shopify's 5 second limit. Parameters already present in DATABASE_URL win.
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return new PrismaClient();

  const params: string[] = [];
  if (!/[?&]connection_limit=/.test(url)) params.push("connection_limit=1");
  if (!/[?&]pool_timeout=/.test(url)) params.push("pool_timeout=20");
  if (params.length === 0) return new PrismaClient();

  const separator = url.includes("?") ? "&" : "?";
  return new PrismaClient({
    datasourceUrl: `${url}${separator}${params.join("&")}`,
  });
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createClient();
  }
}

const prisma = global.prismaGlobal ?? createClient();

export default prisma;
