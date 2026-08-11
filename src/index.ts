import { mkdir, readFile, writeFile } from 'fs/promises';
import latestVersion from 'latest-version';

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
}

export default async function createOxfmt({
  projectPath,
  enableEditorConfig,
  enableVscodeSettings,
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

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

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
    await writeFile(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, 2), 'utf-8');
  }
}
