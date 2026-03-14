import rootConfig from "../../eslint.config.mjs"
import globals from "globals"

export default [
  { ignores: ["dist/", "coverage/"] },
  ...rootConfig,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
]
