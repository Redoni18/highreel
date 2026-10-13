// `import mod from 'x.wasm?module'` (unwasm, nitro.experimental.wasm): the
// compiled module, for libraries that instantiate it themselves (resvg).
declare module '*.wasm?module' {
  const mod: WebAssembly.Module
  export default mod
}
