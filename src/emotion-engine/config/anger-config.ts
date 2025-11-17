/**
 * Anger Meter Configuration Loader
 * Loads and validates anger_config.yaml
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { AngerConfig } from '../types.js';
import { ConfigLoadError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get default anger configuration
 */
function getDefaultConfig(): AngerConfig {
  return {
    anger_multiplier: 15.0,
    thresholds: {
      irritated: 12,
      agitated: 25,
      enraged: 50,
    },
    decay: {
      idle_rate: 0.3,
      time_decay_enabled: false,
      time_rate: 0.5,
      minimum_floor: 0,
    },
    bonuses: {
      consecutive_anger: 5,
      rapid_escalation: 3,
      vulgar_language: 8,
      direct_insults: 12,
    },
    penalties: {
      apology_reduction: -15,
      calm_language: -3,
      positive_emotion: -8,
    },
    meter: {
      max_points: 100,
      escalation_cooldown: 2,
      de_escalation_immediate: true,
    },
    de_escalation: {
      enraged_apology_requirement: 2,
      apology_memory_limit: 5,
      reset_apology_count_on_anger: true,
    },
    debug: {
      show_meter_in_response: true,
      log_point_changes: true,
    },
  };
}

/**
 * Load anger configuration from YAML file
 * @param configPath - Path to anger_config.yaml (optional, defaults to config/anger_config.yaml)
 * @returns Promise<AngerConfig> - The loaded configuration
 */
export async function loadAngerConfig(
  configPath?: string
): Promise<AngerConfig> {
  try {
    // Default path: src/emotion-engine/config/anger_config.yaml
    // Go up from dist/emotion-engine/config to src/emotion-engine/config
    const projectRoot = join(__dirname, '..', '..', '..');
    const defaultPath = configPath || join(projectRoot, 'src', 'emotion-engine', 'config', 'anger_config.yaml');

    // Read and parse YAML
    const fileContent = await readFile(defaultPath, 'utf-8');
    const config = yaml.load(fileContent) as Partial<AngerConfig>;

    // Merge with defaults to ensure all fields are present
    const defaultConfig = getDefaultConfig();
    const mergedConfig: AngerConfig = {
      anger_multiplier: config.anger_multiplier ?? defaultConfig.anger_multiplier,
      thresholds: {
        irritated: config.thresholds?.irritated ?? defaultConfig.thresholds.irritated,
        agitated: config.thresholds?.agitated ?? defaultConfig.thresholds.agitated,
        enraged: config.thresholds?.enraged ?? defaultConfig.thresholds.enraged,
      },
      decay: {
        idle_rate: config.decay?.idle_rate ?? defaultConfig.decay.idle_rate,
        time_decay_enabled: config.decay?.time_decay_enabled ?? defaultConfig.decay.time_decay_enabled,
        time_rate: config.decay?.time_rate ?? defaultConfig.decay.time_rate,
        minimum_floor: config.decay?.minimum_floor ?? defaultConfig.decay.minimum_floor,
      },
      bonuses: {
        consecutive_anger: config.bonuses?.consecutive_anger ?? defaultConfig.bonuses.consecutive_anger,
        rapid_escalation: config.bonuses?.rapid_escalation ?? defaultConfig.bonuses.rapid_escalation,
        vulgar_language: config.bonuses?.vulgar_language ?? defaultConfig.bonuses.vulgar_language,
        direct_insults: config.bonuses?.direct_insults ?? defaultConfig.bonuses.direct_insults,
      },
      penalties: {
        apology_reduction: config.penalties?.apology_reduction ?? defaultConfig.penalties.apology_reduction,
        calm_language: config.penalties?.calm_language ?? defaultConfig.penalties.calm_language,
        positive_emotion: config.penalties?.positive_emotion ?? defaultConfig.penalties.positive_emotion,
      },
      meter: {
        max_points: config.meter?.max_points ?? defaultConfig.meter.max_points,
        escalation_cooldown: config.meter?.escalation_cooldown ?? defaultConfig.meter.escalation_cooldown,
        de_escalation_immediate: config.meter?.de_escalation_immediate ?? defaultConfig.meter.de_escalation_immediate,
      },
      de_escalation: {
        enraged_apology_requirement: config.de_escalation?.enraged_apology_requirement ?? defaultConfig.de_escalation.enraged_apology_requirement,
        apology_memory_limit: config.de_escalation?.apology_memory_limit ?? defaultConfig.de_escalation.apology_memory_limit,
        reset_apology_count_on_anger: config.de_escalation?.reset_apology_count_on_anger ?? defaultConfig.de_escalation.reset_apology_count_on_anger,
      },
      debug: {
        show_meter_in_response: config.debug?.show_meter_in_response ?? defaultConfig.debug.show_meter_in_response,
        log_point_changes: config.debug?.log_point_changes ?? defaultConfig.debug.log_point_changes,
      },
    };

    return mergedConfig;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      // File not found - return default config
      console.warn(`⚠️  Config file not found, using defaults: ${err.message}`);
      return getDefaultConfig();
    }
    throw new ConfigLoadError(configPath || 'default', err);
  }
}

/**
 * Get default config (for testing or fallback)
 */
export function getDefaultAngerConfig(): AngerConfig {
  return getDefaultConfig();
}

