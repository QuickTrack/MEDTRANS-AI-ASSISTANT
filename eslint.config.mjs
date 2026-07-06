import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", "release/**", "electron-dist/**"],
  },
];

export default eslintConfig;

