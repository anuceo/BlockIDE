import { invoke } from '@tauri-apps/api/core';

export interface FileInfo {
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export class FileSystemService {
  static async loadFile(path: string): Promise<string> {
    try {
      return await invoke<string>('load_file', { path });
    } catch (error) {
      console.error('Failed to load file:', error);
      return '';
    }
  }

  static async saveFile(path: string, content: string): Promise<void> {
    await invoke('save_file', { path, content });
  }

  static async listFiles(directory = ''): Promise<FileInfo[]> {
    try {
      return await invoke<FileInfo[]>('list_files', { directory });
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  static async getDefaultFiles(): Promise<Record<string, string>> {
    return {
      'contracts/HelloWorld.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public greeting = "Hello, World!";
    
    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
    
    function getGreeting() public view returns (string memory) {
        return greeting;
    }
}`,
      'scripts/deploy.ts': `import { ethers } from 'ethers';

async function main() {
    console.log('Deploying contract...');
    // Deployment logic here
}

main().catch(console.error);`,
      'tests/HelloWorld.test.ts': `import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('HelloWorld', () => {
    it('Should return the right greeting', async () => {
        const HelloWorld = await ethers.getContractFactory('HelloWorld');
        const helloWorld = await HelloWorld.deploy();
        
        expect(await helloWorld.getGreeting()).to.equal('Hello, World!');
    });
});`,
    };
  }
}

