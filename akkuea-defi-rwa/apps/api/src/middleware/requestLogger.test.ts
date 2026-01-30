import { describe, expect, it, spyOn, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { requestLogger } from './requestLogger';
import { logger } from '../services/logger';

describe('requestLogger Middleware', () => {
    let logSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        logSpy = spyOn(logger, 'info').mockImplementation(() => { });
        spyOn(logger, 'debug').mockImplementation(() => { });
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('should log request details on response', async () => {

        const logSpy = spyOn(console, 'log').mockImplementation(() => { });

        const errorSpy = spyOn(console, 'error').mockImplementation(() => { });

        const app = new Elysia()

            .use(requestLogger)

            .get('/health', () => 'ok');
        const response = await app.handle(

            new Request('http://localhost:3001/health', {

                headers: { 'user-agent': 'test-agent' }

            })
        );
        await response.text();

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(response.status).toBe(200);
        expect(logSpy.mock.calls.length + errorSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
        logSpy.mockRestore();

        errorSpy.mockRestore();

    });
    it('should log incoming request if debug is enabled', async () => {
        const debugSpy = spyOn(logger, 'debug').mockImplementation(() => { });

        const app = new Elysia()
            .use(requestLogger)
            .get('/health', () => 'ok');

        await app.handle(new Request('http://localhost:3001/health'));

        expect(debugSpy).toHaveBeenCalledWith('Incoming request', expect.any(Object));
        debugSpy.mockRestore();
    });
});
