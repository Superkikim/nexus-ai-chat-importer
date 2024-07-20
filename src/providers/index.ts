import { GeneralChat } from '../types';
import { loadConfig, loadProvidersConfig } from '../utils';
import yaml from 'js-yaml';

export async function parseArchive(archivePath: string, provider: string): Promise<GeneralChat[]> {
  const providersConfig = await loadProvidersConfig();
  const providerInfo = providersConfig.providers[provider];

  if (!providerInfo) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const config = await loadConfig(provider);
  const parseFunction = (await import(providerInfo.handler)).parseArchive;

  if (!parseFunction) {
    throw new Error(`Handler for provider ${provider} does not export a parseArchive function`);
  }

  return await parseFunction(archivePath, config);
}

async function loadProvidersConfig(): Promise<any> {
  const response = await fetch('/src/config/providers.yaml');
  if (!response.ok) {
    throw new Error('Failed to load providers configuration');
  }
  const text = await response.text();
  return yaml.load(text);
}
