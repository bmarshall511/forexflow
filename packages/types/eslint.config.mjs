import rootConfig from "../../eslint.config.mjs"

export default [{ ignores: ["dist/", "generated/"] }, ...rootConfig]
