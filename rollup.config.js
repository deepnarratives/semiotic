import node from "rollup-plugin-node-resolve"
import babel from "rollup-plugin-babel"
import commonjs from "rollup-plugin-commonjs"
import builtins from "rollup-plugin-node-builtins"
import globals from "rollup-plugin-node-globals"
import replace from "rollup-plugin-replace"
import nodent from "rollup-plugin-nodent"
import typescript from "rollup-plugin-typescript"

export default {
  input: "lib/index.js",
  output: {
    format: "umd",
    file: "dist/semiotic.js",
    name: "Semiotic",
    globals: {
      react: "React",
      "react-dom": "ReactDOM"
    }
  },
  /*  exports: "named",
  interop: false,
  , */
  external: ["react", "react-dom"],
  plugins: [
    typescript(),
    node({ browser: true, jsnext: true, preferBuiltins: false }),
    commonjs({
      include: "node_modules/**",
      namedExports: {
        "node_modules/d3-sankey-circular/dist/index.js": [
          "sankeyCircular",
          "sankeyLeft",
          "sankeyCenter",
          "sankeyRight",
          "sankeyJustify"
        ],
        "node_modules/events/events.js": ["EventEmitter"]
      }
    }),
    globals(),
    builtins(),
    babel({
      babelrc: false,
      runtimeHelpers: true,
      presets: [
        "@babel/react",
        [
          "@babel/preset-env",
          {
            modules: false
          }
        ]
      ],
      plugins: [
        ["@babel/plugin-proposal-class-properties"],
        ["@babel/plugin-proposal-decorators", { legacy: true }],
        "@babel/plugin-transform-object-assign",
        "react-require"
      ]
    }),
    nodent({ includeruntime: true, sourcemap: false }),
    replace({
      "process.env.NODE_ENV": '"production"'
    })
  ]
}
