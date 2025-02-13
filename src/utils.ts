import * as path from 'https://deno.land/std@0.224.0/path/mod.ts';

export async function getGitConfig() {
  try {
    const nameCmd = new Deno.Command('git', {
      args: ['config', '--get', 'user.name'],
      stdout: 'piped',
    });
    const emailCmd = new Deno.Command('git', {
      args: ['config', '--get', 'user.email'],
      stdout: 'piped',
    });

    const [nameResult, emailResult] = await Promise.all([
      nameCmd.output(),
      emailCmd.output(),
    ]);

    return {
      name: nameResult.success
        ? new TextDecoder().decode(nameResult.stdout).trim()
        : '',
      email: emailResult.success
        ? new TextDecoder().decode(emailResult.stdout).trim()
        : '',
    };
  } catch {
    return { name: '', email: '' };
  }
}

export async function findIdentityFile(keyFile?: string): Promise<string> {
  // If key file is specified, validate and return it
  if (keyFile) {
    try {
      await Deno.stat(keyFile);
      return path.resolve(keyFile);
    } catch {
      throw new Error(`Key file not found: ${keyFile}`);
    }
  }

  // Otherwise look for default key in .age-keys
  try {
    const keys = Array.from(Deno.readDirSync('.age-keys')).filter(
      (entry) => entry.isFile && entry.name.endsWith('.txt'),
    );

    if (keys.length === 0) {
      throw new Error('No key files found in .age-keys directory');
    }

    const defaultKey = path.join('.age-keys', keys[0].name);
    console.log(`Using default key: ${defaultKey}`);
    return path.resolve(defaultKey);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error accessing .age-keys directory: ${error.message}`);
    }
    throw error;
  }
}

export async function validateFile(file: string): Promise<void> {
  try {
    await Deno.stat(file);
  } catch {
    console.error(`File not found: ${file}`);
    Deno.exit(1);
  }
}

export function ensureDir(dirPath: string) {
  try {
    Deno.mkdirSync(dirPath, { recursive: true });
  } catch {
    // Directory likely exists
  }
}

export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

interface SopsCommandOptions {
  args: string[];
  identityFile: string;
}

export async function executeSopsCommand({
  args,
  identityFile,
}: SopsCommandOptions): Promise<string> {
  const cmd = new Deno.Command('sops', {
    args: [
      '--config', '.sops.yaml',
      '--input-type', 'dotenv',
      '--output-type', 'dotenv',
      ...args
    ],
    stdout: 'piped',
    stderr: 'piped',
    env: {
      SOPS_AGE_KEY_FILE: identityFile,
    },
  });

  const { success, stdout, stderr } = await cmd.output();

  if (!success) {
    const error = new TextDecoder().decode(stderr);
    console.error('SOPS command failed:', error);
    throw new Error(error);
  }

  return new TextDecoder().decode(stdout);
}
