import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectDB } from '../config/database';
import { shipmentService } from '../services/shipmentService';
import { queryJobSchema } from '../validators/shipmentValidators';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    let validatedData;
    try {
      validatedData = await queryJobSchema.validate({
        jobId: event.pathParameters?.jobId,
      });
    } catch (validationError: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid job ID format',
        }),
      };
    }

    const shipment = await shipmentService.getJobLocation(validatedData.jobId);

    if (!shipment) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Job ${validatedData.jobId} not found`,
        }),
      };
    }

    const response = {
      job: shipment.jobId,
      shipment: shipment.shipmentId,
      status: shipment.status,
      ...(shipment.location && {
        latitude: shipment.location.latitude,
        longitude: shipment.location.longitude,
      }),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error querying location:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
