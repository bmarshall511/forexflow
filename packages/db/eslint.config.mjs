import rootConfig from "../../eslint.config.mjs"

export default [{ ignores: ["dist/", "coverage/", "src/generated/"] }, ...rootConfig]
