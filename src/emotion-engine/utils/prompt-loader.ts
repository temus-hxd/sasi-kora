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
 * Works in both local development and Vercel serverless environments
 */
function getProjectRoot(): string {
  // In Vercel serverless, process.cwd() points to the project root
  // In local dev, if running from dist/, we need to go up
  const cwd = process.cwd();
  const fromCompiled = join(__dirname, '..', '..', '..');
  
  // Default to cwd (works in Vercel and local when running from root)
  // If we're in a dist/ directory, use the compiled location path
  if (__dirname.includes('dist')) {
    return fromCompiled;
  }
  
  return cwd;
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
    
    // Try multiple possible paths (for different deployment scenarios)
    const possiblePaths = [
      join(projectRoot, 'prompts', client, 'emotional-state-engine-prompts', promptFile),
      join(process.cwd(), 'prompts', client, 'emotional-state-engine-prompts', promptFile),
      join(__dirname, '..', '..', '..', 'prompts', client, 'emotional-state-engine-prompts', promptFile),
    ];
    
    let content: string | null = null;
    let successfulPath: string | null = null;
    
    // Try each path until one works
    for (const promptPath of possiblePaths) {
      try {
        console.log(`📄 Trying to load prompt: ${promptFile} (client: ${client})`);
        console.log(`   Attempting path: ${promptPath}`);
        
        content = await readFile(promptPath, 'utf-8');
        successfulPath = promptPath;
        break;
      } catch (pathError) {
        // Try next path
        continue;
      }
    }
    
    if (!content) {
      throw new Error(`Prompt file not found in any of the attempted paths: ${possiblePaths.join(', ')}`);
    }
    
    const trimmedContent = content.trim();
    console.log(`✅ Loaded prompt: ${promptFile} (${trimmedContent.length} chars) from ${successfulPath}`);

    // Cache it
    promptCache.set(cacheKey, trimmedContent);

    return trimmedContent;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const projectRoot = getProjectRoot();
    const attemptedPath = join(
      projectRoot,
      'prompts',
      client,
      'emotional-state-engine-prompts',
      promptFile
    );
    console.error(`❌ Failed to load prompt file: ${promptFile}`);
    console.error(`   Client: ${client}`);
    console.error(`   Attempted path: ${attemptedPath}`);
    console.error(`   Project root: ${projectRoot}`);
    console.error(`   Error: ${err.message} (code: ${err.code})`);
    
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

