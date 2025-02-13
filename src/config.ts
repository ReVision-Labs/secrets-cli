import * as YAML from 'https://deno.land/std@0.224.0/yaml/mod.ts';

interface KeyRegistry {
  [publicKey: string]: {
    owner: string;
    email: string;
    added_at: string;
    purpose?: string;
  };
}

interface CreationRule {
  id: string;
  path_regex?: string;
  key_groups: {
    age: string[];
  }[];
}

interface SopsConfig {
  key_registry: KeyRegistry;
  creation_rules: CreationRule[];
}

export function readConfig(): SopsConfig {
  try {
    const configText = Deno.readTextFileSync('.sops.yaml');
    const config = YAML.parse(configText) as SopsConfig;

    // Ensure minimal structure
    config.key_registry = config.key_registry || {};
    config.creation_rules = config.creation_rules || [
      { id: 'default', key_groups: [{ age: [] }] },
    ];

    return config;
  } catch {
    // Return default config if file doesn't exist
    return {
      key_registry: {},
      creation_rules: [{ id: 'default', key_groups: [{ age: [] }] }],
    };
  }
}

export function writeConfig(config: SopsConfig) {
  // Pre-process the config to fix age key formatting
  const processedConfig = {
    ...config,
    creation_rules: config.creation_rules.sort((a, b) => {
      if (a.id === 'default') return 1;
      if (b.id === 'default') return -1;
      return a.id.localeCompare(b.id);
    }),
  };

  // Generate YAML for each section separately
  const keyRegistryYaml = YAML.stringify({
    key_registry: processedConfig.key_registry,
  }).trim();

  const creationRulesYaml = YAML.stringify({
    creation_rules: processedConfig.creation_rules,
  }).trim();

  // Combine with an extra newline
  const yamlContent = `${keyRegistryYaml}\n\n${creationRulesYaml}`;

  Deno.writeTextFileSync('.sops.yaml', yamlContent);
}
