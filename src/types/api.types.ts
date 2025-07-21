export interface JobWebhookRequest {
  /**
   * Job identifier
   * @example "B00001234"
   */
  job: string;

  /**
   * Shipment number
   * @example "ABCD12345678"
   */
  shipment: string;

  /**
   * Status
   * @example "ADDED"
   */
  status: 'ADDED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
}

export interface LocationWebhookRequest {
  /**
   * Shipment number
   * @example "ABCD12345678"
   */
  shipment: string;

  /**
   * Latitude
   * @example "49.0041951"
   */
  latitude: string;

  /**
   * Longitude
   * @example "-122.7322901"
   */
  longitude: string;

  /**
   * Optional status update
   * @example "IN_TRANSIT"
   */
  status?: 'ADDED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
}

// Response Types
export interface JobWebhookResponse {
  message: string;
  data: {
    jobId: string;
    shipmentId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface LocationWebhookResponse {
  message: string;
  data: {
    shipmentId: string;
    jobId: string;
    location: {
      latitude: string;
      longitude: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}

// Query response (from PDF example C)
export interface QueryLocationResponse {
  /**
   * Job identifier
   * @example "B00001234"
   */
  job: string;

  /**
   * Shipment number
   * @example "ABCD12345678"
   */
  shipment: string;

  /**
   * Status
   * @example "ADDED"
   */
  status: 'ADDED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

  /**
   * Latitude (optional - only if location has been set)
   * @example "49.0041951"
   */
  latitude?: string;

  /**
   * Longitude (optional - only if location has been set)
   * @example "-122.7322901"
   */
  longitude?: string;

  /**
   * Creation timestamp
   */
  createdAt: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;
}

// Error Response
export interface ErrorResponse {
  error: string;
  details?: string[];
}
