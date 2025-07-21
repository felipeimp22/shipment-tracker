import { handler } from '../../handlers/queryLocation';
import { connectDB } from '../../config/database';
import { shipmentService } from '../../services/shipmentService';
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

jest.mock('../../config/database');
jest.mock('../../services/shipmentService');

describe('Query Location Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    pathParameters: {
      jobId: 'B00001234',
    },
  };

  const mockContext: Partial<Context> = {
    callbackWaitsForEmptyEventLoop: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (connectDB as jest.Mock).mockResolvedValue({});
  });

  it('should return shipment with location', async () => {
    const mockShipment = {
      jobId: 'B00001234',
      shipmentId: 'ABCD12345678',
      status: 'ADDED',
      location: {
        latitude: '49.0041951',
        longitude: '-122.7322901',
      },
      createdAt: new Date('2025-01-17T10:00:00Z'),
      updatedAt: new Date('2025-01-17T10:05:00Z'),
    };

    (shipmentService.getJobLocation as jest.Mock).mockResolvedValue(mockShipment);

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      job: 'B00001234',
      shipment: 'ABCD12345678',
      status: 'ADDED',
      latitude: '49.0041951',
      longitude: '-122.7322901',
      createdAt: '2025-01-17T10:00:00.000Z',
      updatedAt: '2025-01-17T10:05:00.000Z',
    });
  });

  it('should return shipment without location', async () => {
    const mockShipment = {
      jobId: 'B00001234',
      shipmentId: 'ABCD12345678',
      status: 'ADDED',
      location: undefined,
      createdAt: new Date('2025-01-17T10:00:00Z'),
      updatedAt: new Date('2025-01-17T10:00:00Z'),
    };

    (shipmentService.getJobLocation as jest.Mock).mockResolvedValue(mockShipment);

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body.latitude).toBeUndefined();
    expect(body.longitude).toBeUndefined();
  });

  it('should return 404 when job not found', async () => {
    (shipmentService.getJobLocation as jest.Mock).mockResolvedValue(null);

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Job B00001234 not found',
    });
  });

  it('should return 400 for invalid job ID format', async () => {
    const invalidEvent = {
      ...mockEvent,
      pathParameters: {
        jobId: 'INVALID',
      },
    };

    const result = (await handler(
      invalidEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid job ID format',
    });
  });

  it('should handle missing path parameters', async () => {
    const invalidEvent = {
      ...mockEvent,
      pathParameters: null,
    };

    const result = (await handler(
      invalidEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid job ID format',
    });
  });
});
