import { validationService } from '../../services/validationService';
import { Shipment } from '../../models/Shipment';

// Mock the Shipment model
jest.mock('../../models/Shipment', () => ({
  Shipment: {
    findOne: jest.fn(),
  },
}));

describe('ValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateJobCreation', () => {
    it('should validate when job and shipment do not exist', async () => {
      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        // Return null for both jobId and shipmentId queries
        return Promise.resolve(null);
      });

      const result = await validationService.validateJobCreation('B00001234', 'ABCD12345678');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(Shipment.findOne).toHaveBeenCalledTimes(2);
      expect(Shipment.findOne).toHaveBeenCalledWith({ jobId: 'B00001234' });
      expect(Shipment.findOne).toHaveBeenCalledWith({ shipmentId: 'ABCD12345678' });
    });

    it('should reject when job already exists', async () => {
      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.jobId) {
          return Promise.resolve({ jobId: 'B00001234' });
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateJobCreation('B00001234', 'ABCD12345678');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Job B00001234 already exists');
    });

    it('should reject when shipment is associated with different job', async () => {
      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.jobId) {
          return Promise.resolve(null); // Job doesn't exist
        }
        if (query.shipmentId) {
          return Promise.resolve({
            jobId: 'B00009999',
            shipmentId: 'ABCD12345678',
          });
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateJobCreation('B00001234', 'ABCD12345678');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Shipment ABCD12345678 is already associated with job B00009999');
    });

    it('should allow when shipment exists with same job', async () => {
      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.jobId) {
          return Promise.resolve(null); // Job doesn't exist yet
        }
        if (query.shipmentId) {
          return Promise.resolve({
            jobId: 'B00001234',
            shipmentId: 'ABCD12345678',
          });
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateJobCreation('B00001234', 'ABCD12345678');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateLocationUpdate', () => {
    it('should validate when shipment exists and is in valid status', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'ADDED',
      };

      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.shipmentId === 'ABCD12345678') {
          return Promise.resolve(mockShipmentDoc);
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateLocationUpdate('ABCD12345678');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.shipment).toEqual(mockShipmentDoc);
    });

    it('should reject when shipment does not exist', async () => {
      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        return Promise.resolve(null);
      });

      const result = await validationService.validateLocationUpdate('ABCD12345678');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Shipment ABCD12345678 not found. A job must be created first.');
    });

    it('should reject when shipment is DELIVERED', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'DELIVERED',
      };

      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.shipmentId === 'ABCD12345678') {
          return Promise.resolve(mockShipmentDoc);
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateLocationUpdate('ABCD12345678');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Cannot update location for shipment in DELIVERED status');
    });

    it('should reject when shipment is CANCELLED', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'CANCELLED',
      };

      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.shipmentId === 'ABCD12345678') {
          return Promise.resolve(mockShipmentDoc);
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateLocationUpdate('ABCD12345678');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Cannot update location for shipment in CANCELLED status');
    });

    it('should accept IN_TRANSIT status', async () => {
      const mockShipmentDoc = {
        jobId: 'B00001234',
        shipmentId: 'ABCD12345678',
        status: 'IN_TRANSIT',
      };

      (Shipment.findOne as jest.Mock).mockImplementation((query) => {
        if (query.shipmentId === 'ABCD12345678') {
          return Promise.resolve(mockShipmentDoc);
        }
        return Promise.resolve(null);
      });

      const result = await validationService.validateLocationUpdate('ABCD12345678');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('isSignificantLocationChange', () => {
    it('should return true when no old location exists', () => {
      const result = validationService.isSignificantLocationChange(undefined, {
        latitude: '49.0041951',
        longitude: '-122.7322901',
      });

      expect(result).toBe(true);
    });

    it('should return true when location change exceeds threshold', () => {
      const oldLocation = { latitude: '49.0041951', longitude: '-122.7322901' };
      const newLocation = { latitude: '49.0050000', longitude: '-122.7322901' };

      const result = validationService.isSignificantLocationChange(oldLocation, newLocation);

      expect(result).toBe(true);
    });

    it('should return false when location change is below threshold', () => {
      const oldLocation = { latitude: '49.0041951', longitude: '-122.7322901' };
      const newLocation = { latitude: '49.0041960', longitude: '-122.7322910' };

      const result = validationService.isSignificantLocationChange(oldLocation, newLocation);

      expect(result).toBe(false);
    });

    it('should handle string to number conversion', () => {
      const oldLocation = { latitude: '49.0041951', longitude: '-122.7322901' };
      const newLocation = { latitude: '49.0041951', longitude: '-122.7322901' };

      const result = validationService.isSignificantLocationChange(oldLocation, newLocation);

      expect(result).toBe(false);
    });
  });
});
