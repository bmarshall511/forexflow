import rootConfig from "../../eslint.config.mjs"

export default [{ ignores: [".wrangler/", "dist/"] }, ...rootConfig]
