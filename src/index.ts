import {readFile, writeFile} from 'fs/promises';
import latestVersion from 'latest-version';

export interface CreateOxfmtOptions {
    projectPath: string;
    preset: string | null;
    enableEditorConfig: boolean;
    enableVscodeSettings: boolean;
}

export default async function createOxfmt({ projectPath, enableEditorConfig, enableVscodeSettings, preset }: CreateOxfmtOptions) {
    const packageJsonPath = `${projectPath}/package.json`;
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['format'] = 'oxfmt --write .';
    packageJson.scripts['format:check'] = 'oxfmt --check .';

    packageJson.devDependencies = packageJson.devDependencies || {};
    const [oxfmtVersion, presetVersion] = await Promise.all([latestVersion('oxfmt'), preset ? latestVersion(preset) : Promise.resolve('')]);
    packageJson.devDependencies['oxfmt'] = '^' + oxfmtVersion;
    if (preset) {
        packageJson.devDependencies[preset] = '^' + presetVersion;
    }
    delete packageJson.devDependencies['prettier'];

    await writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        'utf-8'
    );
}