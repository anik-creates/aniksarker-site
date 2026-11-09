// Minimal GitHub REST client used by the admin portal to read content and publish commits.
// Publishing uses the Git Data API so content.json and every new image land in ONE commit.

const API = 'https://api.github.com';

export class GitHub {
  constructor({ token, owner, repo, branch = 'main' }) {
    Object.assign(this, { token, owner, repo, branch });
  }

  async req(path, opts = {}) {
    const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); if (j.message) msg = `${j.message} (${res.status})`; } catch {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  get base() { return `/repos/${this.owner}/${this.repo}`; }

  /** Confirms the token works and can push to the repo. Returns { user, repo }. */
  async verify() {
    const [user, repo] = await Promise.all([this.req('/user'), this.req(this.base)]);
    if (!repo.permissions?.push) throw new Error(`Token for ${user.login} cannot write to ${this.owner}/${this.repo}`);
    return { user, repo };
  }

  async headSha() {
    const ref = await this.req(`${this.base}/git/ref/heads/${this.branch}`);
    return ref.object.sha;
  }

  /** Reads a UTF-8 text file. Returns { text, sha } or null if it doesn't exist. */
  async readText(path, ref = this.branch) {
    try {
      const f = await this.req(`${this.base}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
      const bytes = Uint8Array.from(atob(f.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
      return { text: new TextDecoder().decode(bytes), sha: f.sha };
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async history(path, perPage = 15) {
    return this.req(`${this.base}/commits?path=${encodeURIComponent(path)}&sha=${this.branch}&per_page=${perPage}`);
  }

  async treePaths(prefix) {
    const head = await this.headSha();
    const commit = await this.req(`${this.base}/git/commits/${head}`);
    const tree = await this.req(`${this.base}/git/trees/${commit.tree.sha}?recursive=1`);
    return tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(prefix)).map((t) => t.path);
  }

  /**
   * Commits a set of changes atomically.
   * files: [{ path, text } | { path, blob } | { path, delete: true }]
   * onStep(label) reports progress.
   */
  async commit(files, message, onStep = () => {}) {
    onStep('Reading latest version');
    const head = await this.headSha();
    const baseCommit = await this.req(`${this.base}/git/commits/${head}`);

    const tree = [];
    let n = 0;
    for (const f of files) {
      if (f.delete) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
      n++;
      onStep(`Uploading ${n} of ${files.filter((x) => !x.delete).length}: ${f.path.split('/').pop()}`);
      const content = f.blob ? await blobToBase64(f.blob) : utf8ToBase64(f.text);
      const blob = await this.req(`${this.base}/git/blobs`, { method: 'POST', body: JSON.stringify({ content, encoding: 'base64' }) });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    onStep('Creating commit');
    const newTree = await this.req(`${this.base}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) });
    const commit = await this.req(`${this.base}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) });
    onStep('Updating branch');
    await this.req(`${this.base}/git/refs/heads/${this.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    return commit;
  }

  async latestPagesBuild() {
    try { return await this.req(`${this.base}/pages/builds/latest`); } catch { return null; }
  }
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
