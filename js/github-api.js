class GitHubAPI {
  constructor() {
    this.token = getGithubToken();
    this.owner = 'pharmacy-nexus';
    this.repo = 'Quiz';
    this.baseUrl = 'https://api.github.com/repos';
  }

  setToken(token) {
    this.token = token;
    setGithubToken(token);
  }

  async validateToken(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getFile(path) {
    if (!this.token) return null;
    try {
      const url = `${this.baseUrl}/${this.owner}/${this.repo}/contents/${path}`;
      const response = await fetch(url, {
        headers: { Authorization: `token ${this.token}` }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return atob(data.content);
    } catch (error) {
      console.error('Error fetching file:', error);
      return null;
    }
  }

  async putFile(path, content, message) {
    if (!this.token) throw new Error('Not authenticated');
    try {
      const url = `${this.baseUrl}/${this.owner}/${this.repo}/contents/${path}`;
      const encodedContent = btoa(content);

      let sha = null;
      try {
        const getResponse = await fetch(url, {
          headers: { Authorization: `token ${this.token}` }
        });
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        }
      } catch {}

      const body = {
        message,
        content: encodedContent
      };
      if (sha) body.sha = sha;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `token ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error putting file:', error);
      throw error;
    }
  }

  async deleteFile(path, message) {
    if (!this.token) throw new Error('Not authenticated');
    try {
      const url = `${this.baseUrl}/${this.owner}/${this.repo}/contents/${path}`;

      const getResponse = await fetch(url, {
        headers: { Authorization: `token ${this.token}` }
      });
      if (!getResponse.ok) throw new Error('File not found');
      const fileData = await getResponse.json();

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `token ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          sha: fileData.sha
        })
      });

      if (!response.ok) throw new Error('Failed to delete file');
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async getDirectory(path) {
    if (!this.token) return [];
    try {
      const url = `${this.baseUrl}/${this.owner}/${this.repo}/contents/${path}`;
      const response = await fetch(url, {
        headers: { Authorization: `token ${this.token}` }
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error getting directory:', error);
      return [];
    }
  }
}

const github = new GitHubAPI();

async function loadDataFromGitHub() {
  const data = await fetch('data/index.json')
    .then(r => r.json())
    .catch(() => ({ subjects: [], quizSets: [] }));
  return data;
}

async function loadTopicQuestions(subject, topic) {
  const path = `data/${subject}/${topic}.json`;
  return await fetch(path)
    .then(r => r.json())
    .catch(() => ({ questions: [] }));
}
