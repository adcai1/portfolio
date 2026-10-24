export function renderProjects(projects, container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No projects to show yet.';
    container.append(emptyState);
    return;
  }

  for (const project of projects) {
    const article = document.createElement('article');
    const heading = document.createElement('h2');
    heading.textContent = project.title;

    const image = document.createElement('img');
    image.src = project.image;
    image.alt = project.alt || project.title;

    const description = document.createElement('p');
    description.textContent = project.description;

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `${project.category || 'Project'} • ${project.year || '2024'}`;

    const projectBody = document.createElement('div');
    projectBody.className = 'project-body';
    projectBody.append(description);

    if (project.link && project.link !== '#') {
      const link = document.createElement('a');
      link.href = project.link;
      link.textContent = 'View project';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      projectBody.append(link);
    }

    article.append(heading, image, meta, projectBody);
    container.append(article);
  }
}

async function loadProjects(url = './projects.json') {
  const container = document.querySelector('#projects');
  const title = document.querySelector('.projects-title');

  if (!container) {
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const projects = await response.json();

    if (title) {
      title.textContent = `Projects (${projects.length})`;
    }

    renderProjects(projects, container);
  } catch (error) {
    console.error(error);
    if (title) {
      title.textContent = 'Projects (0)';
    }
    container.innerHTML = '<p>Unable to load project data right now.</p>';
  }
}

if (document.querySelector('#projects')) {
  loadProjects();
}
