import { handler } from '../../handlers/jobWebhook';
import { connectDB } from '../../config/database';
import { shipmentService } from '../../services/shipmentService';
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

jest.mock('../../config/database');
jest.mock('../../services/shipmentService');

describe('Job Webhook Handler', () => {
  const originalError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  const mockEvent: Partial<APIGatewayProxyEvent> = {
    body: JSON.stringify({
      job: 'B00001234',
      shipment: 'ABCD12345678',
      status: 'ADDED',
    }),
  };

  const mockContext: Partial<Context> = {
    callbackWaitsForEmptyEventLoop: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (connectDB as jest.Mock).mockResolvedValue({});
  });

  it('should create job successfully', async () => {
    const createdShipment = {
      jobId: 'B00001234',
      shipmentId: 'ABCD12345678',
      status: 'ADDED',
      createdAt: new Date('2025-01-17T10:00:00Z'),
      updatedAt: new Date('2025-01-17T10:00:00Z'),
    };

    (shipmentService.createJob as jest.Mock).mockResolvedValue(createdShipment);

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Job created successfully',
      data: {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        createdAt: '2025-01-17T10:00:00.000Z',
        updatedAt: '2025-01-17T10:00:00.000Z',
      },
    });
    expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('should return 400 for validation errors', async () => {
    const invalidEvent = {
      ...mockEvent,
      body: JSON.stringify({
        job: 'INVALID',
        shipment: 'ABCD12345678',
        status: 'ADDED',
      }),
    };

    const result = (await handler(
      invalidEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Validation failed');
  });

  it('should return 409 for business rule violations', async () => {
    (shipmentService.createJob as jest.Mock).mockRejectedValue(
      new Error('Job B00001234 already exists')
    );

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Job B00001234 already exists',
    });
  });

  it('should handle empty body', async () => {
    const emptyEvent = { ...mockEvent, body: null };

    const result = (await handler(
      emptyEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
  });

  it('should handle database connection errors', async () => {
    (connectDB as jest.Mock).mockRejectedValue(new Error('Connection failed'));

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});
