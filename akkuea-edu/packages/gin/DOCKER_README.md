# Akkuea API - Docker Setup

This directory contains the Docker configuration for the Akkuea API, which includes a Gin-based REST API and PostgreSQL database.

## Architecture

The Docker setup consists of:

- **API Service**: Gin-based REST API (Go)
- **Database**: PostgreSQL 15 with seeded data
- **Networking**: Custom bridge network for service communication

## Database Schema

The API uses the following database tables:

### Users Table

- `id` (Primary Key)
- `name` (VARCHAR 100, NOT NULL)
- `role` (VARCHAR 20, NOT NULL) - Values: 'Educator', 'Student', 'Designer'
- `email` (VARCHAR 100, UNIQUE, NOT NULL)
- `password` (VARCHAR 255, NOT NULL) - Hashed password
- `tokens` (INTEGER, DEFAULT 0)
- `created_at`, `updated_at`, `deleted_at` (GORM timestamps)

### Resources Table

- `id` (Primary Key)
- `title` (VARCHAR 200, NOT NULL)
- `content` (TEXT)
- `language` (VARCHAR 10)
- `format` (VARCHAR 50) - Values: 'pdf', 'video', 'audio', 'text', etc.
- `creator_id` (Foreign Key to users.id)
- `created_at`, `updated_at`, `deleted_at` (GORM timestamps)

### Rewards Table

- `id` (Primary Key)
- `user_id` (Foreign Key to users.id)
- `token_amount` (INTEGER, NOT NULL)
- `reason` (VARCHAR 200)
- `created_at`, `updated_at`, `deleted_at` (GORM timestamps)

### Marketplace Requests Table

- `id` (Primary Key)
- `requester_id` (Foreign Key to users.id)
- `designer_id` (Foreign Key to users.id, NULLABLE)
- `status` (VARCHAR 20, DEFAULT 'open') - Values: 'open', 'assigned', 'completed', 'cancelled'
- `payment_amount` (DECIMAL 10,2)
- `created_at`, `updated_at`, `deleted_at` (GORM timestamps)

## Quick Start

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. **Start all services:**

   ```bash
   docker-compose up -d
   ```

2. **View logs:**

   ```bash
   docker-compose logs -f
   ```

3. **Stop all services:**
   ```bash
   docker-compose down
   ```

### Accessing the Services

- **API**: http://localhost:8080
- **Database**: localhost:5432
  - Database: `akkuea`
  - Username: `postgres`
  - Password: `secret`

## API Endpoints

The API provides the following endpoints:

### Public Endpoints

- `GET /ping` - Health check
- `GET /health` - Detailed health status
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

### Protected Endpoints (require JWT token)

- `GET /users` - Get all users
- `GET /users/:id` - Get specific user by ID
- `POST /users` - Create a new user
- `GET /auth/me` - Get current user information

### Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Database Setup

The database will be automatically initialized with the required tables when the API starts. GORM will handle the schema creation and migrations.

## Environment Variables

### API Service

- `DB_HOST`: Database host (default: postgres)
- `DB_USER`: Database username (default: postgres)
- `DB_PASSWORD`: Database password (default: secret)
- `DB_NAME`: Database name (default: akkuea)
- `DB_PORT`: Database port (default: 5432)
- `PORT`: API port (default: 8080)

### Database Service

- `POSTGRES_DB`: Database name (default: akkuea)
- `POSTGRES_USER`: Database username (default: postgres)
- `POSTGRES_PASSWORD`: Database password (default: secret)

## Development

### Rebuilding the API

```bash
docker-compose build api
docker-compose up -d
```

### Accessing the Database

```bash
# Connect to PostgreSQL container
docker exec -it akkuea_postgres psql -U postgres -d akkuea

# Or use a database client with these credentials:
# Host: localhost
# Port: 5432
# Database: akkuea
# Username: postgres
# Password: secret
```

### Viewing API Logs

```bash
docker-compose logs -f api
```

### Viewing Database Logs

```bash
docker-compose logs -f postgres
```

## Data Persistence

- Database data is persisted in a Docker volume named `postgres_data`
- To completely reset the database:
  ```bash
  docker-compose down -v
  docker-compose up -d
  ```

## Troubleshooting

### Common Issues

1. **Port already in use:**

   - Change the port mappings in `docker-compose.yml`
   - Or stop other services using the same ports

2. **Database connection issues:**

   - Ensure the database container is healthy before starting the API
   - Check the database logs: `docker-compose logs postgres`

3. **API not starting:**
   - Check API logs: `docker-compose logs api`
   - Ensure all environment variables are set correctly

### Health Checks

The setup includes health checks for the database service. The API will wait for the database to be healthy before starting.

## Production Considerations

For production deployment:

1. **Security:**

   - Change default passwords
   - Use environment-specific configuration
   - Enable SSL for database connections

2. **Performance:**

   - Adjust database connection pool settings
   - Configure proper resource limits
   - Use production-grade PostgreSQL configuration

3. **Monitoring:**
   - Add logging aggregation
   - Implement health check endpoints
   - Set up metrics collection

## File Structure

```
packages/gin/
├── Dockerfile                 # API container definition
├── docker-compose.yml         # Multi-service orchestration
├── .dockerignore             # Docker build exclusions
├── DOCKER_README.md          # This file
├── main.go                   # API entry point
├── config/                   # Configuration files
├── models/                   # Database models
├── api/                      # API handlers
├── middleware/               # Middleware components
└── services/                 # Business logic
```
