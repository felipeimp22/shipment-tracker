// src/handlers/warmup.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectDB } from '../config/database';

export const handler: APIGatewayProxyHandler = async () => {
  await connectDB();
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Warmed up' }),
  };
};
