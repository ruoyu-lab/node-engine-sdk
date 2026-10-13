// The published bundle: the package entry plus the shared core stylesheet, which the build
// extracts to `dist/style.css`. Keeping the stylesheet import out of `src` keeps it out of the
// emitted declarations, where TypeScript consumers cannot resolve a `.css` module.
import '@node-engine-sdk/core/view/style.css'

export * from '../src/index.js'
