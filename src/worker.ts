import cloudflare from '#cloudflare-handler'
import { agentResponse } from './lib/agent-response'

export default {
  ...cloudflare,
  fetch(request: Request, env: unknown, context: unknown) {
    return agentResponse(request, (retry = request) => cloudflare.fetch(retry, env, context))
  },
}
