import { Shipment } from '../models/Shipment';

export class ValidationService {
  async validateJobCreation(
    jobId: string,
    shipmentId: string
  ): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    const existingJob = await Shipment.findOne({ jobId });
    if (existingJob) {
      return {
        isValid: false,
        error: `Job ${jobId} already exists`,
      };
    }

    const existingShipment = await Shipment.findOne({ shipmentId });
    if (existingShipment && existingShipment.jobId !== jobId) {
      return {
        isValid: false,
        error: `Shipment ${shipmentId} is already associated with job ${existingShipment.jobId}`,
      };
    }

    return { isValid: true };
  }

  async validateLocationUpdate(shipmentId: string): Promise<{
    isValid: boolean;
    error?: string;
    shipment?: any;
  }> {
    const shipment = await Shipment.findOne({ shipmentId });

    if (!shipment) {
      return {
        isValid: false,
        error: `Shipment ${shipmentId} not found. A job must be created first.`,
      };
    }

    if (shipment.status === 'DELIVERED' || shipment.status === 'CANCELLED') {
      return {
        isValid: false,
        error: `Cannot update location for shipment in ${shipment.status} status`,
      };
    }

    return { isValid: true, shipment };
  }

  isSignificantLocationChange(
    oldLocation: { latitude: string; longitude: string } | undefined,
    newLocation: { latitude: string; longitude: string }
  ): boolean {
    if (!oldLocation) return true;

    const threshold = 0.0001; // Approximately 11 meters
    const latDiff = Math.abs(parseFloat(oldLocation.latitude) - parseFloat(newLocation.latitude));
    const lngDiff = Math.abs(parseFloat(oldLocation.longitude) - parseFloat(newLocation.longitude));

    return latDiff > threshold || lngDiff > threshold;
  }
}

export const validationService = new ValidationService();
