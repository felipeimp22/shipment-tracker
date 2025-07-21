import { handler } from '../../handlers/locationWebhook';
import { connectDB } from '../../config/database';
import { shipmentService } from '../../services/shipmentService';
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

jest.mock('../../config/database');
jest.mock('../../services/shipmentService');

describe('Location Webhook Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    body: JSON.stringify({
      shipment: 'ABCD12345678',
      latitude: '49.0041951',
      longitude: '-122.7322901',
    }),
  };

  const mockContext: Partial<Context> = {
    callbackWaitsForEmptyEventLoop: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (connectDB as jest.Mock).mockResolvedValue({});
  });

  it('should update location successfully', async () => {
    const updatedShipment = {
      jobId: 'B00001234',
      shipmentId: 'ABCD12345678',
      location: {
        latitude: '49.0041951',
        longitude: '-122.7322901',
      },
      createdAt: new Date('2025-01-17T10:00:00Z'),
      updatedAt: new Date('2025-01-17T10:05:00Z'),
    };

    (shipmentService.updateLocation as jest.Mock).mockResolvedValue(updatedShipment);

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Location updated successfully',
      data: {
        shipmentId: 'ABCD12345678',
        jobId: 'B00001234',
        location: {
          latitude: '49.0041951',
          longitude: '-122.7322901',
        },
        createdAt: '2025-01-17T10:00:00.000Z',
        updatedAt: '2025-01-17T10:05:00.000Z',
      },
    });
  });

  it('should return 404 when shipment not found', async () => {
    (shipmentService.updateLocation as jest.Mock).mockRejectedValue(
      new Error('Shipment ABCD12345678 not found')
    );

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Shipment ABCD12345678 not found',
    });
  });

  it('should return 409 for other business errors', async () => {
    (shipmentService.updateLocation as jest.Mock).mockRejectedValue(
      new Error('Cannot update location for shipment in DELIVERED status')
    );

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context,
      {} as any
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Cannot update location for shipment in DELIVERED status',
    });
  });

  it('should return 400 for invalid coordinates', async () => {
    const invalidEvent = {
      ...mockEvent,
      body: JSON.stringify({
        shipment: 'ABCD12345678',
        latitude: '91', // Invalid
        longitude: '-122.7322901',
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
});
