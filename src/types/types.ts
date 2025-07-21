import { Document } from 'mongoose';

export interface JobData {
  job: string;
  shipment: string;
  status: string;
}

export interface LocationData {
  shipment: string;
  latitude: string;
  longitude: string;
  status?: string; 
}

export interface IShipment extends Document {
  jobId: string;
  shipmentId: string;
  status: string;
  location?: {
    latitude: string;
    longitude: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryJobParams {
  jobId: string;
}
