import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    // Allow Google account avatars used by Better Auth's Google OAuth provider.
    remotePatterns: [
      {
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
        protocol: 'https',
      },
    ],
  },
  serverExternalPackages: ['node-wreq', 'duck-duck-scrape'],
};

export default nextConfig;
