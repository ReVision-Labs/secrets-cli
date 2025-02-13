import { option, optional, string } from 'npm:cmd-ts';
import { getGitConfig } from './utils.ts';

const gitConfig = await getGitConfig();

// Common options
export const nameOption = option({
  type: string,
  long: 'name',
  short: 'n',
  defaultValue: () => gitConfig.name,
});

export const emailOption = option({
  type: string,
  long: 'email',
  short: 'e',
  defaultValue: () => gitConfig.email,
});

export const scopesOption = option({
  type: string,
  long: 'scopes',
  short: 's',
  description: 'Comma-separated list of scope IDs to grant access to',
  defaultValue: () => 'default',
});

export const fileOption = option({
  type: string,
  long: 'file',
  short: 'f',
});

export const keyFileOption = option({
  type: optional(string),
  long: 'key-file',
  short: 'k',
  description: 'Path to the age key file (defaults to first key in .age-keys)',
});
