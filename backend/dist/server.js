import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));
const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
