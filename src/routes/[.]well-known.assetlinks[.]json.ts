import { createFileRoute } from '@tanstack/react-router'

const relation = 'delegate_permission/common.handle_all_urls'

const association = [{
  relation: [relation],
  target: {
    namespace: 'android_app',
    package_name: 'io.openwaters.slackwater.android',
    sha256_cert_fingerprints: ['3B:38:62:68:B2:0A:14:DD:38:AA:B6:52:41:9E:6B:70:32:86:3F:9E:09:E1:66:EA:98:50:8C:ED:A3:D8:A8:33'],
  },
  relation_extensions: {
    [relation]: {
      // Android 14 and earlier use the app's manifest for path restrictions.
      dynamic_app_link_components: [
        ...(['tides', 'currents'] as const).flatMap((kind) => [
          { '/': `/${kind}/`, exclude: true },
          { '/': `/${kind}/??`, exclude: true },
          { '/': `/${kind}/??/*`, exclude: true },
        ]),
        { '/': '/tides/maizuru', exclude: true },
        { '/': '/tides/maizuru/*', exclude: true },
        { '/': '/tides/*' },
        { '/': '/currents/*' },
      ],
    },
  },
}]

export const Route = createFileRoute('/.well-known/assetlinks.json')({
  server: {
    handlers: {
      GET: () => new Response(JSON.stringify(association), {
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  },
})
