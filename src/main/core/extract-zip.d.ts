declare module 'extract-zip' {
  interface ExtractOptions {
    dir: string
  }
  function extract(zipPath: string, opts: ExtractOptions): Promise<void>
  export default extract
}
