import { glob, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';

import latestVersion from 'latest-version';
import { detect, resolveCommand } from 'package-manager-detector';

const DEFAULT_EDITORCONFIG = `# https://editorconfig.org

root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
max_line_length = 100
quote_type = single
trim_trailing_whitespace = true

[{package-lock.json,yarn.lock,pnpm-lock.yaml}]
insert_final_newline = ignore

[*.md]
max_line_length = off
trim_trailing_whitespace = false
`;

export interface CreateOxfmtOptions {
  projectPath: string;
  preset: string | null;
  enableEditorConfig: boolean;
  enableVscodeSettings: boolean;
  enableHuskyLintStaged: boolean;
}

export default async function createOxfmt({
  projectPath,
  enableEditorConfig,
  enableVscodeSettings,
  enableHuskyLintStaged,
  preset,
}: CreateOxfmtOptions) {
  const packageJsonPath = `${projectPath}/package.json`;
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['format'] = 'oxfmt --write .';
  packageJson.scripts['format:check'] = 'oxfmt --check .';

  packageJson.devDependencies = packageJson.devDependencies || {};
  const [oxfmtVersion, presetVersion] = await Promise.all([
    latestVersion('oxfmt'),
    preset ? latestVersion(preset) : Promise.resolve(''),
  ]);
  packageJson.devDependencies['oxfmt'] = '^' + oxfmtVersion;
  if (preset) {
    packageJson.devDependencies[preset] = '^' + presetVersion;
  }
  delete packageJson.devDependencies['prettier'];

  // remove existing Prettier config
  delete packageJson.prettier;
  const prettierConfigFiles = await Array.fromAsync(
    glob(['.prettierrc*', 'prettier.config.*'], { cwd: projectPath }),
  );
  await Promise.all(
    prettierConfigFiles.map((file) => unlink(`${projectPath}/${file}`).catch(() => {})),
  );

  const configContent = preset
    ? `import { defineConfig } from 'oxfmt';\nimport preset from '${preset}';\n\nexport default defineConfig({\n  ...preset,\n});\n`
    : `import { defineConfig } from 'oxfmt';\n\nexport default defineConfig({});\n`;

  await writeFile(`${projectPath}/oxfmt.config.ts`, configContent, 'utf-8');

  if (enableHuskyLintStaged) {
    const [huskyVersion, lintStagedVersion] = await Promise.all([
      latestVersion('husky'),
      latestVersion('lint-staged'),
    ]);

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['prepare'] = 'husky';
    packageJson['lint-staged'] = { ...packageJson['lint-staged'], '*': 'oxfmt --write' };
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies['husky'] = '^' + huskyVersion;
    packageJson.devDependencies['lint-staged'] = '^' + lintStagedVersion;

    const pm = await detect({ cwd: projectPath });
    const executeCommand = resolveCommand(pm?.agent || 'npm', 'execute-local', ['lint-staged']);

    await mkdir(`${projectPath}/.husky`, { recursive: true });
    await writeFile(
      `${projectPath}/.husky/pre-commit`,
      `${executeCommand?.command} ${executeCommand?.args.join(' ')}\n`,
      'utf-8',
    );
  }

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

  if (enableEditorConfig) {
    await writeFile(`${projectPath}/.editorconfig`, DEFAULT_EDITORCONFIG, 'utf-8');
  }

  if (enableVscodeSettings) {
    const vscodeSettingsPath = `${projectPath}/.vscode/settings.json`;
    let vscodeSettings: any = {};
    try {
      vscodeSettings = JSON.parse(await readFile(vscodeSettingsPath, 'utf-8'));
    } catch (err) {
      await mkdir(`${projectPath}/.vscode`, { recursive: true });
    }
    vscodeSettings['editor.formatOnSave'] = true;
    vscodeSettings['editor.defaultFormatter'] = 'oxc.oxc-vscode';
    vscodeSettings['editor.rulers'] = [100];

    const prettierExtensions = ['esbenp.prettier-vscode', 'prettier.prettier-vscode'];
    const supportedLanguages = [
      'javascript',
      'javascriptreact',
      'typescript',
      'typescriptreact',
      'vue',
      'css',
      'less',
      'scss',
      'html',
      'json',
      'jsonc',
      'markdown',
      'toml',
      'yaml',
    ];
    for (const lang of supportedLanguages) {
      const key = `[${lang}]`;
      const langSettings = vscodeSettings[key];
      if (
        typeof langSettings === 'object' &&
        langSettings !== null &&
        prettierExtensions.includes(langSettings['editor.defaultFormatter'])
      ) {
        langSettings['editor.defaultFormatter'] = 'oxc.oxc-vscode';
      }
    }

    await writeFile(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, 2) + '\n', 'utf-8');

    // extensions
    const vscodeExtensionsPath = `${projectPath}/.vscode/extensions.json`;
    let vscodeExtensions: any = {};
    try {
      vscodeExtensions = JSON.parse(await readFile(vscodeExtensionsPath, 'utf-8'));
    } catch (err) {
      await mkdir(`${projectPath}/.vscode`, { recursive: true });
    }
    vscodeExtensions['recommendations'] = vscodeExtensions['recommendations'] || [];
    vscodeExtensions['recommendations'] = vscodeExtensions['recommendations'].filter(
      (ext: string) => ext !== 'esbenp.prettier-vscode' && ext !== 'prettier.prettier-vscode',
    );
    if (!vscodeExtensions['recommendations'].includes('oxc.oxc-vscode')) {
      vscodeExtensions['recommendations'].push('oxc.oxc-vscode');
    }
    await writeFile(
      vscodeExtensionsPath,
      JSON.stringify(vscodeExtensions, null, 2) + '\n',
      'utf-8',
    );
  }
}
