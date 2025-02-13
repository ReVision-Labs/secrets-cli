import { command, option, optional, string, subcommands } from 'npm:cmd-ts';
import { nameOption, emailOption, scopesOption } from '../params.ts';
import { ensureDir, sanitizeName } from '../utils.ts';
import { readConfig, writeConfig } from '../config.ts';
import * as path from 'https://deno.land/std@0.224.0/path/mod.ts';
import { flag } from 'npm:cmd-ts';

const generateKeyCommand = command({
  name: 'generate',
  description: 'Generate a new encryption key',
  args: {
    name: nameOption,
    email: emailOption,
    scopes: scopesOption,
    purpose: option({ type: optional(string), long: 'purpose' }),
  },
  handler: async ({ name, email, scopes: rawScopes, purpose }) => {
    // Ensure keys directory exists
    ensureDir('.age-keys');

    // Sanitize name for filename
    const safeName = sanitizeName(name);
    const keyPath = path.join('.age-keys', `${safeName}.txt`);

    // Generate age key
    const genCmd = new Deno.Command('age-keygen', {
      args: ['-o', keyPath],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { success } = await genCmd.output();

    if (!success) {
      console.error('Failed to generate key');
      Deno.exit(1);
    }

    // Extract public key
    const pubKeyCmd = new Deno.Command('age-keygen', {
      args: ['-y', keyPath],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { stdout } = await pubKeyCmd.output();
    const publicKey = new TextDecoder().decode(stdout).trim();

    // Read and update config
    const config = readConfig();

    // Add to key registry
    config.key_registry[publicKey] = {
      owner: name,
      email: email,
      added_at: new Date().toISOString().split('T')[0],
      ...(purpose ? { purpose } : {}),
    };

    // Add to scopes
    const scopes = rawScopes.split(',');

    scopes.forEach((scope) => {
      const scopeRule = config.creation_rules.find((rule) => rule.id === scope);
      if (scopeRule) {
        scopeRule.key_groups[0].age.push(publicKey);
      }
    });

    // Write updated config
    writeConfig(config);

    console.log(`Key generated for ${name} <${email}> in scope ${scopes}`);
    console.log(`Public Key: ${publicKey}`);
  },
});

const updateKeyScopeCommand = command({
  name: 'update',
  description:
    'Set user scopes (adds or removes access to match specified scopes)',
  args: {
    user: option({ type: string, long: 'user', description: 'User name' }),
    scopes: option({
      type: string,
      long: 'scopes',
      short: 's',
      description: 'Comma-separated list of scope IDs to grant access to',
    }),
  },
  handler: async ({ scopes: rawScopes, user }) => {
    const config = readConfig();
    const targetScopes = rawScopes ? rawScopes.split(',') : [];

    // Find the key by name
    const matchingRegistryKey = Object.entries(config.key_registry).find(
      ([_, details]) => details.owner === user,
    );

    if (!matchingRegistryKey) {
      console.error(`No key found for user '${user}'`);
      Deno.exit(1);
    }

    const [pubKey] = matchingRegistryKey;

    const scopesBeingRemoved = [] as string[];
    const scopesBeingAdded = [] as string[];

    // Update all scopes to either include or exclude the user
    config.creation_rules.forEach((scopeRule) => {
      const hasAccess = scopeRule.key_groups[0].age.includes(pubKey);
      const shouldHaveAccess = targetScopes.includes(scopeRule.id);

      if (shouldHaveAccess && !hasAccess) {
        // Add the key to the scope
        scopesBeingAdded.push(scopeRule.id);
        scopeRule.key_groups[0].age.push(pubKey);
      } else if (!shouldHaveAccess && hasAccess) {
        // Remove the key from the scope
        scopesBeingRemoved.push(scopeRule.id);
        scopeRule.key_groups[0].age = scopeRule.key_groups[0].age.filter(
          (key) => key !== pubKey,
        );
      }
    });

    // Prompt user to confirm changes
    console.log(`Updating access for user "${user}".`);

    if (scopesBeingAdded.length) {
      console.log(`Scopes being added: ${scopesBeingAdded.join(', ')}`);
    }
    if (scopesBeingRemoved.length) {
      console.log(`Scopes being removed: ${scopesBeingRemoved.join(', ')}`);
    }
    if (!scopesBeingAdded.length && !scopesBeingRemoved.length) {
      console.log('No changes to scopes.');
      Deno.exit(0);
    }

    const confirm = await prompt(
      'Are you sure you want to update access? (y/N)',
    );

    if (confirm !== 'y') {
      console.log('Aborted.');
      Deno.exit(1);
    }

    writeConfig(config);

    console.log(
      `Updated access for user ${user}. Now has access to: '${targetScopes.join(
        ', ',
      )}'`,
    );
  },
});

const listKeysCommand = command({
  name: 'list',
  description: 'List all encryption keys and scopes',
  args: {},
  handler: () => {
    const config = readConfig();

    console.log('User Keys:');
    console.log('=================');

    const keysById = Object.values(config.creation_rules).reduce(
      (acc, value) => {
        return {
          ...acc,
          [value.id]: {
            keys: value.key_groups[0].age,
            path: value.path_regex,
          },
        };
      },
      {} as Record<string, { keys: string[]; path?: string }>,
    );

    Object.entries(config.key_registry).forEach(([key, user]) => {
      const scopes = Object.entries(keysById).flatMap(([id, scope]) =>
        scope.keys.includes(key) ? id : [],
      );

      console.log(
        `User ${user.owner} <${
          user.email
        }> has access to scopes: (${scopes.join(', ')})`,
      );
    });
  },
});

const removeKeyCommand = command({
  name: 'remove',
  description: 'Remove a key',
  args: {
    name: nameOption,
    removePrivateKey: flag({
      long: 'remove-private-key',
      description: 'Remove the private key file',
    }),
  },
  handler: ({ name, removePrivateKey }) => {
    // Read config
    const config = readConfig();

    // Find the key
    const matchingKey = Object.entries(config.key_registry).find(
      ([_, details]) => details.owner === name,
    );

    if (!matchingKey) {
      console.error(`No key found for '${name}'`);
      Deno.exit(1);
    }

    const [publicKey] = matchingKey;

    // Remove from specified scope or all scopes
    config.creation_rules.forEach((rule) => {
      rule.key_groups[0].age = rule.key_groups[0].age.filter(
        (key) => key !== publicKey,
      );
    });

    delete config.key_registry[publicKey];

    // Write updated config
    writeConfig(config);

    console.log(`Removed key(s) for '${name}'`);

    if (removePrivateKey) {
      const keyPath = path.join('.age-keys', `${name}.txt`);
      Deno.removeSync(keyPath);
      console.log(`Removed private key file for '${name}'`);
    }
  },
});

export const keyCommands = subcommands({
  name: 'key',
  description: 'Key management commands',
  cmds: {
    generate: generateKeyCommand,
    update: updateKeyScopeCommand,
    list: listKeysCommand,
    remove: removeKeyCommand,
  },
});
