import { renderProjects } from './projects/projects.js';
import { fetchGitHubData } from './global.js';

const featuredProjects = document.querySelector('#featured-projects');

if (featuredProjects) {
  try {
    const response = await fetch('./projects/projects.json');

    if (!response.ok) {
      throw new Error(`Failed to fetch project data: ${response.status}`);
    }

    const projects = await response.json();
    renderProjects(projects.slice(0, 3), featuredProjects);
  } catch (error) {
    console.error(error);
    featuredProjects.innerHTML = '<p>Unable to load the latest projects right now.</p>';
  }
}

const githubStats = document.querySelector('#github-stats');

if (githubStats) {
  try {
    const data = await fetchGitHubData('adcai1');

    githubStats.innerHTML = `
      <div class="stat">
        <strong>${data.followers}</strong>
        <span>Followers</span>
      </div>
      <div class="stat">
        <strong>${data.following}</strong>
        <span>Following</span>
      </div>
      <div class="stat">
        <strong>${data.public_repos}</strong>
        <span>Public repos</span>
      </div>
    `;
  } catch (error) {
    console.error(error);
    githubStats.innerHTML = '<p>Unable to load GitHub stats right now.</p>';
  }
}
