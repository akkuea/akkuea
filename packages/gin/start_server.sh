#!/bin/bash
export JWT_SECRET=test-jwt-secret
export PORT=8080
export DB_HOST=localhost
export DB_NAME=test
export DB_USER=$(whoami)
./gin
