#!/bin/bash

set -euo pipefail

echo "Installing blockchain development tools..."

# Install npm if not present
if ! command -v npm &> /dev/null; then
    echo "Installing npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Ganache
echo "Installing Ganache..."
npm install -g ganache

# Install Foundry (includes Anvil)
echo "Installing Foundry..."
curl -L https://foundry.paradigm.xyz | bash
# shellcheck disable=SC1090
source ~/.bashrc || true
foundryup

# Install solc
echo "Installing solc..."
npm install -g solc

# Install testing frameworks
echo "Installing testing frameworks..."
npm install -g hardhat truffle

# Install security tools
echo "Installing security tools..."
npm install -g solhint
npm install -g @trailofbits/eth-security-toolbox
pip3 install slither-analyzer mythril

echo "Installation complete!"
echo "Available tools:"
echo "  - Ganache: ganache --version"
echo "  - Anvil: anvil --version"
echo "  - solcjs: solcjs --version"
echo "  - Hardhat: npx hardhat --version"
echo "  - Truffle: npx truffle version"
echo "  - Slither: slither --version"
echo "  - Mythril: myth --version"

