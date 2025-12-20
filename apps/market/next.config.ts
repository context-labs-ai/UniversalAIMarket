import type { NextConfig } from "next";
import path from "path";

const emptyModulePath = path.resolve(process.cwd(), "src", "lib", "emptyModule.ts");
const emptyModuleAlias = "./src/lib/emptyModule.ts";
const walletconnectLoggerAlias = "./src/lib/walletconnectLogger.ts";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@dynamic-labs/sdk-react-core",
    "@dynamic-labs/ethereum",
  ],
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      // Optional deps pulled by wallet SDKs that aren't needed in web builds.
      "@walletconnect/logger": walletconnectLoggerAlias,
      "pino": emptyModuleAlias,
      "pino-pretty": emptyModuleAlias,
      "thread-stream": emptyModuleAlias,
      "@react-native-async-storage/async-storage": emptyModuleAlias,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Optional deps pulled by wallet SDKs that aren't needed in web builds.
      "@walletconnect/logger": path.resolve(process.cwd(), "src", "lib", "walletconnectLogger.ts"),
      "pino": emptyModulePath,
      "pino-pretty": emptyModulePath,
      "thread-stream": emptyModulePath,
      "@react-native-async-storage/async-storage": emptyModulePath,
    };
    return config;
  },
};

export default nextConfig;
