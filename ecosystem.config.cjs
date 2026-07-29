module.exports = {
  apps: [
    {
      name: "cryptoscanner",
      script: "dist/server.cjs",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
        PORT: "3001"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      max_memory_restart: "512M"
    }
  ]
};
