#!/usr/bin/env node

import { join } from 'node:path';

import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  path,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { detect, resolveCommand } from 'package-manager-detector';
import validateNpmPackageName from 'validate-npm-package-name';
import { execa } from 'execa';

import * as locales from './messages';
import createOxfmt from '.';

intro('create-oxfmt 🪄');

const messages = locales[process.env.LANG?.startsWith('zh') ? 'zh' : 'en'];

const projectPath = await path({
  message: messages.projectPath,
  initialValue: join(process.cwd(), process.argv[2] ?? '.'),
  directory: true,
});

if (isCancel(projectPath)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

let preset: symbol | string | null = await select({
  message: messages.choosePreset,
  options: [
    { value: null, label: messages.none },
    { value: '@guoyunhe/oxfmt-config', label: 'Guo Yunhe' },
    { value: '__custom__', label: messages.custom },
  ],
});

if (isCancel(preset)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

if (preset === '__custom__') {
  preset = await text({
    message: messages.customPresetPackageName,
    placeholder: '@foobar/oxfmt-config or oxfmt-config-foobar',
    validate: (value) => {
      if (!value) {
        return messages.packageNameRequired;
      }
      const { validForNewPackages } = validateNpmPackageName(value);
      if (!validForNewPackages) {
        return messages.invalidPackageName;
      }
    },
  });

  if (isCancel(preset)) {
    cancel(messages.operationCancelled);
    process.exit(0);
  }
}

const enableEditorConfig = await confirm({
  message: messages.enableEditorConfig,
  initialValue: true,
});

if (isCancel(enableEditorConfig)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

const enableHuskyLintStaged = await confirm({
  message: messages.enableHuskyLintStaged,
  initialValue: true,
});

if (isCancel(enableHuskyLintStaged)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

const enableVscodeSettings = await confirm({
  message: messages.enableVscodeSettings,
  initialValue: true,
});

if (isCancel(enableVscodeSettings)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

await createOxfmt({
  projectPath,
  preset,
  enableEditorConfig,
  enableVscodeSettings,
  enableHuskyLintStaged,
});

const installDependencies = await confirm({
  message: messages.installDependencies,
  initialValue: true,
});

if (isCancel(installDependencies)) {
  cancel(messages.operationCancelled);
  process.exit(0);
}

if (installDependencies) {
  const pm = await detect({ cwd: projectPath });
  const installCommand = resolveCommand(pm?.agent || 'npm', 'install', []) || {
    command: 'npm',
    args: ['install'],
  };

  const s = spinner();
  s.start(messages.installingDependencies);

  await execa(installCommand.command, installCommand.args, { cwd: projectPath });

  s.stop(messages.dependenciesInstalled);
}

outro(messages.congratulations);
