import { create } from 'zustand';
import { FileSystemService } from '../services/FileSystemService';
import type { FileNode } from '../types/editor';

interface EditorState {
  // Editor settings
  code: string;
  language: string;
  theme: string;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;

  // File management
  files: Record<string, string>;
  currentFile: string;
  fileTree: FileNode[];
  isSaving: boolean;

  // Actions
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: string) => void;
  setFontSize: (size: number) => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleLineNumbers: () => void;

  // File actions
  initializeWorkspace: () => Promise<void>;
  addFile: (name: string, content: string) => Promise<void>;
  removeFile: (name: string) => Promise<void>;
  renameFile: (oldName: string, newName: string) => Promise<void>;
  switchFile: (name: string) => void;
  saveFile: () => Promise<void>;
  loadFile: (path: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  code: '',
  language: 'solidity',
  theme: 'blockchain-dark',
  fontSize: 14,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,

  files: {},
  currentFile: '',
  fileTree: [],
  isSaving: false,

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
  toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),
  toggleMinimap: () => set((state) => ({ minimap: !state.minimap })),
  toggleLineNumbers: () => set((state) => ({ lineNumbers: !state.lineNumbers })),

  initializeWorkspace: async () => {
    try {
      // Prefer persisted workspace (if any), else fall back to defaults.
      const persisted = await FileSystemService.listFiles('');
      const persistedFiles: Record<string, string> = {};
      for (const f of persisted) {
        if (f.type === 'file' && f.path) {
          persistedFiles[f.path] = f.content ?? '';
        }
      }

      const files = Object.keys(persistedFiles).length > 0 ? persistedFiles : await FileSystemService.getDefaultFiles();
      set({ files });

      const firstFile = Object.keys(files)[0];
      if (firstFile) {
        set({ currentFile: firstFile, code: files[firstFile] });
      }

      set({ fileTree: buildFileTree(files) });
    } catch (error) {
      console.error('Failed to initialize workspace:', error);
    }
  },

  addFile: async (name, content) => {
    const state = get();
    await FileSystemService.saveFile(name, content);
    const newFiles = { ...state.files, [name]: content };
    set({ files: newFiles, fileTree: buildFileTree(newFiles) });
  },

  removeFile: async (name) => {
    const state = get();
    const newFiles = { ...state.files };
    delete newFiles[name];

    if (state.currentFile === name) {
      const remainingFiles = Object.keys(newFiles);
      const nextFile = remainingFiles[0] || '';
      set({
        files: newFiles,
        currentFile: nextFile,
        code: newFiles[nextFile] || '',
        fileTree: buildFileTree(newFiles),
      });
    } else {
      set({ files: newFiles, fileTree: buildFileTree(newFiles) });
    }
  },

  renameFile: async (oldName, newName) => {
    const state = get();
    const content = state.files[oldName];
    if (content == null) return;

    await FileSystemService.saveFile(newName, content);
    await FileSystemService.saveFile(oldName, '');

    const newFiles = { ...state.files };
    newFiles[newName] = content;
    delete newFiles[oldName];

    const newCurrentFile = state.currentFile === oldName ? newName : state.currentFile;
    const newCode = newCurrentFile === newName ? content : state.code;

    set({
      files: newFiles,
      currentFile: newCurrentFile,
      code: newCode,
      fileTree: buildFileTree(newFiles),
    });
  },

  switchFile: (name) => {
    const state = get();
    set({ currentFile: name, code: state.files[name] || '' });
  },

  saveFile: async () => {
    const state = get();
    if (!state.currentFile) return;
    set({ isSaving: true });
    try {
      await FileSystemService.saveFile(state.currentFile, state.code);
      set((s) => ({
        files: { ...s.files, [s.currentFile]: s.code },
        isSaving: false,
      }));
    } catch (error) {
      console.error('Failed to save file:', error);
      set({ isSaving: false });
      throw error;
    }
  },

  loadFile: async (path: string) => {
    const content = await FileSystemService.loadFile(path);
    set({ currentFile: path, code: content });
  },
}));

function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode = { id: 'root', name: '', type: 'folder', children: [] };

  Object.keys(files).forEach((path) => {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children?.find((c) => c.name === part);
      if (!child) {
        child = {
          id: parts.slice(0, i + 1).join('/'),
          name: part,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        current.children ??= [];
        current.children.push(child);
      }

      current = child;
    }
  });

  return root.children || [];
}

