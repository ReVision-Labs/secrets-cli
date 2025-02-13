#!/usr/bin/env -S deno run -A

import { run, subcommands } from 'npm:cmd-ts';
import { keyCommands } from './services/keys.ts';
import { initCommand } from './services/init.ts';
import { scopeCommands } from './services/scope.ts';
import { decryptCommand, encryptCommand } from './services/encryption.ts';

// Main CLI structure
const cli = subcommands({
  name: 'secrets-cli',
  description: 'Age + SOPS Secret Management CLI',
  cmds: {
    init: initCommand,
    key: keyCommands,
    scope: scopeCommands,
    encrypt: encryptCommand,
    decrypt: decryptCommand,
  },
});

// Run the CLI
if (import.meta.main) {
  run(cli, Deno.args);
}
