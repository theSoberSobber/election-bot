import { Octokit } from '@octokit/rest';
import { Election, PrivateGist, GistIndex, GistIndexEntry, Vote, CommonData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const MICROCOINS_PER_COIN = parseInt(process.env.MICROCOINS_PER_COIN || '1000000');
const GIST_INDEX_ID = process.env.GIST_INDEX_ID;
const GIST_CONFIG_FILE = path.join(process.cwd(), '.gist_config.json');

let octokit: Octokit;
let gistIndexId: string | null = null;

interface GistConfig {
  gistIndexId: string;
  createdAt: string;
}

function saveGistConfig(gistId: string): void {
  try {
    const config: GistConfig = {
      gistIndexId: gistId,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(GIST_CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`Saved gist config to ${GIST_CONFIG_FILE}`);
  } catch (error) {
    console.error('Failed to save gist config:', error);
  }
}

function loadGistConfig(): string | null {
  try {
    if (fs.existsSync(GIST_CONFIG_FILE)) {
      const configData = fs.readFileSync(GIST_CONFIG_FILE, 'utf8');
      const config: GistConfig = JSON.parse(configData);
      console.log(`Loaded existing gist config: ${config.gistIndexId} (created: ${config.createdAt})`);
      return config.gistIndexId;
    }
  } catch (error) {
    console.error('Failed to load gist config:', error);
  }
  return null;
}

export async function initializeGithubStorage(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  // Initialize or load gist index (priority: env var > local file > create new)
  if (GIST_INDEX_ID) {
    gistIndexId = GIST_INDEX_ID;
    console.log(`Using gist index from environment: ${gistIndexId}`);
  } else {
    const localGistId = loadGistConfig();
    if (localGistId) {
      gistIndexId = localGistId;
      console.log(`Using existing gist index from local config: ${gistIndexId}`);
    } else {
      await initializeGistIndex();
    }
  }
}

async function initializeGistIndex(): Promise<void> {
  const initialIndex: GistIndex = {
    maintainer: 'ElectionBot',
    entries: {},
  };

  try {
    const response = await octokit.gists.create({
      description: 'ElectionBot Gist Index',
      public: false,
      files: {
        'gist_index.json': {
          content: JSON.stringify(initialIndex, null, 2),
        },
      },
    });

    gistIndexId = response.data.id || null;
    if (gistIndexId) {
      saveGistConfig(gistIndexId);
      console.log(`Created new gist index: ${gistIndexId}`);
    }
  } catch (error) {
    console.error('Failed to create gist index:', error);
    throw error;
  }
}

export async function getGistIndex(): Promise<GistIndex> {
  if (!gistIndexId) {
    throw new Error('Gist index not initialized');
  }

  try {
    const response = await octokit.gists.get({ gist_id: gistIndexId });
    const content = response.data.files?.['gist_index.json']?.content;
    
    if (!content) {
      throw new Error('Gist index file not found');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to get gist index:', error);
    throw error;
  }
}

export async function updateGistIndex(index: GistIndex): Promise<void> {
  if (!gistIndexId) {
    throw new Error('Gist index not initialized');
  }

  try {
    await octokit.gists.update({
      gist_id: gistIndexId,
      files: {
        'gist_index.json': {
          content: JSON.stringify(index, null, 2),
        },
      },
    });
  } catch (error) {
    console.error('Failed to update gist index:', error);
    throw error;
  }
}

export async function getPublicGist(guildId: string): Promise<Election | null> {
  try {
    const index = await getGistIndex();
    const entry = index.entries[guildId];
    
    if (!entry) {
      return null;
    }

    const response = await octokit.gists.get({ gist_id: entry.publicGistId });
    const content = response.data.files?.['election.json']?.content;
    
    if (!content) {
      throw new Error('Public gist file not found');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to get public gist:', error);
    return null;
  }
}

export async function updatePublicGistAtomic(
  guildId: string,
  transformFn: (election: Election) => Election
): Promise<Election> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const current = await getPublicGist(guildId);
      if (!current) {
        throw new Error('No election found for guild');
      }

      const updated = transformFn(current);
      updated.meta.version += 1;
      updated.meta.lastUpdated = new Date().toISOString();

      const index = await getGistIndex();
      const entry = index.entries[guildId];

      await octokit.gists.update({
        gist_id: entry.publicGistId,
        files: {
          'election.json': {
            content: JSON.stringify(updated, null, 2),
          },
        },
      });

      return updated;
    } catch (error) {
      lastError = error as Error;
      if (retry < maxRetries - 1) {
        console.warn(`Retry ${retry + 1} for atomic update:`, error);
        await new Promise(resolve => setTimeout(resolve, 100 * (retry + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to update public gist after retries');
}

export async function getPrivateGist(guildId: string): Promise<PrivateGist | null> {
  try {
    const index = await getGistIndex();
    const entry = index.entries[guildId];
    
    if (!entry) {
      return null;
    }

    const response = await octokit.gists.get({ gist_id: entry.privateGistId });
    const content = response.data.files?.['private_votes.json']?.content;
    
    if (!content) {
      return { electionId: entry.electionId, votes: [] };
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to get private gist:', error);
    return null;
  }
}

export async function appendVoteAtomic(guildId: string, vote: Vote): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const current = await getPrivateGist(guildId);
      if (!current) {
        throw new Error('No private gist found for guild');
      }

      current.votes.push(vote);

      const index = await getGistIndex();
      const entry = index.entries[guildId];

      await octokit.gists.update({
        gist_id: entry.privateGistId,
        files: {
          'private_votes.json': {
            content: JSON.stringify(current, null, 2),
          },
        },
      });

      return;
    } catch (error) {
      lastError = error as Error;
      if (retry < maxRetries - 1) {
        console.warn(`Retry ${retry + 1} for vote append:`, error);
        await new Promise(resolve => setTimeout(resolve, 100 * (retry + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to append vote after retries');
}

export async function createElectionGists(
  guildId: string,
  initialElection: Election
): Promise<GistIndexEntry> {
  try {
    // Check if we need to create a common gist
    const index = await getGistIndex();
    let commonGistId = index.entries[guildId]?.commonGistId;
    
    if (!commonGistId) {
      commonGistId = await createCommonGist(guildId);
    }

    // Create public gist
    const publicResponse = await octokit.gists.create({
      description: `ElectionBot Election Data - Guild ${guildId}`,
      public: false,
      files: {
        'election.json': {
          content: JSON.stringify(initialElection, null, 2),
        },
      },
    });

    // Create private gist
    const initialPrivate: PrivateGist = {
      electionId: initialElection.electionId,
      votes: [],
    };

    const privateResponse = await octokit.gists.create({
      description: `ElectionBot Private Votes - Guild ${guildId}`,
      public: false,
      files: {
        'private_votes.json': {
          content: JSON.stringify(initialPrivate, null, 2),
        },
      },
    });

    // Update gist index
    const entry: GistIndexEntry = {
      publicGistId: publicResponse.data.id!,
      privateGistId: privateResponse.data.id!,
      commonGistId: commonGistId,
      electionId: initialElection.electionId,
      createdAt: initialElection.createdAt,
    };

    index.entries[guildId] = entry;
    await updateGistIndex(index);

    return entry;
  } catch (error) {
    console.error('Failed to create election gists:', error);
    throw error;
  }
}

export async function deleteElectionGists(guildId: string): Promise<void> {
  try {
    const index = await getGistIndex();
    const entry = index.entries[guildId];
    
    if (!entry) {
      throw new Error('No election found for guild');
    }

    // Delete election and private gists
    await Promise.all([
      octokit.gists.delete({ gist_id: entry.publicGistId }),
      octokit.gists.delete({ gist_id: entry.privateGistId }),
    ]);

    // Note: We don't delete the common gist as it contains persistent data
    // Remove from index
    delete index.entries[guildId];
    await updateGistIndex(index);
  } catch (error) {
    console.error('Failed to delete election gists:', error);
    throw error;
  }
}

// === COMMON GIST FUNCTIONS (Persistent Data) ===

export async function getCommonGist(guildId: string): Promise<CommonData | null> {
  try {
    const index = await getGistIndex();
    const entry = index.entries[guildId];
    
    if (!entry || !entry.commonGistId) {
      return null;
    }

    const response = await octokit.gists.get({ gist_id: entry.commonGistId });
    const content = response.data.files?.['common_data.json']?.content;
    
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to get common gist:', error);
    return null;
  }
}

export async function updateCommonGist(guildId: string, commonData: CommonData): Promise<void> {
  try {
    const index = await getGistIndex();
    const entry = index.entries[guildId];
    
    if (!entry || !entry.commonGistId) {
      throw new Error('Common gist not found for guild');
    }

    commonData.meta.lastUpdated = new Date().toISOString();
    commonData.meta.version += 1;

    await octokit.gists.update({
      gist_id: entry.commonGistId,
      files: {
        'common_data.json': {
          content: JSON.stringify(commonData, null, 2),
        },
      },
    });
  } catch (error) {
    console.error('Failed to update common gist:', error);
    throw error;
  }
}

export async function updateCommonGistAtomic<T>(
  guildId: string,
  updateFunction: (commonData: CommonData) => CommonData | { commonData: CommonData; returnValue: T }
): Promise<T extends undefined ? CommonData : T> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const current = await getCommonGist(guildId);
      if (!current) {
        throw new Error('Common data not found');
      }

      const currentVersion = current.meta.version;
      const result = updateFunction(current);
      
      let updatedData: CommonData;
      let returnValue: T | undefined;
      
      if (result && typeof result === 'object' && 'commonData' in result) {
        updatedData = result.commonData;
        returnValue = result.returnValue;
      } else {
        updatedData = result as CommonData;
      }

      // Optimistic concurrency control
      if (updatedData.meta.version !== currentVersion + 1) {
        updatedData.meta.version = currentVersion + 1;
      }

      await updateCommonGist(guildId, updatedData);
      
      return (returnValue !== undefined ? returnValue : updatedData) as T extends undefined ? CommonData : T;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
  
  throw new Error('Failed to update after maximum retries');
}

export async function createCommonGist(guildId: string): Promise<string> {
  const initialCommonData: CommonData = {
    guildId,
    balances: {},
    meta: {
      version: 1,
      lastUpdated: new Date().toISOString(),
    },
  };

  try {
    const response = await octokit.gists.create({
      description: `ElectionBot Common Data for Guild ${guildId}`,
      public: false,
      files: {
        'common_data.json': {
          content: JSON.stringify(initialCommonData, null, 2),
        },
      },
    });

    return response.data.id!;
  } catch (error) {
    console.error('Failed to create common gist:', error);
    throw error;
  }
}

export function coinsToMicrocoins(coins: number): number {
  return Math.round(coins * MICROCOINS_PER_COIN);
}

export function microcoinsToCoins(microcoins: number): number {
  return microcoins / MICROCOINS_PER_COIN;
}
