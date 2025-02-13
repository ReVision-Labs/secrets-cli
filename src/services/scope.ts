import {
  option,
  string,
  command,
  subcommands,
} from 'npm:cmd-ts';
import { readConfig, writeConfig } from '../config.ts';

const createScopeCommand = command({
  name: 'create-scope',
  description: 'Create a new encryption scope',
  args: {
    id: option({ type: string, long: 'id' }),
    path: option({ type: string, long: 'path' }),
  },
  handler: ({ id, path: scopePath }) => {
    // Read config
    const config = readConfig();

    // Check if scope already exists
    if (config.creation_rules.some((rule) => rule.id === id)) {
      console.error(`Scope '${id}' already exists`);
      Deno.exit(1);
    }

    // Create new scope
    config.creation_rules.push({
      id,
      ...(scopePath ? { path_regex: scopePath } : {}),
      key_groups: [{ age: [] }],
    });

    // Write updated config
    writeConfig(config);

    console.log(
      `Created new scope '${id}'${
        scopePath ? ` with path '${scopePath}'` : ''
      }`,
    );
  },
});



export const scopeCommands = subcommands({
  name: 'scope',
  description: 'Scope management commands',
  cmds: {
    create: createScopeCommand,
    list: command({
      name: 'list',
      description: 'List all scopes',
      args: {},
      handler: () => {
        console.log('List of scopes:');

        const config = readConfig();

        config.creation_rules.forEach((rule) => {
          console.log(
            `  - "${rule.id}" ${rule.path_regex ? `(Path: ${rule.path_regex})` : ''}`,
          );
        });
      },
    }),
  },
});
