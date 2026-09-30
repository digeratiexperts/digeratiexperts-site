/**
 * OBSOLETE — do not use PM2 for the public website.
 *
 * This .cjs variant previously still launched the deprecated /root/Replit-Site
 * deployment on port 3300, colliding with the systemd unit. It is now a stub,
 * matching ecosystem.config.js.
 *
 * Production process manager: systemd unit `digeratiexperts-site`
 *   User: diger7051
 *   WorkingDirectory: /home/digeratiexperts.com/current
 *   Restart: sudo -n /usr/bin/systemctl restart digeratiexperts-site
 *
 * Deploy: sudo -u diger7051 bash deploy/vps/deploy.sh production
 * Docs:   deploy/vps/README.md
 */
module.exports = {
  apps: [],
};
