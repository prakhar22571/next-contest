import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the Prisma query-engine binary is traced into the serverless
  // function bundle on Netlify (Next's tracer misses the .node engine file).
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
    "/dashboard": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
    "/": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },
};

export default nextConfig;
