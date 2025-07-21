import * as yup from 'yup';

// Custom geocoordinate validation
const isValidLatitude = (value: string | undefined): boolean => {
  if (!value) return false;
  const lat = parseFloat(value);
  return !isNaN(lat) && lat >= -90 && lat <= 90;
};

const isValidLongitude = (value: string | undefined): boolean => {
  if (!value) return false;
  const lng = parseFloat(value);
  return !isNaN(lng) && lng >= -180 && lng <= 180;
};

// Job webhook validation schema
export const jobWebhookSchema = yup
  .object({
    job: yup
      .string()
      .required('Job ID is required')
      .matches(/^B\d{8}$/, 'Job ID must match pattern B00000000')
      .trim(),
    shipment: yup
      .string()
      .required('Shipment ID is required')
      .matches(/^[A-Z]{4}\d{8}$/, 'Shipment ID must match pattern ABCD12345678')
      .trim(),
    status: yup
      .string()
      .required('Status is required')
      .oneOf(['ADDED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'], 'Invalid status')
      .trim(),
  })
  .noUnknown(true, 'Unknown fields are not allowed');

// Location webhook validation schema
export const locationWebhookSchema = yup
  .object({
    shipment: yup
      .string()
      .required('Shipment ID is required')
      .matches(/^[A-Z]{4}\d{8}$/, 'Shipment ID must match pattern ABCD12345678')
      .trim(),
    latitude: yup
      .string()
      .required('Latitude is required')
      .test('valid-latitude', 'Invalid latitude: must be between -90 and 90', isValidLatitude)
      .trim(),
    longitude: yup
      .string()
      .required('Longitude is required')
      .test('valid-longitude', 'Invalid longitude: must be between -180 and 180', isValidLongitude)
      .trim(),
    status: yup
      .string()
      .optional()
      .oneOf(['ADDED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'], 'Invalid status')
      .trim(),
  })
  .noUnknown(true, 'Unknown fields are not allowed');

// Query validation schema
export const queryJobSchema = yup.object({
  jobId: yup
    .string()
    .required('Job ID is required')
    .matches(/^B\d{8}$/, 'Job ID must match pattern B00000000')
    .trim(),
});
