import * as argon from 'argon2';

/**
 * Hashes a plain text string using Argon2
 * @param password - The text to hash
 * @returns Promise containing the hashed string
 */
export const hash = async (password: string): Promise<string> => {
  return await argon.hash(password);
};

/**
 * Verifies if a plain text matches a hash
 * @param hashedPassword - The hash to verify against
 * @param password - The plain text to verify
 * @returns Promise<boolean> - True if match, false otherwise
 */
export const verifyHash = async (
  hashedPassword: string,
  password: string
): Promise<boolean> => {
  return await argon.verify(hashedPassword, password);
};
