export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  path?: string;
}

export interface EditorTheme {
  name: string;
  base: 'vs' | 'vs-dark' | 'hc-black';
  colors: Record<string, string>;
  rules: Array<{
    token: string;
    foreground: string;
    background?: string;
    fontStyle?: string;
  }>;
}

