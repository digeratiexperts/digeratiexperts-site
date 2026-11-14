// Legacy rollback reference only. Production uses the systemd unit in deploy/vps.
module.exports = {
  apps: [{
    name: 'digeratiexperts-site',
    cwd: '/home/digeratiexperts.com/current',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: '3300',
      // Load DB URL via env file below OR set it here directly.
    },
    node_args: ['--env-file=.env']
  }]
}
