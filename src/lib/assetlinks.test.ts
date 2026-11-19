import { describe, expect, it } from 'vitest'
import { Route } from '../routes/[.]well-known.assetlinks[.]json'
import { requiresBeta, WEB_ONLY_TIDE_SLUGS } from './copy'

describe('Android app links', () => {
  it('serves the Play signing certificate and station link rules', async () => {
    const handlers = Route.options.server!.handlers!
    if (typeof handlers === 'function') throw new Error('Expected route handlers')
    const response = await handlers.GET!({} as never) as Response
    expect(response.headers.get('content-type')).toBe('application/json')
    const [statement] = await response.json()
    expect(statement.target).toEqual({
      namespace: 'android_app',
      package_name: 'io.openwaters.slackwater.android',
      sha256_cert_fingerprints: ['3B:38:62:68:B2:0A:14:DD:38:AA:B6:52:41:9E:6B:70:32:86:3F:9E:09:E1:66:EA:98:50:8C:ED:A3:D8:A8:33'],
    })
    expect(statement.relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(statement.relation_extensions['delegate_permission/common.handle_all_urls'].dynamic_app_link_components).toEqual([
      { '/': '/tides/', exclude: true },
      { '/': '/tides/??', exclude: true },
      { '/': '/tides/??/*', exclude: true },
      { '/': '/currents/', exclude: true },
      { '/': '/currents/??', exclude: true },
      { '/': '/currents/??/*', exclude: true },
      ...(requiresBeta('chs-arran-rapids') ? [
        { '/': '/currents/arran-rapids', exclude: true },
        { '/': '/currents/arran-rapids/*', exclude: true },
      ] : []),
      ...WEB_ONLY_TIDE_SLUGS.flatMap((slug) => [
        { '/': `/tides/${slug}`, exclude: true },
        { '/': `/tides/${slug}/*`, exclude: true },
      ]),
      { '/': '/tides/*' },
      { '/': '/currents/*' },
    ])
  })
})
