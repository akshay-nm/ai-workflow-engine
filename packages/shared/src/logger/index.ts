import pino, { type LoggerOptions } from 'pino';

const level = process.env['LOG_LEVEL'] ?? 'info';
const isDev = process.env['NODE_ENV'] !== 'production';

const options: LoggerOptions = {
  level,
};

if (isDev) {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(options);

export type Logger = typeof logger;

export function createLogger(name: string): Logger {
  return logger.child({ name });
}
