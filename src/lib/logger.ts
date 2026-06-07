import { createLogger, format, transports } from 'winston';
import { config } from './config';

export const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} ${message}`)
  ),
  transports: [new transports.Console()],
});
