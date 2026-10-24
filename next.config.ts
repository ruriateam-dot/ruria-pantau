import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "bcryptjs", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
