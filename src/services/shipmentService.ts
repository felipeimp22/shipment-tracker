import { Shipment } from '../models/Shipment';
import { IShipment, JobData, LocationData } from '../types/types';
import { validationService } from './validationService';

export class ShipmentService {
  async createJob(data: JobData): Promise<IShipment> {
    const validation = await validationService.validateJobCreation(data.job, data.shipment);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    try {
      const shipment = await Shipment.create({
        jobId: data.job,
        shipmentId: data.shipment,
        status: data.status,
      });

      console.log(`Job ${data.job} created successfully`);
      return shipment;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Job or shipment already exists');
      }
      throw error;
    }
  }

  async updateLocation(data: LocationData): Promise<IShipment> {
    const validation = await validationService.validateLocationUpdate(data.shipment);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const shipment = validation.shipment!;

    const isSignificantChange = validationService.isSignificantLocationChange(shipment.location, {
      latitude: data.latitude,
      longitude: data.longitude,
    });

    if (!isSignificantChange && !data.status) {
      console.log(`Location update for shipment ${data.shipment} skipped - no significant change`);
      return shipment;
    }

    const updateData: any = {
      'location.latitude': data.latitude,
      'location.longitude': data.longitude,
    };

    if (data.status) {
      if (
        (shipment.status === 'DELIVERED' || shipment.status === 'CANCELLED') &&
        data.status !== shipment.status
      ) {
        throw new Error(`Cannot change status of shipment in ${shipment.status} status`);
      }
      updateData.status = data.status;
      console.log(
        `Updating shipment ${data.shipment} status from ${shipment.status} to ${data.status}`
      );
    }

    const updatedShipment = await Shipment.findOneAndUpdate(
      { shipmentId: data.shipment },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedShipment) {
      throw new Error(`Failed to update location for shipment ${data.shipment}`);
    }

    console.log(`Location updated for shipment ${data.shipment}`);

    return updatedShipment;
  }

  async getJobLocation(jobId: string): Promise<IShipment | null> {
    return await Shipment.findOne({ jobId });
  }
}

export const shipmentService = new ShipmentService();
