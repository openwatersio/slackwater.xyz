import cloudflare from '#cloudflare-handler'
import { agentResponse } from './lib/agent-response'

export default {
  ...cloudflare,
  fetch(request: Request, env: { ASSETS?: { fetch: (request: Request) => Promise<Response> } }, context: unknown) {
    return agentResponse(
      request,
      (retry = request) => cloudflare.fetch(retry, env, context),
      env.ASSETS && ((file = request) => env.ASSETS!.fetch(file)),
    )
  },
}
