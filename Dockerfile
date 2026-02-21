FROM node:22-alpine AS base

# === 阶段一：安装依赖 ===
FROM base AS deps
# Alpine 镜像缺少 libc6-compat，某些 Node.js 原生模块可能需要它
RUN apk add --no-cache libc6-compat
WORKDIR /app
# 优先复制依赖清单，利用缓存加速构建
COPY package.json package-lock.json* ./
# 使用 npm ci 保证依赖版本与 lock 文件完全一致
RUN npm ci

# === 阶段二：构建项目 ===
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 禁用 Next.js 遥测数据收集
ENV NEXT_TELEMETRY_DISABLED 1
# 执行 Next.js 构建
RUN npm run build

# === 阶段三：生产环境运行 ===
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 创建非 root 用户运行应用，提升安全性
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置 Next.js 缓存目录权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 从 builder 阶段提取 standalone 模式所需的文件
# 静态资源
COPY --from=builder /app/public ./public
# 独立运行的 server.js 和所需依赖
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 客户端静态文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# Next.js 默认运行在 3000 端口
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动 Next.js Node 服务
CMD ["node", "server.js"]