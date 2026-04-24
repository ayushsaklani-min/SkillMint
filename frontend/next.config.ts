import type { NextConfig } from "next";

// Temporary backend host. Replace with a real domain once one is purchased
// (e.g. oracle.skillmint.example) and update EC2 IP in a single place here.
const BACKEND_IP = "3.110.116.169";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/oracle/:path*",      destination: `http://${BACKEND_IP}:3001/:path*` },
      { source: "/api/facilitator/:path*", destination: `http://${BACKEND_IP}:3002/:path*` },
      { source: "/api/x402/:path*",        destination: `http://${BACKEND_IP}:3003/:path*` },
    ];
  },
};

export default nextConfig;
