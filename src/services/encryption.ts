import { command, option, optional, string } from 'npm:cmd-ts';
import { fileOption, keyFileOption } from '../params.ts';
import {
  validateFile,
  findIdentityFile,
  executeSopsCommand,
} from '../utils.ts';
import * as path from 'https://deno.land/std@0.224.0/path/mod.ts';

const outputFileOption = option({
  type: optional(string),
  long: 'output',
  short: 'o',
  description: 'The output file to write the decrypted content to',
});

export const encryptCommand = command({
  name: 'encrypt',
  description: 'Encrypt a file',
  args: {
    file: fileOption,
    keyFile: keyFileOption,
    outputFile: outputFileOption,
  },
  handler: async ({ file, keyFile, outputFile }) => {
    await validateFile(file);
    try {
      const identityFile = await findIdentityFile(keyFile);

      const output = await executeSopsCommand({
        args: ['-e', file],
        identityFile,
      });

      const encryptedFilePath = path.resolve(outputFile || `${file}.enc`);

      Deno.writeTextFileSync(encryptedFilePath, output);

      console.log(`Encrypted ${file} to ${encryptedFilePath}`);
    } catch (error) {
      console.error(
        'Encryption error:',
        error instanceof Error ? error.message : error,
      );
      Deno.exit(1);
    }
  },
});

export const decryptCommand = command({
  name: 'decrypt',
  description: 'Decrypt a file',
  args: {
    file: fileOption,
    keyFile: keyFileOption,
    outputFile: outputFileOption,
  },
  handler: async ({ file, keyFile, outputFile }) => {
    await validateFile(file);

    try {
      const identityFile = await findIdentityFile(keyFile);
      const output = await executeSopsCommand({
        args: ['-d', file],
        identityFile,
      });

      const decryptedFilePath = path.resolve(
        outputFile || file.replace(/.enc$/, ''),
      );

      Deno.writeTextFileSync(decryptedFilePath, output);

      console.log(`Decrypted (${file}): ${decryptedFilePath}`);
    } catch (error) {
      console.error(
        'Decryption error:',
        error instanceof Error ? error.message : error,
      );
      Deno.exit(1);
    }
  },
});
