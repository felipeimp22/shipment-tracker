import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectDB } from '../config/database';
import { shipmentService } from '../services/shipmentService';
import { jobWebhookSchema } from '../validators/shipmentValidators';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    const body = JSON.parse(event.body || '{}');

    let validatedData;
    try {
      validatedData = await jobWebhookSchema.validate(body, {
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
      const result = await shipmentService.createJob(validatedData);

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: 'Job created successfully',
          data: {
            jobId: result.jobId,
            shipmentId: result.shipmentId,
            status: result.status,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          },
        }),
      };
    } catch (businessError: any) {
      return {
        statusCode: 409, // Conflict
        body: JSON.stringify({
          error: businessError.message,
        }),
      };
    }
  } catch (error) {
    console.error('Error processing job webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
