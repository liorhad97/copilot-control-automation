/**
 * Utility helper functions used throughout the application
 */

/**
 * Creates a Promise that resolves after the specified time
 * @param ms Number of milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a timestamp string in the format YYYY-MM-DD HH:MM:SS
 * @returns Formatted timestamp string
 */
export function getTimestampString(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Converts a string to camelCase
 * @param str String to convert
 * @returns The string in camelCase format
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/\s(.)/g, ($1) => $1.toUpperCase())
    .replace(/\s/g, '')
    .replace(/^(.)/, ($1) => $1.toLowerCase());
}

/**
 * Generates a simple unique ID
 * @returns Unique ID string
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Retries a function multiple times until it succeeds or reaches the maximum attempts
 * @param fn The function to retry
 * @param maxAttempts Maximum number of retry attempts
 * @param delayMs Delay between attempts in milliseconds
 * @returns Promise resolving to the function result or rejecting with the last error
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Generates a nonce string for use with Content Security Policy
 * @returns Random nonce string
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Format a string to title case
 * @param str String to format
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}