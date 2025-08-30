import pino from 'pino';

const config = {
  level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      messageFormat: '{msg}',
      hideObject: false,
      singleLine: false
    }
  },
  serializers: {
    err: (err) => ({
      message: err.message,
      code: err.code,
      errno: err.errno,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }),
    error: (err) => ({
      message: err.message,
      code: err.code,
      errno: err.errno
    })
  }
};

export const logger = pino(config);

export const testSerializers = () => {
  const testError = new Error('Test');
  testError.code = 'TEST';
  testError.errno = 1;
  
  config.serializers.err(testError);
  config.serializers.error(testError);
};
