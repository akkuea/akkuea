#!/bin/bash

# Akkuea API Docker Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     - Start all services (API + Database)"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  logs      - Show logs from all services"
    echo "  api-logs  - Show only API logs"
    echo "  db-logs   - Show only database logs"
    echo "  build     - Build the API container"
    echo "  clean     - Stop services and remove volumes (WARNING: This will delete all data)"
    echo "  status    - Show status of all services"
    echo "  db-shell  - Open PostgreSQL shell"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs"
    echo "  $0 clean"
}

# Function to start services
start_services() {
    print_status "Starting Akkuea API services..."
    docker-compose up -d
    print_success "Services started successfully!"
    print_status "API available at: http://localhost:8080"
    print_status "Database available at: localhost:5432"
}

# Function to stop services
stop_services() {
    print_status "Stopping Akkuea API services..."
    docker-compose down
    print_success "Services stopped successfully!"
}

# Function to restart services
restart_services() {
    print_status "Restarting Akkuea API services..."
    docker-compose restart
    print_success "Services restarted successfully!"
}

# Function to show logs
show_logs() {
    print_status "Showing logs from all services..."
    docker-compose logs -f
}

# Function to show API logs
show_api_logs() {
    print_status "Showing API logs..."
    docker-compose logs -f api
}

# Function to show database logs
show_db_logs() {
    print_status "Showing database logs..."
    docker-compose logs -f postgres
}

# Function to build API
build_api() {
    print_status "Building API container..."
    docker-compose build api
    print_success "API container built successfully!"
}

# Function to clean everything
clean_all() {
    print_warning "This will stop all services and remove all data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up all services and data..."
        docker-compose down -v
        print_success "Cleanup completed successfully!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to show status
show_status() {
    print_status "Service status:"
    docker-compose ps
}

# Function to open database shell
open_db_shell() {
    print_status "Opening PostgreSQL shell..."
    docker exec -it akkuea_postgres psql -U postgres -d akkuea
}

# Main script logic
main() {
    # Check if Docker is running
    check_docker

    # Parse command
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs
            ;;
        api-logs)
            show_api_logs
            ;;
        db-logs)
            show_db_logs
            ;;
        build)
            build_api
            ;;
        clean)
            clean_all
            ;;
        status)
            show_status
            ;;
        db-shell)
            open_db_shell
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
