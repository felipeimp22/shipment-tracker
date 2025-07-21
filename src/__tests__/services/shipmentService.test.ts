import { shipmentService } from '../../services/shipmentService';
import { validationService } from '../../services/validationService';
import { Shipment } from '../../models/Shipment';

// Mock dependencies
jest.mock('../../models/Shipment', () => ({
  Shipment: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../../services/validationService', () => ({
  validationService: {
    validateJobCreation: jest.fn(),
    validateLocationUpdate: jest.fn(),
    isSignificantLocationChange: jest.fn(),
  },
}));

describe('ShipmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    const validJobData = {
      job: 'B00001234',
      shipment: 'ABCD12345678',
      status: 'ADDED',
    };

    it('should create job when validation passes', async () => {
      (validationService.validateJobCreation as jest.Mock).mockResolvedValue({
        isValid: true,
      });

      const mockCreatedShipment = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (Shipment.create as jest.Mock).mockResolvedValue(mockCreatedShipment);

      const result = await shipmentService.createJob(validJobData);

      expect(validationService.validateJobCreation).toHaveBeenCalledWith(
        'B00001234',
        'ABCD12345678'
      );
      expect(Shipment.create).toHaveBeenCalledWith({
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
      });
      expect(result).toEqual(mockCreatedShipment);
    });

    it('should throw error when validation fails', async () => {
      (validationService.validateJobCreation as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'Job B00001234 already exists',
      });

      await expect(shipmentService.createJob(validJobData)).rejects.toThrow(
        'Job B00001234 already exists'
      );

      expect(Shipment.create).not.toHaveBeenCalled();
    });

    it('should handle MongoDB duplicate key error', async () => {
      (validationService.validateJobCreation as jest.Mock).mockResolvedValue({
        isValid: true,
      });

      const mongoError: any = new Error('Duplicate key error');
      mongoError.code = 11000;
      (Shipment.create as jest.Mock).mockRejectedValue(mongoError);

      await expect(shipmentService.createJob(validJobData)).rejects.toThrow(
        'Job or shipment already exists'
      );
    });

    it('should propagate other database errors', async () => {
      (validationService.validateJobCreation as jest.Mock).mockResolvedValue({
        isValid: true,
      });

      const dbError = new Error('Database connection failed');
      (Shipment.create as jest.Mock).mockRejectedValue(dbError);

      await expect(shipmentService.createJob(validJobData)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('updateLocation', () => {
    const validLocationData = {
      shipment: 'ABCD12345678',
      latitude: '49.0041951',
      longitude: '-122.7322901',
    };

    it('should update location when validation passes and change is significant', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        location: undefined,
      };

      (validationService.validateLocationUpdate as jest.Mock).mockResolvedValue({
        isValid: true,
        shipment: mockShipmentDoc,
      });

      (validationService.isSignificantLocationChange as jest.Mock).mockReturnValue(true);

      const mockUpdatedShipment = {
        ...mockShipmentDoc,
        location: {
          latitude: '49.0041951',
          longitude: '-122.7322901',
        },
        updatedAt: new Date(),
      };

      (Shipment.findOneAndUpdate as jest.Mock).mockResolvedValue(mockUpdatedShipment);

      const result = await shipmentService.updateLocation(validLocationData);

      expect(validationService.validateLocationUpdate).toHaveBeenCalledWith('ABCD12345678');
      expect(validationService.isSignificantLocationChange).toHaveBeenCalledWith(undefined, {
        latitude: '49.0041951',
        longitude: '-122.7322901',
      });
      expect(Shipment.findOneAndUpdate).toHaveBeenCalledWith(
        { shipmentId: 'ABCD12345678' },
        {
          $set: {
            'location.latitude': '49.0041951',
            'location.longitude': '-122.7322901',
          },
        },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockUpdatedShipment);
    });

    it('should skip update when location change is not significant', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        location: {
          latitude: '49.0041951',
          longitude: '-122.7322901',
        },
      };

      (validationService.validateLocationUpdate as jest.Mock).mockResolvedValue({
        isValid: true,
        shipment: mockShipmentDoc,
      });

      (validationService.isSignificantLocationChange as jest.Mock).mockReturnValue(false);

      const result = await shipmentService.updateLocation(validLocationData);

      expect(Shipment.findOneAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(mockShipmentDoc);
    });

    it('should throw error when validation fails', async () => {
      (validationService.validateLocationUpdate as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'Shipment ABCD12345678 not found',
      });

      await expect(shipmentService.updateLocation(validLocationData)).rejects.toThrow(
        'Shipment ABCD12345678 not found'
      );

      expect(Shipment.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw error when update fails', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        location: undefined,
      };

      (validationService.validateLocationUpdate as jest.Mock).mockResolvedValue({
        isValid: true,
        shipment: mockShipmentDoc,
      });

      (validationService.isSignificantLocationChange as jest.Mock).mockReturnValue(true);
      (Shipment.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(shipmentService.updateLocation(validLocationData)).rejects.toThrow(
        'Failed to update location for shipment ABCD12345678'
      );
    });
  });

  describe('getJobLocation', () => {
    it('should return shipment when found', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
        location: {
          latitude: '49.0041951',
          longitude: '-122.7322901',
        },
      };

      (Shipment.findOne as jest.Mock).mockResolvedValue(mockShipmentDoc);

      const result = await shipmentService.getJobLocation('B00001234');

      expect(Shipment.findOne).toHaveBeenCalledWith({ jobId: 'B00001234' });
      expect(result).toEqual(mockShipmentDoc);
    });

    it('should return null when shipment not found', async () => {
      (Shipment.findOne as jest.Mock).mockResolvedValue(null);

      const result = await shipmentService.getJobLocation('B00001234');

      expect(result).toBeNull();
    });
  });
});
