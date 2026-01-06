import { create } from 'zustand';

export type EditorLanguage = 'solidity' | 'rust' | 'move' | 'cairo' | 'typescript';

type EditorState = {
  code: string;
  language: EditorLanguage;
  setCode: (code: string) => void;
  setLanguage: (language: EditorLanguage) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Hello {
  function hello() external pure returns (string memory) {
    return "hello";
  }
}
`,
  language: 'solidity',
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
}));

