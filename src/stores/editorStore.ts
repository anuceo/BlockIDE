import { create } from 'zustand';

export type EditorLanguage = 'solidity' | 'rust' | 'move' | 'cairo' | 'typescript' | 'javascript';

export type EditorTheme = 'blockchain-dark' | 'blockchain-light';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface EditorState {
  // editor settings
  code: string;
  language: EditorLanguage;
  theme: EditorTheme;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;

  // simple in-memory files
  files: Record<string, string>;
  currentFile: string;
  fileTree: FileNode[];

  // actions
  setCode: (code: string) => void;
  setLanguage: (language: EditorLanguage) => void;
  setTheme: (theme: EditorTheme) => void;
  setFontSize: (size: number) => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleLineNumbers: () => void;

  addFile: (name: string, content: string) => void;
  removeFile: (name: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  switchFile: (name: string) => void;
  saveFile: () => void;
}

const helloWorldSolidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract HelloWorld {
  string public greeting = "Hello, World!";

  function setGreeting(string memory _greeting) public {
    greeting = _greeting;
  }

  function getGreeting() public view returns (string memory) {
    return greeting;
  }
}
`;

export const useEditorStore = create<EditorState>((set, get) => ({
  code: helloWorldSolidity,
  language: 'solidity',
  theme: 'blockchain-dark',
  fontSize: 14,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,

  files: {
    'contracts/HelloWorld.sol': helloWorldSolidity,
  },
  currentFile: 'contracts/HelloWorld.sol',
  fileTree: [
    {
      id: 'contracts',
      name: 'contracts',
      type: 'folder',
      children: [{ id: 'contracts/HelloWorld.sol', name: 'HelloWorld.sol', type: 'file' }],
    },
    { id: 'scripts', name: 'scripts', type: 'folder', children: [] },
    { id: 'tests', name: 'tests', type: 'folder', children: [] },
  ],

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
  toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),
  toggleMinimap: () => set((s) => ({ minimap: !s.minimap })),
  toggleLineNumbers: () => set((s) => ({ lineNumbers: !s.lineNumbers })),

  addFile: (name, content) =>
    set((state) => ({
      files: { ...state.files, [name]: content },
    })),

  removeFile: (name) =>
    set((state) => {
      const next = { ...state.files };
      delete next[name];
      const nextCurrent = state.currentFile === name ? Object.keys(next)[0] ?? '' : state.currentFile;
      return {
        files: next,
        currentFile: nextCurrent,
        code: nextCurrent ? next[nextCurrent] ?? '' : '',
      };
    }),

  renameFile: (oldName, newName) =>
    set((state) => {
      const next = { ...state.files };
      next[newName] = next[oldName];
      delete next[oldName];
      const nextCurrent = state.currentFile === oldName ? newName : state.currentFile;
      return { files: next, currentFile: nextCurrent };
    }),

  switchFile: (name) => {
    const content = get().files[name] ?? '';
    set({ currentFile: name, code: content });
  },

  saveFile: () => {
    const { currentFile, code, files } = get();
    if (!currentFile) return;
    set({ files: { ...files, [currentFile]: code } });
  },
}));

