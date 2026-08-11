import { confirm, intro, outro, path, text } from '@clack/prompts';
import { join } from 'node:path';

intro('🪄 create-oxfmt');

const projectPath = await path({
  message: 'Project path',
  initialValue: join(process.cwd(), process.argv[2] ?? '.'),
  directory: true,
  validate(value) {
    if (!value) return 'Project path is required';
  }
});

const enableVscodeSettings = await confirm({
  message: 'Enable VSCode settings?',
  initialValue: true
});

outro('🎉 You are all set! Run `npm format` to format your code.');