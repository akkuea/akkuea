# Akkuea Gin Backend

A modular, production-ready backend for Akkuea, built with the Gin web framework in Go.

## 🚀 Project Overview

This backend provides a scalable foundation for Akkuea, featuring:

- Modular folder structure (api, models, services, config, middleware)
- Environment variable management
- Example `/ping` endpoint
- Ready for PostgreSQL integration and further expansion

## 🛠️ Setup Instructions

### 1. Clone the repository

```sh
git clone https://github.com/akkuea/akkuea
cd packages/gin
```

### 2. Install dependencies

```sh
go mod tidy
```

### 3. Configure environment variables

Copy the env file with

```sh
cp .env.example .env
```

### 4. Run the server

```sh
go run main.go
```

### 5. Test the `/ping` endpoint

Visit [http://localhost:8080/ping](http://localhost:8080/ping) or use cURL:

```sh
curl http://localhost:8080/ping
```

Expected response:

```json
{ "message": "pong" }
```

## 🌱 Environment Variables

| Variable    | Description       | Default   |
| ----------- | ----------------- | --------- |
| PORT        | Server port       | 8080      |
| DB_HOST     | Database host     | localhost |
| DB_USER     | Database user     | postgres  |
| DB_PASSWORD | Database password | secret    |
| DB_NAME     | Database name     | akkuea    |
| DB_PORT     | Database port     | 5432      |

## 🐞 Troubleshooting

- **Port already in use:** Change the `PORT` in your `.env` file.
- **.env not loaded:** Ensure you have a `.env` file and `github.com/joho/godotenv` is installed.
- **Cannot access `/ping`:** Check that the server is running and you are visiting the correct port.

## 📁 Project Structure

```
.
├── api/         # Route handlers
├── config/      # Configuration loading
├── middleware/  # Custom middleware
├── models/      # Data models
├── services/    # Business logic
├── main.go      # Application entry point
└── README.md    # Project documentation
```

---

For questions or contributions, please open an issue or pull request!
