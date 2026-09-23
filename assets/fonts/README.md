# Bundled fonts

These normal-style, variable-weight Latin fonts are loaded with `next/font/local`.
They replace the build-time Google Fonts requests while retaining the existing
font families and CSS variables. Commit the `.woff2` files along with source
changes so Docker builds can resolve them without contacting Google Fonts.

| Font | Source package | Version | SHA-256 of the WOFF2 file |
| --- | --- | --- | --- |
| Geist | `@fontsource-variable/geist` | 5.3.0 | `19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1` |
| Geist Mono | `@fontsource-variable/geist-mono` | 5.3.0 | `684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc` |
| Orbitron | `@fontsource-variable/orbitron` | 5.2.8 | `c25a9f9da5d9f3db1bf2a01474722dc9b377675b7bbab6d0dfda6902794fd1ed` |
| Plus Jakarta Sans | `@fontsource-variable/plus-jakarta-sans` | 5.3.0 | `153fc85b70298beeb1d61a5f723331649e7f23bb77302a66e61cb3e2fbdb5e79` |

Files are copied unchanged from the packages' `files/*-latin-wght-normal.woff2`
assets. Each font directory includes its original SIL Open Font License.

The browser-time Noto Sans SC CSS imports are separate from the Next.js font
build pipeline and remain unchanged.
