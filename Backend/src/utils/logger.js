// Centralized logging utility for the backend

/**
 * Logs a message with the specified level
 * @param {string} level - The log level: 'debug', 'info', 'warn', 'error'
 * @param {string} message - The message to log
 */
const log = (level, message) => {
  switch (level) {
    case 'debug':
      console.log(`[DEBUG] ${message}`);
      break;
    case 'error':
      console.error(`[ERROR] ${message}`);
      break;
    case 'info':
      console.info(`[INFO] ${message}`);
      break;
    case 'warn':
      console.warn(`[WARN] ${message}`);
      break;
    default:
      console.log(message);
  }
};

module.exports = {
  debug: (message) => log('debug', message),
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => log('error', message),
  log
}; 