import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /\/(\.playwright-mcp|pipeline|pipeline_output|node_modules)\//,
    };
    return config;
  },
};

export default nextConfig;
