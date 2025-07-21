process.env.ENVIRONMENT = 'TEST';
process.env.APP_DB_USER = 'testuser';
process.env.APP_DB_PASSWORD = 'testpass';
process.env.APP_DB_HOST_LOCAL = 'localhost';
process.env.APP_DB_HOST_DOCKER = 'mongo';
process.env.APP_DB_HOST_PRD = 'cluster.mongodb.net';
process.env.APP_DB_PORT = '27017';
process.env.APP_DB_NAME = 'testdb';

afterEach(() => {
  jest.clearAllMocks();
});
