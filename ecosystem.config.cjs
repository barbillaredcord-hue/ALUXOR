module.exports = {
  apps: [
    {
      name: "aluxor-network",
      cwd: "/Users/fabianhonoriogonzalezandrade/Documents/Codex/2026-05-21/ALUXOR",
      script: "npm",
      args: "run start",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
