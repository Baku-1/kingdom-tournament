import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
    NEXT_PUBLIC_TOURNAMENT_ESCROW_ADDRESS: process.env.NEXT_PUBLIC_TOURNAMENT_ESCROW_ADDRESS,
    NEXT_PUBLIC_RONIN_RPC_URL: process.env.NEXT_PUBLIC_RONIN_RPC_URL,
  },
};

export default nextConfig;
