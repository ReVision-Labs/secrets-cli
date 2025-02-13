import * as YAML from 'https://deno.land/std@0.224.0/yaml/mod.ts';
import { command } from 'npm:cmd-ts';
import { ensureDir } from '../utils.ts';

export const initCommand = command({
  name: 'init',
  description: 'Initialize the Age + SOPS repository',
  args: {},
  handler: async () => {
    // Ensure keys directory exists
    ensureDir('.age-keys');

    // Check if config already exists
    if (await Deno.lstat('.sops.yaml').catch(() => false)) {
      console.error('Configuration file .sops.yaml already exists');
      Deno.exit(1);
    }

    const config = {
      key_registry: {},
      creation_rules: [{ id: 'default', key_groups: [{ age: [] }] }],
    };

    // Write the exact YAML content directly
    const yamlContent = YAML.stringify(config, {
      // indent: 2,
      // lineWidth: 0,
    });

    Deno.writeTextFileSync('.sops.yaml', yamlContent);

    console.log('Initialized Age + SOPS repository');
    console.log('1. Generate your key: ./age-sops generate-key');
    console.log(
      '2. Create additional scopes as needed: ./age-sops create-scope',
    );
  },
});
