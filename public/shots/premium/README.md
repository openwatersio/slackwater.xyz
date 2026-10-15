# Premium feature screenshots

These WebP images are crops of the examples rendered by `PremiumFeaturePreview` in the iOS app. Keep the visible Example label: each image shows the app's own preview using sample prediction data.

Regenerate the source PNGs with `SlackwaterUITests/SettingsLayoutTests/testPremiumMessagesOpenTheSupportSheetAndReturnToTheirPage`, setting `TEST_RUNNER_M1_SHOT_DIR` to a capture directory. Use an iPhone 18 Pro Max for the 1320 × 2868 source frames. Run under the app repository's test lock and shut down the capture simulator afterward.

The crops from `premium-visuals-top.png` are `(120, 814, 1080, 492)` for `lock-screen.webp` and `(120, 1588, 1080, 368)` for `calendar.webp`. The crop from `premium-visuals-bottom.png` is `(120, 1310, 1080, 424)` for `alert.webp`. Export with `cwebp -q 90 -crop x y width height source.png -o output.webp`. Review every image after regenerating; a changed app layout requires new crop coordinates.
