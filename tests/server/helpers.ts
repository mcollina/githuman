/**
 * Shared test helpers for server tests
 */

// A test token that meets the 32-character minimum requirement
export const TEST_TOKEN = 'test-secret-token-32-chars-min!!'

// Auth header for use in requests
export function authHeader (token: string = TEST_TOKEN) {
  return { authorization: `Bearer ${token}` }
}
