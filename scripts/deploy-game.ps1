param([string]$Network = 'testnet')

$WASM_DIR = ".\apps\contracts\target\wasm32-unknown-unknown\release"
$CONFIG_FILE = ".\apps\shared\src\contracts\game-contracts.testnet.json"

if ([string]::IsNullOrEmpty($env:STELLAR_ADMIN_SECRET_KEY)) {
    Write-Host "ERROR: STELLAR_ADMIN_SECRET_KEY not set" -ForegroundColor Red
    exit 1
}

$admin_public = & stellar keys show admin
Write-Host "Admin: $admin_public" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploying GameLandToken ===" -ForegroundColor Cyan
$token_output = & stellar contract deploy --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --wasm "$WASM_DIR\game_land_token.wasm" 2>&1 | Out-String
$token_id = ($token_output | Select-String "Contract ID:" | Select-Object -First 1).ToString().Split(":")[1].Trim()
Write-Host "Token: $token_id" -ForegroundColor Green

& stellar contract invoke --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --contract-id $token_id --function initialize --arg $admin_public 2>&1 | Out-Null
Write-Host "Token initialized" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploying GamePropertyNFT ===" -ForegroundColor Cyan
$nft_output = & stellar contract deploy --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --wasm "$WASM_DIR\game_property_nft.wasm" 2>&1 | Out-String
$nft_id = ($nft_output | Select-String "Contract ID:" | Select-Object -First 1).ToString().Split(":")[1].Trim()
Write-Host "NFT: $nft_id" -ForegroundColor Green

& stellar contract invoke --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --contract-id $nft_id --function initialize --arg $admin_public --arg $admin_public 2>&1 | Out-Null
Write-Host "NFT initialized" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploying GameMarketplace ===" -ForegroundColor Cyan
$mp_output = & stellar contract deploy --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --wasm "$WASM_DIR\game_marketplace.wasm" 2>&1 | Out-String
$mp_id = ($mp_output | Select-String "Contract ID:" | Select-Object -First 1).ToString().Split(":")[1].Trim()
Write-Host "Marketplace: $mp_id" -ForegroundColor Green

& stellar contract invoke --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --contract-id $mp_id --function initialize --arg $token_id --arg $nft_id 2>&1 | Out-Null
Write-Host "Marketplace initialized" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploying GameEngine ===" -ForegroundColor Cyan
$eng_output = & stellar contract deploy --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --wasm "$WASM_DIR\game_engine.wasm" 2>&1 | Out-String
$eng_id = ($eng_output | Select-String "Contract ID:" | Select-Object -First 1).ToString().Split(":")[1].Trim()
Write-Host "Engine: $eng_id" -ForegroundColor Green

& stellar contract invoke --network $Network --source $env:STELLAR_ADMIN_SECRET_KEY --contract-id $eng_id --function initialize --arg $admin_public --arg $token_id --arg $nft_id 2>&1 | Out-Null
Write-Host "Engine initialized" -ForegroundColor Green

Write-Host ""
Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host "Token:       $token_id" -ForegroundColor Cyan
Write-Host "NFT:         $nft_id" -ForegroundColor Cyan
Write-Host "Marketplace: $mp_id" -ForegroundColor Cyan
Write-Host "Engine:      $eng_id" -ForegroundColor Cyan
