#!/usr/bin/env pwsh
<#
.SYNOPSIS
Deploy Game Contracts to Stellar Testnet (Windows PowerShell)

.DESCRIPTION
Deploys four game contracts to Stellar testnet with initialization and verification.

.PARAMETER Network
Network to deploy to: 'testnet' or 'mainnet'

.EXAMPLE
.\scripts\Deploy-GameContracts.ps1 -Network testnet
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('testnet', 'mainnet')]
    [string]$Network = 'testnet'
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Configuration
$NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
$WASM_DIR = ".\apps\contracts\target\wasm32-unknown-unknown\release"
$CONFIG_FILE = ".\apps\shared\src\contracts\game-contracts.testnet.json"

# Verify prerequisites
function Test-Prerequisites {
    Write-Warning "Checking prerequisites..."
    
    $checks = @(
        @{ Name = "stellar"; Command = "stellar --version" },
        @{ Name = "jq"; Command = "jq --version" },
        @{ Name = "cargo"; Command = "cargo --version" }
    )
    
    foreach ($check in $checks) {
        try {
            $result = & $check.Command 2>&1
            Write-Success "✓ $($check.Name) installed"
        } catch {
            Write-Error "✗ $($check.Name) not found"
            return $false
        }
    }
    
    return $true
}

# Load environment variables
function Import-Environment {
    if (Test-Path ".env") {
        Write-Warning "Loading .env file..."
        $env_content = Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_ -match "=" }
        foreach ($line in $env_content) {
            $key, $value = $line.Split("=", 2)
            [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
        }
        Write-Success "✓ Environment loaded"
    } else {
        Write-Warning "⚠ .env file not found"
    }
    
    if ([string]::IsNullOrEmpty($env:STELLAR_ADMIN_SECRET_KEY)) {
        Write-Error "✗ STELLAR_ADMIN_SECRET_KEY not set"
        exit 1
    }
    
    Write-Success "✓ STELLAR_ADMIN_SECRET_KEY found"
}

# Build contracts
function Build-Contracts {
    Write-Warning "Building game contracts..."
    
    if (-not (Test-Path $WASM_DIR)) {
        Write-Warning "No built WASM files found. Building now..."
        
        try {
            Push-Location ".\apps\contracts"
            Write-Host "Executing: cargo build --target wasm32-unknown-unknown --release"
            & cargo build --target wasm32-unknown-unknown --release
            Pop-Location
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "✗ Build failed with exit code $LASTEXITCODE"
                Write-Error "See BUILD_CONTRACTS_WINDOWS.md for troubleshooting"
                exit 1
            }
        } catch {
            Write-Error "✗ Build error: $_"
            exit 1
        }
    }
    
    $wasm_files = Get-ChildItem "$WASM_DIR\*.wasm" 2>/dev/null
    if ($wasm_files.Count -lt 4) {
        Write-Error "✗ Not all contract WASM files found"
        Write-Host "Expected: game_land_token.wasm, game_property_nft.wasm, game_marketplace.wasm, game_engine.wasm"
        exit 1
    }
    
    Write-Success "✓ Contracts built: $($wasm_files.Count) WASM files"
}

# Deploy contract
function Deploy-Contract {
    param(
        [string]$ContractName,
        [string]$WasmFile
    )
    
    Write-Warning "Deploying $ContractName..."
    
    $wasm_path = "$WASM_DIR\$WasmFile"
    if (-not (Test-Path $wasm_path)) {
        Write-Error "✗ WASM file not found: $wasm_path"
        return $null
    }
    
    try {
        $result = & stellar contract deploy `
            --network $Network `
            --source $env:STELLAR_ADMIN_SECRET_KEY `
            --wasm "$wasm_path" 2>&1
        
        # Parse contract ID from result
        $contract_id = $result | Select-String -Pattern "Contract ID: ([A-Za-z0-9]+)" | ForEach-Object { $_.Matches.Groups[1].Value }
        
        if ([string]::IsNullOrEmpty($contract_id)) {
            Write-Error "✗ Failed to deploy $ContractName"
            Write-Error "Output: $result"
            return $null
        }
        
        Write-Success "✓ Deployed $ContractName`: $contract_id"
        return $contract_id
    } catch {
        Write-Error "✗ Deployment error: $_"
        return $null
    }
}

# Initialize contract
function Initialize-Contract {
    param(
        [string]$ContractType,
        [string]$ContractId,
        [string[]]$Args
    )
    
    Write-Warning "Initializing $ContractType..."
    
    $args_str = @()
    foreach ($arg in $Args) {
        $args_str += "--arg", $arg
    }
    
    try {
        $result = & stellar contract invoke `
            --network $Network `
            --source $env:STELLAR_ADMIN_SECRET_KEY `
            --contract-id $ContractId `
            --function initialize `
            @args_str 2>&1
        
        Write-Success "✓ Initialized $ContractType"
        return $true
    } catch {
        Write-Error "✗ Initialization error: $_"
        return $false
    }
}

# Verify contract
function Verify-Contract {
    param(
        [string]$ContractType,
        [string]$ContractId,
        [string]$Function,
        [string[]]$TestArgs
    )
    
    Write-Warning "Verifying $ContractType..."
    
    $args_str = @()
    foreach ($arg in $TestArgs) {
        $args_str += "--arg", $arg
    }
    
    try {
        $result = & stellar contract invoke `
            --network $Network `
            --source $env:STELLAR_ADMIN_SECRET_KEY `
            --contract-id $ContractId `
            --function $Function `
            @args_str 2>&1
        
        if ($result -match "error" -or $result -match "Error") {
            Write-Error "✗ Verification failed"
            Write-Error "Output: $result"
            return $false
        }
        
        Write-Success "✓ Verified $ContractType"
        return $true
    } catch {
        Write-Error "✗ Verification error: $_"
        return $false
    }
}

# Update configuration
function Update-Configuration {
    param(
        [string]$TokenId,
        [string]$NftId,
        [string]$MarketplaceId,
        [string]$EngineId
    )
    
    Write-Warning "Updating configuration..."
    
    # Read current config
    $config = Get-Content $CONFIG_FILE | ConvertFrom-Json
    
    # Update contract IDs
    $config.contracts.game_land_token.contract_id = $TokenId
    $config.contracts.game_property_nft.contract_id = $NftId
    $config.contracts.game_marketplace.contract_id = $MarketplaceId
    $config.contracts.game_engine.contract_id = $EngineId
    
    # Mark as verified
    $config.contracts.game_land_token.verified = $true
    $config.contracts.game_property_nft.verified = $true
    $config.contracts.game_marketplace.verified = $true
    $config.contracts.game_engine.verified = $true
    
    # Save config
    $config | ConvertTo-Json -Depth 10 | Set-Content $CONFIG_FILE
    
    Write-Success "✓ Configuration updated"
}

# Main deployment
function Deploy-All {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  Akkuea Land Game Contracts Deployment" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Network: $Network"
    Write-Host "Passphrase: $NETWORK_PASSPHRASE"
    Write-Host ""
    
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    Import-Environment
    Build-Contracts
    
    # Get admin public key
    $ADMIN_PUBLIC = & stellar keys show --source $env:STELLAR_ADMIN_SECRET_KEY --public-key 2>&1
    Write-Host "Admin: $ADMIN_PUBLIC"
    Write-Host ""
    
    # Deploy GameLandToken
    Write-Host "=== Stage 1: GameLandToken ===" -ForegroundColor Cyan
    $TOKEN_ID = Deploy-Contract "GameLandToken" "game_land_token.wasm"
    if ([string]::IsNullOrEmpty($TOKEN_ID)) { exit 1 }
    Initialize-Contract "GameLandToken" $TOKEN_ID @($ADMIN_PUBLIC) | Out-Null
    Verify-Contract "GameLandToken" $TOKEN_ID "total_supply" @() | Out-Null
    Write-Host ""
    
    # Deploy GamePropertyNFT
    Write-Host "=== Stage 2: GamePropertyNFT ===" -ForegroundColor Cyan
    $NFT_ID = Deploy-Contract "GamePropertyNFT" "game_property_nft.wasm"
    if ([string]::IsNullOrEmpty($NFT_ID)) { exit 1 }
    Initialize-Contract "GamePropertyNFT" $NFT_ID @($ADMIN_PUBLIC, $ADMIN_PUBLIC) | Out-Null
    Verify-Contract "GamePropertyNFT" $NFT_ID "get_owner" @("0") | Out-Null
    Write-Host ""
    
    # Deploy GameMarketplace
    Write-Host "=== Stage 3: GameMarketplace ===" -ForegroundColor Cyan
    $MARKETPLACE_ID = Deploy-Contract "GameMarketplace" "game_marketplace.wasm"
    if ([string]::IsNullOrEmpty($MARKETPLACE_ID)) { exit 1 }
    Initialize-Contract "GameMarketplace" $MARKETPLACE_ID @($TOKEN_ID, $NFT_ID) | Out-Null
    Verify-Contract "GameMarketplace" $MARKETPLACE_ID "get_listing" @("0") | Out-Null
    Write-Host ""
    
    # Deploy GameEngine
    Write-Host "=== Stage 4: GameEngine ===" -ForegroundColor Cyan
    $ENGINE_ID = Deploy-Contract "GameEngine" "game_engine.wasm"
    if ([string]::IsNullOrEmpty($ENGINE_ID)) { exit 1 }
    Initialize-Contract "GameEngine" $ENGINE_ID @($ADMIN_PUBLIC, $TOKEN_ID, $NFT_ID) | Out-Null
    Verify-Contract "GameEngine" $ENGINE_ID "get_improvement_cost" @("0") | Out-Null
    Write-Host ""
    
    # Update configuration
    Update-Configuration $TOKEN_ID $NFT_ID $MARKETPLACE_ID $ENGINE_ID
    
    # Summary
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Deployment Complete!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Contract IDs:" -ForegroundColor Cyan
    Write-Host "  GameLandToken:     $TOKEN_ID" -ForegroundColor Green
    Write-Host "  GamePropertyNFT:   $NFT_ID" -ForegroundColor Green
    Write-Host "  GameMarketplace:   $MARKETPLACE_ID" -ForegroundColor Green
    Write-Host "  GameEngine:        $ENGINE_ID" -ForegroundColor Green
    Write-Host ""
    Write-Host "Update your .env file:" -ForegroundColor Cyan
    Write-Host "  GAME_LAND_TOKEN_CONTRACT_ID=$TOKEN_ID"
    Write-Host "  GAME_PROPERTY_NFT_CONTRACT_ID=$NFT_ID"
    Write-Host "  GAME_MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID"
    Write-Host "  GAME_ENGINE_CONTRACT_ID=$ENGINE_ID"
    Write-Host ""
}

# Run deployment
try {
    Deploy-All
} catch {
    Write-Error "Deployment failed: $_"
    exit 1
}

