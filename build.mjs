import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = 'dist'

// 确保输出目录存在
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const ignoreReactDevToolsPlugin = {
    name: "ignore-react-devtools",
    setup(build) {
      // When an import for 'react-devtools-core' is encountered,
      // return an empty module.
      build.onResolve({ filter: /^react-devtools-core$/ }, (args) => {
        return { path: args.path, namespace: "ignore-devtools" };
      });
      build.onLoad({ filter: /.*/, namespace: "ignore-devtools" }, () => {
        return { contents: "", loader: "js" };
      });
    },
  };


  esbuild
  .build({
    entryPoints: ["src/main.tsx"],
    // Do not bundle the contents of package.json at build time: always read it
    // at runtime.
    external: ["../package.json"],
    bundle: true,
    format: "esm",
    platform: "node",

    jsx: 'automatic',
    jsxImportSource: 'react',

    tsconfig: "tsconfig.json",
    outfile: `${OUT_DIR}/main.js`,
    minify: false,
    sourcemap: true,
    plugins: [ignoreReactDevToolsPlugin],
    inject: ["./require-shim.js"],
  })
  .catch(() => process.exit(1));

