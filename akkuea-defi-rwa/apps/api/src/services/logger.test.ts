import { describe, expect, it, spyOn, beforeEach, afterEach } from 'bun:test';
import { LoggerService } from './logger';

describe('LoggerService', () => {
    let logSpy: ReturnType<typeof spyOn>;
    let errorSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        logSpy = spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('should log info messages when level is info', () => {
        const logger = new LoggerService('info');
        logger.info('test message');

        expect(logSpy).toHaveBeenCalled();

        const output = JSON.parse(
            logSpy.mock.calls[0][0] as string
        );

        expect(output.level).toBe('info');
        expect(output.message).toBe('test message');
        expect(output.timestamp).toBeDefined();
    });

    it('should NOT log debug messages when level is info', () => {
        const logger = new LoggerService('info');
        logger.debug('debug message');

        expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when level is debug', () => {
        const logger = new LoggerService('debug');
        logger.debug('debug message');

        expect(logSpy).toHaveBeenCalled();

        const output = JSON.parse(
            logSpy.mock.calls[0][0] as string
        );

        expect(output.level).toBe('debug');
    });

    it('should log warn and error messages when level is info', () => {
        const logger = new LoggerService('info');
        logger.warn('warn message');
        logger.error('error message');

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('should include error details and stack trace in error logs', () => {
        const logger = new LoggerService('info');
        const error = new Error('test error');
        logger.error('failed', error);

        const output = JSON.parse(
            errorSpy.mock.calls[0][0] as string
        );

        expect(output.level).toBe('error');
        expect(output.error).toBeDefined();
        expect(output.error.message).toBe('test error');
        expect(output.error.stack).toBeDefined();
    });

    it('should include context in logs', () => {
        const logger = new LoggerService('info');
        logger.info('with context', { userId: '123' });

        const output = JSON.parse(
            logSpy.mock.calls[0][0] as string
        );

        expect(output.context).toEqual({ userId: '123' });
    });
});
