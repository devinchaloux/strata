/**
 * Minimal type declarations for the File System Access API.
 * Available in Chrome/Edge. Safari/Firefox fall back to download/<input>.
 * Full spec: https://wicg.github.io/file-system-access/
 */

export {}

declare global {
  interface FileSystemFileHandle {
    readonly kind: 'file'
    readonly name: string
    getFile(): Promise<File>
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>
    seek(position: number): Promise<void>
    truncate(size: number): Promise<void>
    close(): Promise<void>
  }

  interface OpenFilePickerOptions {
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
    excludeAcceptAllOption?: boolean
    multiple?: boolean
  }

  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
    excludeAcceptAllOption?: boolean
  }

  interface Window {
    showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  }
}
