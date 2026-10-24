import { onRequest as __api_js_onRequest } from "/home/claude/count-and-say-repo/functions/api.js"

export const routes = [
    {
      routePath: "/api",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__api_js_onRequest],
    },
  ]