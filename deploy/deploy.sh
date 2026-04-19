#!/bin/bash
set -e

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <your-domain.com>"
    echo "Example: $0 agentbase-demo.top"
    exit 1
fi

echo "=== AgentBase Deploy Script ==="
echo "Domain: $DOMAIN"
echo ""

# Detect package manager
if command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    INSTALL="dnf install -y"
elif command -v yum &>/dev/null; then
    PKG_MGR="yum"
    INSTALL="yum install -y"
elif command -v apt &>/dev/null; then
    PKG_MGR="apt"
    INSTALL="apt install -y"
    apt update
else
    echo "Unsupported OS. Only Amazon Linux (yum/dnf) and Ubuntu (apt) are supported."
    exit 1
fi

echo "Package manager: $PKG_MGR"

# Install Nginx
echo "=== Installing Nginx ==="
$INSTALL nginx

# Install certbot
echo "=== Installing Certbot ==="
if [ "$PKG_MGR" = "apt" ]; then
    $INSTALL certbot python3-certbot-nginx
else
    $INSTALL certbot
fi

# Install Bun (Node.js runtime)
echo "=== Installing Bun ==="
if ! command -v bun &>/dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
fi

# Ensure bun is in PATH for this session
export PATH="$HOME/.bun/bin:$PATH"

# Verify bun
if ! command -v bun &>/dev/null; then
    echo "Bun installation failed. Please install manually: https://bun.sh"
    exit 1
fi

BUN_VERSION=$(bun --version)
echo "Bun version: $BUN_VERSION"

# Project directory
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LANDING_DIR="$PROJECT_DIR/landing"

echo "Project directory: $PROJECT_DIR"
echo "Landing directory: $LANDING_DIR"

# Build Next.js app
echo "=== Building Next.js app ==="
cd "$LANDING_DIR"
bun install
bun run build

# Configure Nginx
echo "=== Configuring Nginx ==="
sudo mkdir -p /var/www/certbot

# Replace domain in nginx config
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$PROJECT_DIR/deploy/nginx/agentbase.conf" | sudo tee /etc/nginx/conf.d/agentbase.conf >/dev/null

# Remove default site if exists
if [ -f /etc/nginx/conf.d/default.conf ]; then
    sudo rm /etc/nginx/conf.d/default.conf
fi

# Test Nginx config
sudo nginx -t

# Start Nginx (don't enable yet, certbot will reload it)
sudo systemctl start nginx || true

# Obtain SSL certificate
echo "=== Obtaining SSL certificate ==="
echo "Make sure your domain $DOMAIN points to this server's IP before continuing."
echo "Press Enter to continue or Ctrl+C to abort..."
read -r

sudo certbot certonly --standalone -d "$DOMAIN" --agree-tos --non-interactive --email admin@$DOMAIN || {
    echo "Certbot failed. Make sure:"
    echo "  1. Domain $DOMAIN resolves to this server's public IP"
    echo "  2. Port 80 is open in security group"
    exit 1
}

# Update nginx config to use certbot certificates (certbot already updated it if using nginx plugin)
# But we used standalone, so the config already has correct paths

# Reload Nginx with SSL
echo "=== Reloading Nginx with SSL ==="
sudo nginx -t && sudo systemctl reload nginx

# Setup systemd service
echo "=== Setting up systemd service ==="
# Determine the correct user
SERVICE_USER="${SUDO_USER:-$USER}"
SERVICE_HOME="$(eval echo ~$SERVICE_USER)"

# Replace user and paths in service file
sed -e "s|User=ec2-user|User=$SERVICE_USER|g" \
    -e "s|WorkingDirectory=/home/ec2-user/agentbase/landing|WorkingDirectory=$LANDING_DIR|g" \
    -e "s|ExecStart=/usr/local/bin/bun|ExecStart=$SERVICE_HOME/.bun/bin/bun|g" \
    "$PROJECT_DIR/deploy/systemd/agentbase-web.service" | sudo tee /etc/systemd/system/agentbase-web.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable agentbase-web.service
sudo systemctl start agentbase-web.service

# Auto-renewal for certbot
if [ "$PKG_MGR" = "apt" ]; then
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
else
    # Add cron job for certbot renewal
    (sudo crontab -l 2>/dev/null || true; echo "0 0,12 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | sudo crontab -
fi

echo ""
echo "=== Deployment Complete ==="
echo "Website: https://$DOMAIN"
echo "Backend API: http://54.254.215.8:8000"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status agentbase-web   # Check web app status"
echo "  sudo systemctl restart agentbase-web  # Restart web app"
echo "  sudo tail -f /var/log/nginx/error.log # Check Nginx errors"
echo "  sudo journalctl -u agentbase-web -f   # Check app logs"
