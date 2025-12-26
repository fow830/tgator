const path = require('path');

module.exports = {
  apps: [{
    name: 'tgator-backend',
    script: './src/server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: path.join(__dirname, '../logs/backend-error.log'),
    out_file: path.join(__dirname, '../logs/backend-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
