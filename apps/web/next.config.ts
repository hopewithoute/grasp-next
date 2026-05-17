import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
