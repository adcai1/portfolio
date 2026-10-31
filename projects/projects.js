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
    const details = document.createElement('div');
    details.className = 'project-details';
    details.append(description);
    details.append(meta);
    projectBody.append(details);

    if (project.link && project.link !== '#') {
      const link = document.createElement('a');
      link.href = project.link;
      link.textContent = 'View project';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      projectBody.append(link);
    }

    article.append(heading, image, projectBody);
    container.append(article);
  }
}

const state = {
  allProjects: [],
  query: '',
  selectedYear: null,
};

function normalizeQuery(value) {
  return value.trim().toLowerCase();
}

function getVisibleProjects() {
  const query = normalizeQuery(state.query);

  return state.allProjects.filter((project) => {
    const matchesYear =
      state.selectedYear === null || String(project.year) === String(state.selectedYear);

    if (!query) {
      return matchesYear;
    }

    const values = Object.values(project).join('\n').toLowerCase();
    return matchesYear && values.includes(query);
  });
}

function updateTitle(count) {
  const title = document.querySelector('.projects-title');
  if (!title) {
    return;
  }

  title.textContent = `Projects (${count})`;
}

function renderChart(projects) {
  const svg = d3.select('#projects-pie-plot');
  const legend = d3.select('.legend');

  svg.selectAll('*').remove();
  legend.selectAll('*').remove();

  if (!projects.length) {
    svg.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('fill', 'currentColor')
      .style('font-size', '10px')
      .text('No matches');
    return;
  }

  const yearData = d3
    .rollups(projects, (values) => values.length, (project) => String(project.year))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(a.label) - Number(b.label));

  const colors = d3.scaleOrdinal(d3.schemeTableau10);
  const pieGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(48);
  const slices = pieGenerator(yearData);

  const group = svg.append('g');

  group
    .selectAll('path')
    .data(slices)
    .join('path')
    .attr('class', 'slice')
    .attr('d', arcGenerator)
    .attr('fill', (d) => colors(d.data.label))
    .attr('stroke', '#fff')
    .attr('stroke-width', (d) => (state.selectedYear === d.data.label ? 3 : 1.5))
    .attr('opacity', (d) =>
      state.selectedYear !== null && state.selectedYear !== d.data.label ? 0.6 : 1,
    )
    .style('cursor', 'pointer')
    .on('mouseenter', function () {
      d3.select(this).attr('stroke-width', 3);
    })
    .on('mouseleave', function (event, d) {
      d3.select(this).attr('stroke-width', state.selectedYear === d.data.label ? 3 : 1.5);
    })
    .on('click', function (event, d) {
      const nextYear = d.data.label;
      state.selectedYear = state.selectedYear === nextYear ? null : nextYear;
      renderProjectsList();
    });

  legend
    .selectAll('li')
    .data(yearData)
    .join('li')
    .attr('class', 'legend-item')
    .style('--color', (d) => colors(d.label))
    .style('cursor', 'pointer')
    .style('opacity', (d) =>
      state.selectedYear !== null && state.selectedYear !== d.label ? 0.6 : 1,
    )
    .each(function (d) {
      const item = d3.select(this);
      item.html('');
      item.append('span').attr('class', 'swatch');
      item.append('span').attr('class', 'legend-label').text(`${d.label} (${d.value})`);
    })
    .on('click', function (event, d) {
      state.selectedYear = state.selectedYear === d.label ? null : d.label;
      renderProjectsList();
    });
}

function renderProjectsList() {
  const container = document.querySelector('#projects');
  if (!container) {
    return;
  }

  const visibleProjects = getVisibleProjects();
  updateTitle(visibleProjects.length);
  renderProjects(visibleProjects, container);
  renderChart(visibleProjects);
}

async function loadProjects(url = './projects.json') {
  const container = document.querySelector('#projects');
  if (!container) {
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    state.allProjects = await response.json();
    renderProjectsList();

    const searchInput = document.querySelector('.searchBar');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        renderProjectsList();
      });
    }
  } catch (error) {
    console.error(error);
    updateTitle(0);
    container.innerHTML = '<p>Unable to load project data right now.</p>';
    const svg = d3.select('#projects-pie-plot');
    if (!svg.empty()) {
      svg.selectAll('*').remove();
    }
  }
}

if (document.querySelector('#projects')) {
  loadProjects();
}
