import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let cachedConnection: typeof mongoose | null = null;
let connectionPromise: Promise<typeof mongoose> | null = null;

const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 2000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  bufferCommands: false,
};

export const getConnectionString = (): string => {
  const env = process.env.ENVIRONMENT || 'LOCAL';
  const protocol = env === 'PRD' ? 'mongodb+srv' : 'mongodb';
  const host =
    env === 'LOCAL' || env === 'TEST'
      ? process.env.APP_DB_HOST_LOCAL
      : env === 'DOCKER'
        ? process.env.APP_DB_HOST_DOCKER
        : process.env.APP_DB_HOST_PRD;
  const port = env !== 'PRD' ? `:${process.env.APP_DB_PORT}` : '';

  return `${protocol}://${process.env.APP_DB_USER}:${process.env.APP_DB_PASSWORD}@${host}${port}/${process.env.APP_DB_NAME}?authSource=admin&retryWrites=true&w=majority`;
};

export const connectDB = async (): Promise<typeof mongoose> => {
  if (cachedConnection && cachedConnection.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  if (connectionPromise) {
    console.log('Waiting for pending connection');
    return connectionPromise;
  }

  console.log('Creating new database connection');
  connectionPromise = mongoose.connect(getConnectionString(), options);

  try {
    cachedConnection = await connectionPromise;
    connectionPromise = null;
    console.log('New database connection established');
    return cachedConnection;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (cachedConnection) {
    await cachedConnection.disconnect();
    cachedConnection = null;
  }
};
