import mongoose, { Schema } from 'mongoose';
import { IShipment } from '../types/types';

const LocationSchema = new Schema(
  {
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
  },
  { _id: false }
); // Disable _id for subdocument

const ShipmentSchema = new Schema<IShipment>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    shipmentId: { type: String, required: true, index: true },
    status: { type: String, required: true },
    location: { type: LocationSchema, required: false },
  },
  {
    timestamps: true, // This automatically manages createdAt and updatedAt
  }
);

export const Shipment = mongoose.model<IShipment>('Shipment', ShipmentSchema);
