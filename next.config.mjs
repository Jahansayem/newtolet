import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  trailingSlash: true,
  turbopack: {
    root: configDir,
    resolveAlias: {
      'react-router-dom': './src/lib/react-router-dom.jsx',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
}

export default nextConfig
