import {
  jobWebhookSchema,
  locationWebhookSchema,
  queryJobSchema,
} from '../../validators/shipmentValidators';

describe('Shipment Validators', () => {
  describe('jobWebhookSchema', () => {
    it('should validate correct job webhook data', async () => {
      const validData = {
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
      };

      const result = await jobWebhookSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid job ID format', async () => {
      const invalidData = {
        job: 'A00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
      };

      await expect(jobWebhookSchema.validate(invalidData)).rejects.toThrow(
        'Job ID must match pattern B00000000'
      );
    });

    it('should reject invalid shipment ID format', async () => {
      const invalidData = {
        job: 'B00001234',
        shipment: 'ABC12345678',
        status: 'ADDED',
      };

      await expect(jobWebhookSchema.validate(invalidData)).rejects.toThrow(
        'Shipment ID must match pattern ABCD12345678'
      );
    });

    it('should reject invalid status', async () => {
      const invalidData = {
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'UNKNOWN',
      };

      await expect(jobWebhookSchema.validate(invalidData)).rejects.toThrow('Invalid status');
    });

    it('should reject unknown fields when noUnknown is used', async () => {
      const dataWithExtra = {
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
        extraField: 'should not be here',
      };

      // Since the handler uses stripUnknown: true, test with strict validation
      await expect(
        jobWebhookSchema.validate(dataWithExtra, { stripUnknown: false })
      ).rejects.toThrow();
    });

    it('should strip unknown fields when stripUnknown is true', async () => {
      const dataWithExtra = {
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
        extraField: 'should be removed',
      };

      const result = await jobWebhookSchema.validate(dataWithExtra, {
        stripUnknown: true,
      });

      expect(result).toEqual({
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
      });
      expect(result).not.toHaveProperty('extraField');
    });

    it('should trim whitespace from fields', async () => {
      const dataWithSpaces = {
        job: '  B00001234  ',
        shipment: '  ABCD12345678  ',
        status: '  ADDED  ',
      };

      const result = await jobWebhookSchema.validate(dataWithSpaces);
      expect(result).toEqual({
        job: 'B00001234',
        shipment: 'ABCD12345678',
        status: 'ADDED',
      });
    });

    it('should accept all valid statuses', async () => {
      const statuses = ['ADDED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

      for (const status of statuses) {
        const data = {
          job: 'B00001234',
          shipment: 'ABCD12345678',
          status,
        };

        const result = await jobWebhookSchema.validate(data);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('locationWebhookSchema', () => {
    it('should validate correct location webhook data', async () => {
      const validData = {
        shipment: 'ABCD12345678',
        latitude: '49.0041951',
        longitude: '-122.7322901',
      };

      const result = await locationWebhookSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid latitude', async () => {
      const invalidData = {
        shipment: 'ABCD12345678',
        latitude: '91.0',
        longitude: '-122.7322901',
      };

      await expect(locationWebhookSchema.validate(invalidData)).rejects.toThrow(
        'Invalid latitude: must be between -90 and 90'
      );
    });

    it('should reject invalid longitude', async () => {
      const invalidData = {
        shipment: 'ABCD12345678',
        latitude: '49.0041951',
        longitude: '181.0',
      };

      await expect(locationWebhookSchema.validate(invalidData)).rejects.toThrow(
        'Invalid longitude: must be between -180 and 180'
      );
    });

    it('should accept edge case coordinates', async () => {
      const edgeCases = [
        { latitude: '90', longitude: '180' },
        { latitude: '-90', longitude: '-180' },
        { latitude: '0', longitude: '0' },
      ];

      for (const coords of edgeCases) {
        const data = {
          shipment: 'ABCD12345678',
          ...coords,
        };
        const result = await locationWebhookSchema.validate(data);
        expect(result).toEqual(data);
      }
    });

    it('should reject non-numeric coordinates', async () => {
      const invalidData = {
        shipment: 'ABCD12345678',
        latitude: 'not-a-number',
        longitude: '-122.7322901',
      };

      await expect(locationWebhookSchema.validate(invalidData)).rejects.toThrow('Invalid latitude');
    });
  });

  describe('queryJobSchema', () => {
    it('should validate correct job ID', async () => {
      const validData = {
        jobId: 'B00001234',
      };

      const result = await queryJobSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid job ID format', async () => {
      const invalidData = {
        jobId: 'invalid-format',
      };

      await expect(queryJobSchema.validate(invalidData)).rejects.toThrow(
        'Job ID must match pattern B00000000'
      );
    });

    it('should require job ID', async () => {
      const emptyData = {};

      await expect(queryJobSchema.validate(emptyData)).rejects.toThrow('Job ID is required');
    });
  });
});
