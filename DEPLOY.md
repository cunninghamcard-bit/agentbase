# AgentBase 部署指南

## 服务器要求

- 2C2G 以上（腾讯云/阿里云轻量应用服务器，学生价 ~30元/月）
- Docker + Docker Compose
- 开放端口：3000（前端）、8000（后端，可选）

## 一、服务器初始化

```bash
# 安装 Docker（如果没有）
curl -fsSL https://get.docker.com | sh

# 配置国内 Docker 镜像加速
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl restart docker
```

## 二、上传项目

```bash
# 本地打包（不含 PDF 原文，只包含必要文件）
cd agentbase
tar czf agentbase-deploy.tar.gz \
  docker-compose.yml \
  backend/Dockerfile backend/.dockerignore backend/app/ backend/pyproject.toml \
  landing/Dockerfile landing/.dockerignore landing/app/ landing/components/ \
  landing/lib/ landing/public/ landing/package.json landing/bun.lock \
  landing/next.config.ts landing/tsconfig.json landing/components.json \
  landing/postcss.config.mjs \
  data/arxiv_metadata.jsonl data/blog_metadata.jsonl data/lancedb/

# 上传到服务器
scp agentbase-deploy.tar.gz user@your-server:/opt/

# 在服务器上解压
ssh user@your-server
cd /opt && tar xzf agentbase-deploy.tar.gz
```

## 三、配置环境变量

```bash
cd /opt/agentbase

# 创建 .env 文件（可选，没有 API key 也能用，降级为检索模式）
cat > .env <<'EOF'
LLM_PROVIDER=anthropic
LLM_API_KEY=your-key-here
LLM_MODEL=claude-sonnet-4-20250514
EOF
```

## 四、启动

```bash
docker compose up -d --build

# 查看日志
docker compose logs -f

# 验证
curl http://localhost:8000/api/stats
curl http://localhost:3000
```

## 五、反向代理（可选，绑域名+HTTPS）

```bash
# 安装 Caddy（自动 HTTPS）
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# 配置
sudo tee /etc/caddy/Caddyfile <<'EOF'
your-domain.com {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl restart caddy
```

## 数据说明

| 目录 | 大小 | 说明 |
|------|------|------|
| data/lancedb/ | 179MB | 向量索引（28,675 chunks），必须部署 |
| data/*.jsonl | <1MB | 元数据，必须部署 |
| papers/ | 1.7GB | PDF 原文，**不需要**部署 |
| blogs/ | 5MB | Markdown 原文，**不需要**部署 |
