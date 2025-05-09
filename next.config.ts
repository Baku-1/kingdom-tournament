import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly declare which environment variables should be exposed
  publicRuntimeConfig: {
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
    NEXT_PUBLIC_TOURNAMENT_ESCROW_ADDRESS: process.env.NEXT_PUBLIC_TOURNAMENT_ESCROW_ADDRESS,
    NEXT_PUBLIC_RONIN_RPC_URL: process.env.NEXT_PUBLIC_RONIN_RPC_URL,
  },
  // Add CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ];
  },
  // Add rewrites to handle the domain issue
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: '/:path*',
      },
    ];
  },
};

export default nextConfig;
