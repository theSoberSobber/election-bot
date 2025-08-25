const { Octokit } = require('@octokit/rest');

// GitHub configuration
const GITHUB_OWNER = 'theSoberSobber';
const PUBLIC_KEYS_REPO = 'Public-Keys';
const VOTES_REPO = 'Votes';

// Initialize Octokit with personal access token
function getOctokit() {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token) {
        throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN is required');
    }
    return new Octokit({ auth: token });
}

// Get file content from GitHub
async function getFileContent(owner, repo, path, branch = 'main') {
    try {
        const octokit = getOctokit();
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch
        });
        
        // Decode base64 content
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
            content,
            sha: response.data.sha
        };
    } catch (error) {
        if (error.status === 404) {
            return null; // File doesn't exist
        }
        throw error;
    }
}

// Create or update file in GitHub
async function createOrUpdateFile(owner, repo, path, content, message, sha = null, branch = 'main') {
    const octokit = getOctokit();
    
    const params = {
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch
    };
    
    // If SHA is provided, this is an update
    if (sha) {
        params.sha = sha;
    }
    
    const response = await octokit.rest.repos.createOrUpdateFileContents(params);
    return response.data;
}

// Delete file from GitHub
async function deleteFile(owner, repo, path, message, sha, branch = 'main') {
    const octokit = getOctokit();
    
    const response = await octokit.rest.repos.deleteFile({
        owner,
        repo,
        path,
        message,
        sha,
        branch
    });
    
    return response.data;
}

// List directory contents from GitHub
async function listDirectory(owner, repo, path = '', branch = 'main') {
    try {
        const octokit = getOctokit();
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch
        });
        
        if (Array.isArray(response.data)) {
            return response.data;
        } else {
            // Single file, not a directory
            return [response.data];
        }
    } catch (error) {
        if (error.status === 404) {
            return []; // Directory doesn't exist
        }
        throw error;
    }
}

// Submit user's public key to Public-Keys repository
async function submitPublicKey(userId, username, publicKey, electionName) {
    console.log(`🚀 Submitting public key for user: ${username} (${userId}) to GitHub`);
    
    try {
        // Create file paths
        const keyPath = `elections/${electionName}/users/${userId}/public_key.pem`;
        const infoPath = `elections/${electionName}/users/${userId}/info.json`;
        
        // Create user info object
        const userInfo = {
            userId: userId,
            username: username,
            submittedAt: new Date().toISOString()
        };
        
        // Upload public key file
        await createOrUpdateFile(
            GITHUB_OWNER,
            PUBLIC_KEYS_REPO,
            keyPath,
            publicKey,
            `Add/Update public key for user ${username} (${userId}) in election ${electionName}`
        );
        console.log('✅ Uploaded public key file to GitHub');
        
        // Upload user info file
        await createOrUpdateFile(
            GITHUB_OWNER,
            PUBLIC_KEYS_REPO,
            infoPath,
            JSON.stringify(userInfo, null, 2),
            `Add/Update user info for ${username} (${userId}) in election ${electionName}`
        );
        console.log('✅ Uploaded user info file to GitHub');
        
        console.log(`🎉 Successfully submitted public key for ${username} to GitHub!`);
        return true;
        
    } catch (error) {
        console.error('❌ Failed to submit public key to GitHub:', error.message);
        return false;
    }
}

// Submit candidate information to Public-Keys repository
async function submitCandidate(userId, username, name, emoji, agenda, electionName) {
    console.log(`🚀 Submitting candidate info for: ${name} (${username}) to GitHub`);
    
    try {
        // Create candidate info object
        const candidateInfo = {
            userId: userId,
            username: username,
            name: name,
            emoji: emoji,
            agenda: agenda,
            submittedAt: new Date().toISOString()
        };
        
        // Create file path
        const candidatePath = `elections/${electionName}/candidates/${userId}.json`;
        
        // Upload candidate file
        await createOrUpdateFile(
            GITHUB_OWNER,
            PUBLIC_KEYS_REPO,
            candidatePath,
            JSON.stringify(candidateInfo, null, 2),
            `Add/Update candidate ${name} (${username} - ${userId}) in election ${electionName}`
        );
        console.log('✅ Uploaded candidate file to GitHub');
        
        // Update candidates list
        const candidatesListPath = `elections/${electionName}/candidates.json`;
        let allCandidates = [];
        
        // Try to get existing candidates list
        const existingList = await getFileContent(GITHUB_OWNER, PUBLIC_KEYS_REPO, candidatesListPath);
        if (existingList) {
            try {
                allCandidates = JSON.parse(existingList.content);
            } catch (parseError) {
                console.warn('⚠️ Failed to parse existing candidates list, starting fresh');
                allCandidates = [];
            }
        }
        
        // Remove existing entry for this user if any, then add new one
        allCandidates = allCandidates.filter(c => c.userId !== userId);
        allCandidates.push(candidateInfo);
        
        // Upload updated candidates list
        await createOrUpdateFile(
            GITHUB_OWNER,
            PUBLIC_KEYS_REPO,
            candidatesListPath,
            JSON.stringify(allCandidates, null, 2),
            `Update candidates list for election ${electionName} (added ${name})`,
            existingList?.sha
        );
        console.log('✅ Updated candidates list on GitHub');
        
        console.log(`🎉 Successfully submitted candidate ${name} to GitHub!`);
        return true;
        
    } catch (error) {
        console.error('❌ Failed to submit candidate to GitHub:', error.message);
        return false;
    }
}

// Submit vote to Votes repository
async function submitVote(userId, username, signedMessage, electionName) {
    console.log(`🚀 Submitting vote for user: ${username} (${userId}) to GitHub`);
    
    try {
        // Create vote content
        const voteContent = `User: ${username} (${userId})
Election: ${electionName}
Timestamp: ${new Date().toISOString()}
Signed Message:
${signedMessage}`;
        
        // Create file path
        const votePath = `elections/${electionName}/votes/${userId}.txt`;
        
        // Upload vote file
        await createOrUpdateFile(
            GITHUB_OWNER,
            VOTES_REPO,
            votePath,
            voteContent,
            `Add vote from user ${username} (${userId}) in election ${electionName}`
        );
        console.log('✅ Uploaded vote file to GitHub');
        
        console.log(`🎉 Successfully submitted vote for ${username} to GitHub!`);
        return true;
        
    } catch (error) {
        console.error('❌ Failed to submit vote to GitHub:', error.message);
        return false;
    }
}

// Get candidates list for an election
async function getCandidatesList(electionName) {
    try {
        const candidatesListPath = `elections/${electionName}/candidates.json`;
        const result = await getFileContent(GITHUB_OWNER, PUBLIC_KEYS_REPO, candidatesListPath);
        
        if (result) {
            return JSON.parse(result.content);
        }
        return [];
    } catch (error) {
        console.error('❌ Failed to get candidates list from GitHub:', error.message);
        return [];
    }
}

// Clear all GitHub repositories (for reset command)
async function clearAllRepositories() {
    console.log('🔥 Clearing all GitHub repositories...');
    
    try {
        const octokit = getOctokit();
        const results = [];
        
        // Clear Public-Keys repository
        try {
            // Get all contents in root
            const publicKeysContents = await listDirectory(GITHUB_OWNER, PUBLIC_KEYS_REPO);
            
            // Delete all files except .git related ones
            for (const item of publicKeysContents) {
                if (item.name !== '.gitignore' && item.name !== 'README.md') {
                    if (item.type === 'file') {
                        await deleteFile(
                            GITHUB_OWNER,
                            PUBLIC_KEYS_REPO,
                            item.path,
                            '🔥 Bot reset - clearing all data',
                            item.sha
                        );
                    }
                    // Note: GitHub API doesn't allow deleting directories directly,
                    // they get removed automatically when all files are deleted
                }
            }
            
            // Create fresh README
            await createOrUpdateFile(
                GITHUB_OWNER,
                PUBLIC_KEYS_REPO,
                'README.md',
                '# Public Keys Repository\n\nBot was reset - all data cleared.\n',
                '🔥 Bot reset - all data cleared'
            );
            
            results.push('✅ Cleared Public-Keys repository');
        } catch (publicKeysError) {
            console.error('❌ Failed to clear Public-Keys repository:', publicKeysError.message);
            results.push('❌ Failed to clear Public-Keys repository');
        }
        
        // Clear Votes repository
        try {
            const votesContents = await listDirectory(GITHUB_OWNER, VOTES_REPO);
            
            for (const item of votesContents) {
                if (item.name !== '.gitignore' && item.name !== 'README.md') {
                    if (item.type === 'file') {
                        await deleteFile(
                            GITHUB_OWNER,
                            VOTES_REPO,
                            item.path,
                            '🔥 Bot reset - clearing all data',
                            item.sha
                        );
                    }
                }
            }
            
            // Create fresh README
            await createOrUpdateFile(
                GITHUB_OWNER,
                VOTES_REPO,
                'README.md',
                '# Votes Repository\n\nBot was reset - all data cleared.\n',
                '🔥 Bot reset - all data cleared'
            );
            
            results.push('✅ Cleared Votes repository');
        } catch (votesError) {
            console.error('❌ Failed to clear Votes repository:', votesError.message);
            results.push('❌ Failed to clear Votes repository');
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Failed to clear repositories:', error.message);
        return ['❌ Failed to clear repositories'];
    }
}

module.exports = {
    submitPublicKey,
    submitCandidate,
    submitVote,
    getCandidatesList,
    clearAllRepositories,
    getFileContent,
    createOrUpdateFile,
    deleteFile,
    listDirectory
};
