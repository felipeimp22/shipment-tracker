// src/__tests__/integration/shipmentFlow.integration.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

// Mock the database module to use our test connection
jest.mock('../../config/database', () => {
  const mongoose = require('mongoose');
  let testConnection: typeof mongoose | null = null;

  return {
    connectDB: async () => {
      if (testConnection && testConnection.connection.readyState === 1) {
        return testConnection;
      }

      // Use the connection string set by our test
      const uri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test';
      testConnection = await mongoose.connect(uri, {
        bufferCommands: false,
      });

      return testConnection;
    },
    disconnectDB: async () => {
      if (testConnection) {
        await testConnection.disconnect();
        testConnection = null;
      }
    },
    getConnectionString: () => process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test',
  };
});

// Now import handlers after mocking
import { handler as jobWebhookHandler } from '../../handlers/jobWebhook';
import { handler as locationWebhookHandler } from '../../handlers/locationWebhook';
import { handler as queryLocationHandler } from '../../handlers/queryLocation';

// Helper function to create a complete mock APIGatewayProxyEvent
const createMockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: '1234567890',
    authorizer: {},
    protocol: 'HTTP/1.1',
    httpMethod: 'POST',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'Custom User Agent',
      userArn: null,
    },
    path: '/',
    stage: 'test',
    requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
    requestTime: '09/Apr/2015:12:34:56 +0000',
    requestTimeEpoch: 1428582896000,
    resourceId: '123456',
    resourcePath: '/',
  },
  resource: '/',
  ...overrides,
});

// Helper function to create mock context
const createMockContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2021/01/01/[$LATEST]abcdef1234567890',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
});

describe('Shipment Tracking Integration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set the URI for our mocked database module
    process.env.TEST_MONGODB_URI = mongoUri;

    // Clear module cache to ensure fresh state
    jest.clearAllMocks();
  }, 30000);

  afterAll(async () => {
    // Disconnect all connections
    await mongoose.disconnect();

    // Stop the memory server
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Complete Shipment Flow', () => {
    it('should handle the complete flow: create job -> update location -> query location', async () => {
      // Step 1: Create a job
      const createJobEvent = createMockEvent({
        body: JSON.stringify({
          job: 'B00001234',
          shipment: 'ABCD12345678',
          status: 'ADDED',
        }),
        httpMethod: 'POST',
        path: '/webhook/job',
      });

      const mockContext = createMockContext();

      const createResult = (await jobWebhookHandler(
        createJobEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(createResult.statusCode).toBe(201);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.message).toBe('Job created successfully');
      expect(createBody.data.jobId).toBe('B00001234');

      // Step 2: Update location
      const updateLocationEvent = createMockEvent({
        body: JSON.stringify({
          shipment: 'ABCD12345678',
          latitude: '49.0041951',
          longitude: '-122.7322901',
        }),
        httpMethod: 'POST',
        path: '/webhook/location',
      });

      const updateResult = (await locationWebhookHandler(
        updateLocationEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(updateResult.statusCode).toBe(200);
      const updateBody = JSON.parse(updateResult.body);
      expect(updateBody.message).toBe('Location updated successfully');
      expect(updateBody.data.location.latitude).toBe('49.0041951');

      // Step 3: Query location
      const queryEvent = createMockEvent({
        pathParameters: {
          jobId: 'B00001234',
        },
        httpMethod: 'GET',
        path: '/location/B00001234',
      });

      const queryResult = (await queryLocationHandler(
        queryEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(queryResult.statusCode).toBe(200);
      const queryBody = JSON.parse(queryResult.body);
      expect(queryBody).toMatchObject({
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
        latitude: '49.0041951',
        longitude: '-122.7322901',
      });
    }, 10000);

    it('should prevent duplicate job creation', async () => {
      const createJobEvent = createMockEvent({
        body: JSON.stringify({
          job: 'B00001234',
          shipment: 'ABCD12345678',
          status: 'ADDED',
        }),
      });

      const mockContext = createMockContext();

      const firstResult = (await jobWebhookHandler(
        createJobEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;
      expect(firstResult.statusCode).toBe(201);

      const secondResult = (await jobWebhookHandler(
        createJobEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;
      expect(secondResult.statusCode).toBe(409);
      expect(JSON.parse(secondResult.body).error).toContain('already exists');
    });

    it('should prevent location update for non-existent shipment', async () => {
      const updateLocationEvent = createMockEvent({
        body: JSON.stringify({
          shipment: 'WXYZ87654321',
          latitude: '49.0041951',
          longitude: '-122.7322901',
        }),
      });

      const mockContext = createMockContext();

      const result = (await locationWebhookHandler(
        updateLocationEvent,
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toContain('not found');
    });

    it('should handle multiple location updates', async () => {
      const mockContext = createMockContext();

      // Create job first
      await jobWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            job: 'B00001234',
            shipment: 'ABCD12345678',
            status: 'ADDED',
          }),
        }),
        mockContext,
        {} as any
      );

      // First location update
      await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.0041951',
            longitude: '-122.7322901',
          }),
        }),
        mockContext,
        {} as any
      );

      // Second location update (significant change)
      const updateResult = (await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.1041951',
            longitude: '-122.8322901',
          }),
        }),
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(updateResult.statusCode).toBe(200);

      // Query should return latest location
      const queryResult = (await queryLocationHandler(
        createMockEvent({
          pathParameters: { jobId: 'B00001234' },
          httpMethod: 'GET',
        }),
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      const body = JSON.parse(queryResult.body);
      expect(body.latitude).toBe('49.1041951');
      expect(body.longitude).toBe('-122.8322901');
    }, 10000);

    it('should prevent location updates for DELIVERED shipments', async () => {
      const mockContext = createMockContext();

      await jobWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            job: 'B00001234',
            shipment: 'ABCD12345678',
            status: 'DELIVERED',
          }),
        }),
        mockContext,
        {} as any
      );

      const updateResult = (await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.0041951',
            longitude: '-122.7322901',
          }),
        }),
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(updateResult.statusCode).toBe(409);
      expect(JSON.parse(updateResult.body).error).toContain('DELIVERED status');
    });

    it('should prevent location updates for CANCELLED shipments', async () => {
      const mockContext = createMockContext();

      await jobWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            job: 'B00001234',
            shipment: 'ABCD12345678',
            status: 'CANCELLED',
          }),
        }),
        mockContext,
        {} as any
      );

      const updateResult = (await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.0041951',
            longitude: '-122.7322901',
          }),
        }),
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      expect(updateResult.statusCode).toBe(409);
      expect(JSON.parse(updateResult.body).error).toContain('CANCELLED status');
    });

    it('should skip insignificant location updates', async () => {
      const mockContext = createMockContext();

      // Create job and set initial location
      await jobWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            job: 'B00001234',
            shipment: 'ABCD12345678',
            status: 'ADDED',
          }),
        }),
        mockContext,
        {} as any
      );

      await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.0041951',
            longitude: '-122.7322901',
          }),
        }),
        mockContext,
        {} as any
      );

      // Update with insignificant change (less than 11 meters)
      await locationWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            shipment: 'ABCD12345678',
            latitude: '49.0041960',
            longitude: '-122.7322910',
          }),
        }),
        mockContext,
        {} as any
      );

      // Query and verify location hasn't changed
      const queryResult = (await queryLocationHandler(
        createMockEvent({
          pathParameters: { jobId: 'B00001234' },
          httpMethod: 'GET',
        }),
        mockContext,
        {} as any
      )) as APIGatewayProxyResult;

      const body = JSON.parse(queryResult.body);
      expect(body.latitude).toBe('49.0041951');
      expect(body.longitude).toBe('-122.7322901');
    }, 10000);
  });

  describe('Validation Integration Tests', () => {
    it('should reject invalid job ID patterns', async () => {
      const invalidPatterns = ['A00001234', 'B0001234', 'B000012345', 'B0000123A', ''];

      const mockContext = createMockContext();

      for (const invalidJob of invalidPatterns) {
        const result = (await jobWebhookHandler(
          createMockEvent({
            body: JSON.stringify({
              job: invalidJob,
              shipment: 'ABCD12345678',
              status: 'ADDED',
            }),
          }),
          mockContext,
          {} as any
        )) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(400);
      }
    });

    it('should reject invalid coordinates', async () => {
      const mockContext = createMockContext();

      // Create job first
      await jobWebhookHandler(
        createMockEvent({
          body: JSON.stringify({
            job: 'B00001234',
            shipment: 'ABCD12345678',
            status: 'ADDED',
          }),
        }),
        mockContext,
        {} as any
      );

      const invalidCoordinates = [
        { latitude: '91', longitude: '0' },
        { latitude: '-91', longitude: '0' },
        { latitude: '0', longitude: '181' },
        { latitude: '0', longitude: '-181' },
        { latitude: 'abc', longitude: '0' },
        { latitude: '0', longitude: 'xyz' },
      ];

      for (const coords of invalidCoordinates) {
        const result = (await locationWebhookHandler(
          createMockEvent({
            body: JSON.stringify({
              shipment: 'ABCD12345678',
              ...coords,
            }),
          }),
          mockContext,
          {} as any
        )) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(400);
      }
    }, 10000);

    it('should accept all valid status values', async () => {
      const validStatuses = ['ADDED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
      const mockContext = createMockContext();

      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        const jobId = `B0000123${i}`;

        const result = (await jobWebhookHandler(
          createMockEvent({
            body: JSON.stringify({
              job: jobId,
              shipment: `ABCD1234567${i}`,
              status: status,
            }),
          }),
          mockContext,
          {} as any
        )) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.data.status).toBe(status);
      }
    });

    it('should validate shipment ID format correctly', async () => {
      const mockContext = createMockContext();

      const invalidShipmentIds = [
        'ABC12345678',
        'ABCDE12345678',
        'ABCD1234567',
        'ABCD123456789',
        'abcd12345678',
        'ABCD12345678A',
        '123412345678',
      ];

      for (const shipmentId of invalidShipmentIds) {
        const result = (await jobWebhookHandler(
          createMockEvent({
            body: JSON.stringify({
              job: 'B00001234',
              shipment: shipmentId,
              status: 'ADDED',
            }),
          }),
          mockContext,
          {} as any
        )) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Validation failed');
      }
    });
  });
});
