#!/usr/bin/env bash

# Deploy Game Contracts to Stellar Testnet
# Usage: ./deploy-game-contracts.sh <network>
# Example: ./deploy-game-contracts.sh testnet

set -e

NETWORK=${1:-testnet}
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v stellar &> /dev/null; then
        echo -e "${RED}Error: stellar CLI not found${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites OK${NC}"
}

# Load environment variables
load_env() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '#' | xargs)
    fi
    
    if [ -z "$STELLAR_ADMIN_SECRET_KEY" ]; then
        echo -e "${RED}Error: STELLAR_ADMIN_SECRET_KEY not set${NC}"
        exit 1
    fi
}

# Build contracts
build_contracts() {
    echo -e "${YELLOW}Building game contracts...${NC}"
    
    cd apps/contracts
    cargo build --target wasm32-unknown-unknown --release
    
    echo -e "${GREEN}✓ Contracts built${NC}"
}

# Get WASM file path
get_wasm_path() {
    local contract_name=$1
    echo "target/wasm32-unknown-unknown/release/${contract_name}.wasm"
}

# Deploy a contract
deploy_contract() {
    local contract_name=$1
    local wasm_path=$2
    
    echo -e "${YELLOW}Deploying $contract_name...${NC}"
    
    # Deploy via Stellar CLI
    local result=$(stellar contract deploy \
        --network $NETWORK \
        --source $STELLAR_ADMIN_SECRET_KEY \
        --wasm "$wasm_path" 2>&1)
    
    # Extract contract ID from result
    local contract_id=$(echo "$result" | grep -oP 'Contract ID: \K[A-Za-z0-9]+' || echo "")
    
    if [ -z "$contract_id" ]; then
        echo -e "${RED}Error: Failed to deploy $contract_name${NC}"
        echo "$result"
        return 1
    fi
    
    echo -e "${GREEN}✓ Deployed $contract_name: $contract_id${NC}"
    echo "$contract_id"
}

# Initialize contract
initialize_contract() {
    local contract_id=$1
    local contract_type=$2
    local args=$3
    
    echo -e "${YELLOW}Initializing $contract_type...${NC}"
    
    local result=$(stellar contract invoke \
        --network $NETWORK \
        --source $STELLAR_ADMIN_SECRET_KEY \
        --contract-id "$contract_id" \
        --function initialize \
        $args 2>&1)
    
    echo -e "${GREEN}✓ Initialized $contract_type${NC}"
    echo "$result"
}

# Verify contract
verify_contract() {
    local contract_id=$1
    local contract_type=$2
    
    echo -e "${YELLOW}Verifying $contract_type...${NC}"
    
    local result=$(stellar contract invoke \
        --network $NETWORK \
        --source $STELLAR_ADMIN_SECRET_KEY \
        --contract-id "$contract_id" \
        --function get_accrued_income \
        --arg 0 \
        --arg 0 \
        --arg 0 2>&1 || true)
    
    if [[ $result == *"error"* ]] || [[ $result == *"Error"* ]]; then
        echo -e "${RED}✗ Verification failed for $contract_type${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Verified $contract_type${NC}"
}

# Main deployment flow
main() {
    echo -e "${YELLOW}=== Game Contract Deployment ===${NC}"
    echo "Network: $NETWORK"
    echo "Passphrase: $NETWORK_PASSPHRASE"
    echo ""
    
    check_prerequisites
    load_env
    
    # Build contracts
    build_contracts
    
    # Deploy GameLandToken (no dependencies)
    echo ""
    echo -e "${YELLOW}=== Deploying GameLandToken ===${NC}"
    TOKEN_ID=$(deploy_contract "game_land_token" "$(get_wasm_path 'game_land_token')")
    initialize_contract "$TOKEN_ID" "GameLandToken" "--arg '$STELLAR_ADMIN_PUBLIC_KEY'"
    verify_contract "$TOKEN_ID" "GameLandToken"
    
    # Deploy GamePropertyNFT (no dependencies)
    echo ""
    echo -e "${YELLOW}=== Deploying GamePropertyNFT ===${NC}"
    NFT_ID=$(deploy_contract "game_property_nft" "$(get_wasm_path 'game_property_nft')")
    initialize_contract "$NFT_ID" "GamePropertyNFT" "--arg '$STELLAR_ADMIN_PUBLIC_KEY' --arg '$STELLAR_ADMIN_PUBLIC_KEY'"
    verify_contract "$NFT_ID" "GamePropertyNFT"
    
    # Deploy GameMarketplace (depends on TOKEN and NFT)
    echo ""
    echo -e "${YELLOW}=== Deploying GameMarketplace ===${NC}"
    MARKETPLACE_ID=$(deploy_contract "game_marketplace" "$(get_wasm_path 'game_marketplace')")
    initialize_contract "$MARKETPLACE_ID" "GameMarketplace" "--arg '$TOKEN_ID' --arg '$NFT_ID'"
    verify_contract "$MARKETPLACE_ID" "GameMarketplace"
    
    # Deploy GameEngine (depends on all)
    echo ""
    echo -e "${YELLOW}=== Deploying GameEngine ===${NC}"
    ENGINE_ID=$(deploy_contract "game_engine" "$(get_wasm_path 'game_engine')")
    initialize_contract "$ENGINE_ID" "GameEngine" "--arg '$STELLAR_ADMIN_PUBLIC_KEY' --arg '$TOKEN_ID' --arg '$NFT_ID'"
    verify_contract "$ENGINE_ID" "GameEngine"
    
    # Save contract IDs
    echo ""
    echo -e "${YELLOW}=== Deployment Complete ===${NC}"
    echo ""
    echo "Contract IDs:"
    echo "  GameLandToken:     $TOKEN_ID"
    echo "  GamePropertyNFT:   $NFT_ID"
    echo "  GameMarketplace:   $MARKETPLACE_ID"
    echo "  GameEngine:        $ENGINE_ID"
    echo ""
    echo "Update your .env file with these values:"
    echo "  GAME_LAND_TOKEN_CONTRACT_ID=$TOKEN_ID"
    echo "  GAME_PROPERTY_NFT_CONTRACT_ID=$NFT_ID"
    echo "  GAME_MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID"
    echo "  GAME_ENGINE_CONTRACT_ID=$ENGINE_ID"
}

main "$@"
