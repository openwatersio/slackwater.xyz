/**
 * The public beta link — the app's one external TestFlight group, "Beta".
 *
 * There is a single group, so every tester gets the same link and this is it.
 * Shared by the homepage hero and every station page, so the link that reaches
 * the public is defined once rather than copied to a second file that can drift
 * onto a stale one. The six pages under `src/content/compare` spell it out in
 * their own prose and have to be changed with it.
 */
export const TESTFLIGHT: string | null = 'https://testflight.apple.com/join/5gwh791N'
