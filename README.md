# Shipment Tracker API

A serverless webhook system that connects Cargowise job creation with Project44 location tracking using AWS Lambda and MongoDB.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Validation System](#validation-system)
- [Connection Management](#connection-management)
- [HTTP Status Codes](#http-status-codes)
- [Code Quality](#code-quality)
- [Testing the API](#testing-the-api)

## Project Overview

This system receives webhooks from two sources:
1. **Cargowise**: Sends job creation notifications
2. **Project44**: Sends real-time location updates

The challenge was to build REST endpoints to receive these webhooks and provide a query endpoint for current shipment location.

## Architecture

### Layered Architecture
```
├── handlers/          # Lambda function handlers (Controllers)
├── services/          # Business logic layer
├── models/           # MongoDB schemas (Mongoose)
├── validators/       # Input validation (Yup)
├── config/          # Database configuration
└── types/           # TypeScript type definitions
```

### Lambda Functions

1. **jobWebhook** - Receives job creation from Cargowise
2. **locationWebhook** - Receives location updates from Project44
3. **queryLocation** - REST endpoint to query current location by job ID
4. **warmup** - Scheduled function to prevent cold starts

## Tech Stack

- **Runtime**: Node.js 18 on AWS Lambda
- **Language**: TypeScript
- **Framework**: Serverless Framework v4
- **Database**: MongoDB with Mongoose
- **Validation**: Yup
- **Documentation**: serverless-auto-swagger
- **Local Development**: Docker + Docker Compose
- **Code Quality**: ESLint + Prettier

## Setup Instructions

### Prerequisites
- Node.js 18.x
- Docker Desktop
- VS Code (for DevContainer)
- Git

### Option 1: VS Code DevContainer (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd shipment-tracker
```

2. **Open in VS Code**
```bash
code .
```

3. **Reopen in Container**
   - Press `F1` or `Ctrl+Shift+P`
   - Type "Dev Containers: Reopen in Container"
   - Click on it and wait for container to build
   - VS Code will reopen inside the container

4. **Install dependencies** (inside container terminal)
```bash
npm install --force
```

5. **Start the application**
```bash
npm run dev
```

### Option 2: Local Development with Docker

1. **Clone and enter directory**
```bash
git clone <repository-url>
cd shipment-tracker
```

2. **Copy environment file**
```bash
cp .env.example .env
```

3. **Edit .env file**
```
ENVIRONMENT=LOCAL
APP_DB_USER=admin
APP_DB_PASSWORD=password
APP_DB_HOST_LOCAL=localhost
APP_DB_HOST_DOCKER=mongo
APP_DB_HOST_PRD=your-atlas-cluster.mongodb.net
APP_DB_PORT=27017
APP_DB_NAME=shipment_tracker
```

4. **Start MongoDB**
```bash
make db-only
# or
docker-compose up -d mongo
```

5. **Install dependencies**
```bash
npm install --force
```

6. **Start the application**
```bash
npm run dev
```

### Option 3: Full Docker Environment

1. **Clone repository**
```bash
git clone <repository-url>
cd shipment-tracker
```

2. **Build and start everything**
```bash
make all
# or
docker-compose up -d
```

3. **View logs**
```bash
make logs
# or
docker-compose logs -f
```

## API Endpoints

### Swagger Documentation
Once the server is running, access the interactive API documentation:
- **Swagger UI**: http://localhost:3000/swagger-ui
- **OpenAPI JSON**: http://localhost:3000/swagger

### 1. Create Job (Webhook)
```
POST /webhook/job
```

**Request Body:**
```json
{
  "job": "B00001234",
  "shipment": "ABCD12345678",
  "status": "ADDED"
}
```

**Response (201 Created):**
```json
{
  "message": "Job created successfully",
  "data": {
    "jobId": "B00001234",
    "shipmentId": "ABCD12345678",
    "status": "ADDED",
    "createdAt": "2025-01-17T10:00:00.000Z",
    "updatedAt": "2025-01-17T10:00:00.000Z"
  }
}
```

### 2. Update Location (Webhook)
```
POST /webhook/location
```

**Request Body:**
```json
{
  "shipment": "ABCD12345678",
  "latitude": "49.0041951",
  "longitude": "-122.7322901"
}
```

**Response (200 OK):**
```json
{
  "message": "Location updated successfully",
  "data": {
    "shipmentId": "ABCD12345678",
    "jobId": "B00001234",
    "location": {
      "latitude": "49.0041951",
      "longitude": "-122.7322901"
    },
    "createdAt": "2025-01-17T10:00:00.000Z",
    "updatedAt": "2025-01-17T10:05:00.000Z"
  }
}
```

### 3. Query Location
```
GET /location/{jobId}
```

**Response (200 OK):**
```json
{
  "job": "B00001234",
  "shipment": "ABCD12345678",
  "status": "ADDED",
  "latitude": "49.0041951",
  "longitude": "-122.7322901",
  "createdAt": "2025-01-17T10:00:00.000Z",
  "updatedAt": "2025-01-17T10:05:00.000Z"
}
```

## Validation System

### Input Validation (Yup)

We use Yup for schema validation with the following rules:

1. **Job ID Pattern**: Must match `B00000000` (B followed by 8 digits)
2. **Shipment ID Pattern**: Must match `ABCD12345678` (4 letters followed by 8 digits)
3. **Status Values**: Only accepts `ADDED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`
4. **Coordinates**:
   - Latitude: Must be between -90 and 90
   - Longitude: Must be between -180 and 180
5. **Unknown Fields**: Rejected to prevent injection

### Business Logic Validation

1. **Job Creation**:
   - Job ID must be unique
   - Shipment cannot already be associated with another job
   - Returns 409 Conflict for violations

2. **Location Updates**:
   - Shipment must exist (404 if not found)
   - Cannot update locations for DELIVERED or CANCELLED shipments
   - Skips updates if location change is less than 11 meters

3. **Query Validation**:
   - Job ID must match the required pattern
   - Returns 404 if job doesn't exist

## Connection Management

### MongoDB Connection Caching

The system reuses MongoDB connections across Lambda invocations to improve performance:

```typescript
// Connection is cached outside the handler
let cachedConnection: typeof mongoose | null = null;

// Inside connectDB function:
if (cachedConnection && cachedConnection.connection.readyState === 1) {
  console.log('Using cached database connection');
  return cachedConnection;
}
```

### Connection Settings
```typescript
const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,  // Close idle connections after 10 seconds
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false
};
```

### Warmup Function

A scheduled Lambda runs every 5 minutes to keep containers warm:
```yaml
warmup:
  handler: src/handlers/warmup.handler
  events:
    - schedule: rate(5 minutes)
```

**Performance Impact:**
- Cold start (new connection): ~500-1500ms
- Warm start (cached connection): ~50-100ms

## HTTP Status Codes

### Success Codes

**201 Created**
- Used when creating a new job via `/webhook/job`
- Indicates a new resource was created in the database

**200 OK**
- Used for location updates via `/webhook/location` (updating existing resource)
- Used for querying locations via `/location/{jobId}` (retrieving data)

### Error Codes

**400 Bad Request**
- Validation errors (invalid format, missing fields, invalid coordinates)
- Returns detailed error messages

**404 Not Found**
- Job doesn't exist when querying
- Shipment doesn't exist when updating location

**409 Conflict**
- Business rule violations:
  - Attempting to create duplicate job
  - Shipment already associated with different job
  - Attempting to update delivered/cancelled shipment

**500 Internal Server Error**
- Unexpected errors (database connection issues, etc.)

## Code Quality

### ESLint Configuration
The project uses ESLint with TypeScript support for code quality:
- Extends recommended ESLint and TypeScript rules
- Integrated with Prettier for formatting
- Warns on explicit `any` types

### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Running Code Quality Checks
```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lintFix

# Format code with Prettier
npm run format
```

## Testing the API

### Test Flow Example

1. **Create a job**
```bash
curl -X POST http://localhost:3000/webhook/job \
  -H "Content-Type: application/json" \
  -d '{
    "job": "B00001234",
    "shipment": "ABCD12345678",
    "status": "ADDED"
  }'
```

2. **Update location**
```bash
curl -X POST http://localhost:3000/webhook/location \
  -H "Content-Type: application/json" \
  -d '{
    "shipment": "ABCD12345678",
    "latitude": "49.0041951",
    "longitude": "-122.7322901"
  }'
```

3. **Query current location**
```bash
curl http://localhost:3000/location/B00001234
```

### Using Insomnia or Postman

Import the following endpoints:
- `POST http://localhost:3000/webhook/job`
- `POST http://localhost:3000/webhook/location`
- `GET http://localhost:3000/location/{jobId}`

## Project Structure

```
shipment-tracker/
├── src/
│   ├── config/
│   │   └── database.ts        # MongoDB connection management
│   ├── handlers/
│   │   ├── jobWebhook.ts      # Job creation handler
│   │   ├── locationWebhook.ts # Location update handler
│   │   ├── queryLocation.ts   # Query handler
│   │   └── warmup.ts          # Connection warming handler
│   ├── models/
│   │   └── Shipment.ts        # Mongoose schema
│   ├── services/
│   │   ├── shipmentService.ts # Business logic
│   │   └── validationService.ts # Business validation rules
│   ├── types/
│   │   ├── api.types.ts   # serverless use it to generate the swagger
│   │   └── types.ts       # TypeScript interfaces
│   └── validators/
│       └── shipmentValidators.ts # Yup schemas
├── .devcontainer/
│   └── devcontainer.json      # VS Code container config
├── .env.example               # Environment template
├── .eslintrc.json            # ESLint config
├── .prettierrc               # Prettier config
├── docker-compose.yml        # Docker services
├── Dockerfile               # Container definition
├── Makefile                # Common commands
├── package.json            # Dependencies
├── serverless.yml          # Serverless config
└── tsconfig.json          # TypeScript config
```

## Environment Variables

```bash
ENVIRONMENT=LOCAL|DOCKER|PRD  # Determines connection string format
APP_DB_USER=admin            # MongoDB username
APP_DB_PASSWORD=password     # MongoDB password
APP_DB_HOST_LOCAL=localhost  # Host for local development
APP_DB_HOST_DOCKER=mongo     # Host for Docker environment
APP_DB_HOST_PRD=cluster.mongodb.net  # MongoDB Atlas host
APP_DB_PORT=27017           # MongoDB port (not used in PRD)
APP_DB_NAME=shipment_tracker # Database name
```

## Deployment

To deploy to AWS:
```bash
npm run deploy
```

To deploy to a specific stage:
```bash
npm run deploy -- --stage production
```

## Notes

- The system starts without location data; locations are added via webhook updates
- Timestamps (`createdAt`/`updatedAt`) are managed automatically by Mongoose
- The warmup function helps maintain performance but can be disabled by removing from serverless.yml
- All endpoints include proper error handling and validation