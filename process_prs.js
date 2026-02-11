const fs = require('fs');
const https = require('https');

// Function to fetch data from GitHub API
function fetchFromGitHub(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      headers: {
        'User-Agent': 'dependabot-pr-dashboard'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Function to fetch PRs from GitHub
function fetchPRs() {
  return fetchFromGitHub('/search/issues?q=org:agrc+author:dependabot[bot]+is:pull-request+is:open+archived:false&per_page=100');
}

// Function to fetch repository details
async function fetchRepoDetails(owner, repo) {
  return fetchFromGitHub(`/repos/${owner}/${repo}`);
}

// Generate HTML with Tailwind classes
function generateHTML(data, repoDetails) {
  // Group PRs by repository and add repo metadata
  const repoMap = {};

  data.items.forEach(pr => {
    const repoFullName = pr.repository_url.split('/').slice(-2).join('/');
    const repoName = pr.repository_url.split('/').pop();

    if (!repoMap[repoFullName]) {
      const details = repoDetails[repoFullName] || {};
      repoMap[repoFullName] = {
        name: repoName,
        fullName: repoFullName,
        url: `https://github.com/${repoFullName}`,
        language: details.language || 'Unknown',
        topics: details.topics || [],
        prs: []
      };
    }

    repoMap[repoFullName].prs.push({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      created: pr.created_at,
      updated: pr.updated_at
    });
  });

  // Convert to array and sort by PR count
  const repos = Object.values(repoMap).sort((a, b) => b.prs.length - a.prs.length);

  // Collect all unique languages and topics
  const allLanguages = [...new Set(repos.map(r => r.language))].sort();
  const allTopics = [...new Set(repos.flatMap(r => r.topics))].sort();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependabot Pull Requests</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#4d2a54',
              secondary: '#eaca00'
            }
          }
        }
      }
    </script>
    <style>
      .gradient-bg {
        background: linear-gradient(135deg, #4d2a54 0%, #eaca00 100%);
      }
      .pr-count-gradient {
        background: linear-gradient(135deg, #4d2a54, #eaca00);
      }
      .expanded .expand-icon {
        transform: rotate(180deg);
      }
    </style>
</head>
<body class="min-h-screen gradient-bg p-8">
    <div class="max-w-7xl mx-auto">
        <header class="text-center text-white mb-8">
            <h1 class="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">🤖 Dependabot Pull Requests</h1>
            <p class="text-xl opacity-90">Open pull requests from Dependabot across all repositories</p>
            <div class="flex flex-col md:flex-row justify-center gap-4 mt-6">
                <div class="bg-white/20 backdrop-blur-lg px-8 py-4 rounded-xl">
                    <div class="text-3xl font-bold" id="total-prs">${data.total_count}</div>
                    <div class="text-sm opacity-90">Total PRs</div>
                </div>
                <div class="bg-white/20 backdrop-blur-lg px-8 py-4 rounded-xl">
                    <div class="text-3xl font-bold" id="repo-count">${repos.length}</div>
                    <div class="text-sm opacity-90">Repositories</div>
                </div>
            </div>
        </header>

        <!-- Filters -->
        <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8">
            <h2 class="text-white text-xl font-semibold mb-4">🔍 Filters</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label for="language-filter" class="block text-white text-sm font-medium mb-2">Language</label>
                    <select id="language-filter" class="w-full px-4 py-2 rounded-lg bg-white/90 backdrop-blur text-gray-800 border-0 focus:ring-2 focus:ring-primary">
                        <option value="">All Languages</option>
                        ${allLanguages.map(lang => `<option value="${lang}">${lang}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-white text-sm font-medium mb-2">Topics (select multiple)</label>
                    <div class="bg-white/90 backdrop-blur rounded-lg p-3 max-h-48 overflow-y-auto">
                        ${allTopics.length > 0 ? allTopics.map(topic => `
                            <label class="flex items-center py-1 cursor-pointer hover:bg-gray-100 px-2 rounded">
                                <input type="checkbox" value="${topic}" class="topic-checkbox mr-2 w-4 h-4 text-primary rounded focus:ring-primary focus:ring-2">
                                <span class="text-gray-800 text-sm">${topic}</span>
                            </label>
                        `).join('') : '<p class="text-gray-500 text-sm">No topics available</p>'}
                    </div>
                </div>
            </div>
            <button onclick="clearFilters()" class="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">
                Clear Filters
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="repos-grid">
            ${repos.map(repo => `
                <div class="repo-card bg-white rounded-xl p-6 shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer relative"
                     onclick="toggleRepo(this)"
                     data-language="${repo.language}"
                     data-topics="${repo.topics.join(',')}">
                    <div class="flex justify-between items-start mb-2">
                        <a href="${repo.url}" class="text-xl font-semibold text-gray-800 hover:text-primary transition-colors" onclick="event.stopPropagation()" target="_blank">${repo.name}</a>
                        <div class="pr-count-gradient text-white px-4 py-2 rounded-full font-bold text-lg min-w-[50px] text-center">${repo.prs.length}</div>
                    </div>
                    <div class="mb-4">
                        <span class="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full mr-2">
                            ${repo.language}
                        </span>
                        ${repo.topics.slice(0, 2).map(topic =>
                            `<span class="inline-block px-2 py-1 bg-primary/20 text-primary text-xs rounded-full mr-1">${topic}</span>`
                        ).join('')}
                        ${repo.topics.length > 2 ? `<span class="text-gray-500 text-xs">+${repo.topics.length - 2}</span>` : ''}
                    </div>
                    <div class="hidden pr-list mt-4 border-t-2 border-gray-200 pt-4 max-h-96 overflow-y-auto">
                        ${repo.prs.map(pr => `
                            <div class="p-3 mb-2 bg-gray-50 rounded-lg border-l-4 border-primary hover:bg-gray-100 transition-colors">
                                <a href="${pr.url}" class="font-semibold text-primary text-sm hover:underline" target="_blank">#${pr.number}</a>
                                <div class="text-gray-800 mt-1 text-sm leading-relaxed">${pr.title}</div>
                                <div class="text-gray-500 text-xs mt-1">Updated: ${new Date(pr.updated).toLocaleDateString()}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="expand-icon absolute bottom-4 right-4 text-gray-400 text-2xl transition-transform duration-300">▼</div>
                </div>
            `).join('')}
        </div>
    </div>

    <script>
        const reposData = ${JSON.stringify(repos)};

        function toggleRepo(card) {
            card.classList.toggle('expanded');
            const prList = card.querySelector('.pr-list');
            prList.classList.toggle('hidden');
        }

        function filterRepos() {
            const languageFilter = document.getElementById('language-filter').value;
            const selectedTopics = Array.from(document.querySelectorAll('.topic-checkbox:checked')).map(cb => cb.value);
            const cards = document.querySelectorAll('.repo-card');

            let visibleCount = 0;
            let visiblePRCount = 0;

            cards.forEach(card => {
                const cardLanguage = card.dataset.language;
                const cardTopics = card.dataset.topics.split(',').filter(t => t);

                const languageMatch = !languageFilter || cardLanguage === languageFilter;
                // If topics are selected, repo must have at least one of the selected topics
                const topicMatch = selectedTopics.length === 0 || selectedTopics.some(topic => cardTopics.includes(topic));

                if (languageMatch && topicMatch) {
                    card.classList.remove('hidden');
                    visibleCount++;
                    // Count PRs from this repo
                    const prCount = parseInt(card.querySelector('.pr-count-gradient').textContent);
                    visiblePRCount += prCount;
                } else {
                    card.classList.add('hidden');
                }
            });

            // Update stats
            document.getElementById('repo-count').textContent = visibleCount;
            document.getElementById('total-prs').textContent = visiblePRCount;
        }

        function clearFilters() {
            document.getElementById('language-filter').value = '';
            document.querySelectorAll('.topic-checkbox').forEach(cb => cb.checked = false);
            filterRepos();
        }

        // Attach filter listeners
        document.getElementById('language-filter').addEventListener('change', filterRepos);
        document.querySelectorAll('.topic-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', filterRepos);
        });

        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.expanded').forEach(card => {
                    card.classList.remove('expanded');
                    card.querySelector('.pr-list').classList.add('hidden');
                });
            }
        });
    </script>
</body>
</html>`;
}

// Main execution
(async () => {
  try {
    console.log('Fetching Dependabot PRs from GitHub...');
    const data = await fetchPRs();

    // Get unique repositories
    const uniqueRepos = [...new Set(data.items.map(pr =>
      pr.repository_url.split('/').slice(-2).join('/')
    ))];

    console.log(`Fetching details for ${uniqueRepos.length} repositories...`);
    const repoDetails = {};

    // Fetch repository details in batches to avoid rate limiting
    for (const repoFullName of uniqueRepos) {
      const [owner, repo] = repoFullName.split('/');
      try {
        const details = await fetchRepoDetails(owner, repo);
        repoDetails[repoFullName] = {
          language: details.language,
          topics: details.topics || []
        };
        process.stdout.write('.');
      } catch (error) {
        console.warn(`\nWarning: Could not fetch details for ${repoFullName}`);
        repoDetails[repoFullName] = { language: 'Unknown', topics: [] };
      }
    }
    console.log('\n');

    console.log('Generating HTML...');
    const html = generateHTML(data, repoDetails);

    fs.writeFileSync('dependabot-prs.html', html);
    console.log(`✓ Generated dependabot-prs.html with ${uniqueRepos.length} repositories and ${data.total_count} PRs`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
