import { intro, outro, text } from '@clack/prompts';
import { join } from 'node:path';

intro('🪄 create-oxfmt');

const projectPath = await text({
  message: 'Project path',
  initialValue: join(process.cwd(), process.argv[2] ?? '.'),
  validate(value) {
    if (!value) return 'Project name is required';
  }
});

outro('🎉 You are all set! Run `npm format` to format your code.');