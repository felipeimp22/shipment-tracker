import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectDB } from '../config/database';
import { shipmentService } from '../services/shipmentService';
import { locationWebhookSchema } from '../validators/shipmentValidators';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    const body = JSON.parse(event.body || '{}');

    let validatedData;
    try {
      validatedData = await locationWebhookSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (validationError: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validationError.errors,
        }),
      };
    }

    try {
      const result = await shipmentService.updateLocation(validatedData);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Location updated successfully',
          data: {
            shipmentId: result.shipmentId,
            jobId: result.jobId,
            location: result.location,
            status: result.status,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          },
        }),
      };
    } catch (businessError: any) {
      const statusCode = businessError.message.includes('not found') ? 404 : 409;
      return {
        statusCode,
        body: JSON.stringify({
          error: businessError.message,
        }),
      };
    }
  } catch (error) {
    console.error('Error processing location webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
