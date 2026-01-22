import { Elysia } from 'elysia';
import { logger } from '../services/logger';

export const requestLogger = new Elysia()
    .derive(() => {
        return {
            startTime: process.hrtime(),
            requestId: crypto.randomUUID(),
        };
    })
    .onRequest(({ request }: any) => {
        logger.debug('Incoming request', { method: request.method, url: request.url });
    })
    .onAfterResponse((context: any) => {
        const { request, set, startTime, requestId } = context;
        const diff = process.hrtime(startTime);
        const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

        logger.info('Request completed', {
            requestId,
            method: request.method,
            url: request.url,
            status: set.status,
            durationMs,
            userAgent: request.headers.get('user-agent'),
        });
    });
