/**
 * Prompt Loader Utility
 * Loads markdown prompts from client-specific directories
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PromptLoadError } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded prompts
const promptCache = new Map<string, string>();

/**
 * Get the project root directory
 */
function getProjectRoot(): string {
  // Go up from src/emotion-engine/utils to project root
  return join(__dirname, '..', '..', '..');
}

/**
 * Load a prompt file from the client-specific directory
 * @param promptFile - Name of the prompt file (e.g., "normal_agent.md")
 * @param clientName - Client name (defaults to "synapse" or CLIENT_NAME env var)
 * @returns Promise<string> - The prompt content
 */
export async function loadPrompt(
  promptFile: string,
  clientName?: string
): Promise<string> {
  // Get client name from parameter, env var, or default
  const client = clientName || process.env.CLIENT_NAME || 'synapse';

  // Create cache key
  const cacheKey = `${client}:${promptFile}`;

  // Check cache first
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  try {
    // Build path: prompts/{client}/emotional-state-engine-prompts/{promptFile}
    const projectRoot = getProjectRoot();
    const promptPath = join(
      projectRoot,
      'prompts',
      client,
      'emotional-state-engine-prompts',
      promptFile
    );

    // Read the file
    const content = await readFile(promptPath, 'utf-8');
    const trimmedContent = content.trim();

    // Cache it
    promptCache.set(cacheKey, trimmedContent);

    return trimmedContent;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new PromptLoadError(promptFile, client, err);
    }
    throw new PromptLoadError(promptFile, client, err);
  }
}

/**
 * Clear the prompt cache (useful for testing or reloading)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Preload multiple prompts
 */
export async function preloadPrompts(
  promptFiles: string[],
  clientName?: string
): Promise<void> {
  await Promise.all(
    promptFiles.map((file) => loadPrompt(file, clientName))
  );
}

