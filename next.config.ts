import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle these Node.js built-ins / native packages — require at runtime instead
  serverExternalPackages: ['undici'],
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  // Allow cross-origin requests to agent run endpoints (for external integrations)
  async headers() {
    return [
      {
        source: '/api/agents/:id/run',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-AgentHub-Key' },
        ],
      },
    ]
  },
};

export default nextConfig;
