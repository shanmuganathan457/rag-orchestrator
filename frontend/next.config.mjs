/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds on Vercel to avoid ESLint v9 CLI option mismatch
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Types are already checked locally
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
