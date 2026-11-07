import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const tooltip = document.getElementById('commit-tooltip');

function updateTooltipVisibility(isVisible) {
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  tooltip.style.left = `${event.clientX + 16}px`;
  tooltip.style.top = `${event.clientY + 16}px`;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (!commit || Object.keys(commit).length === 0) {
    return;
  }

  link.href = commit.url || '#';
  link.textContent = commit.id;
  date.textContent = commit.datetime.toLocaleString('en-US', { dateStyle: 'full' });
  time.textContent = commit.datetime.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  author.textContent = commit.author;
  lines.textContent = `${commit.totalLines} lines`;
}

async function loadData() {
  const data = await d3.csv('./loc.csv', (row) => {
    const datetime = new Date(`${row.date}T${row.time}:00`);

    return {
      ...row,
      lines: Number(row.lines),
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      language: row.language || 'Unknown',
    };
  });

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([id, rows]) => {
      const datetime = rows[0].datetime;
      const totalLines = d3.sum(rows, (d) => d.lines);

      return {
        id,
        author: rows[0].author,
        url: rows[0].url,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines,
        lines: rows,
      };
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');
  const stats = [
    ['Total LOC', d3.sum(data, (d) => d.lines)],
    ['Total commits', commits.length],
    ['Average lines/commit', Math.round(d3.mean(commits, (d) => d.totalLines) || 0)],
    ['Files touched', new Set(data.map((d) => d.path)).size],
  ];

  const list = container.append('dl').attr('class', 'stats');

  for (const [label, value] of stats) {
    list.append('dt').text(label);
    list.append('dd').text(value);
  }
}

function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderSelectionCount(selection, commits, xScale, yScale) {
  const selectedCommits = selection
    ? commits.filter((commit) => isCommitSelected(selection, commit, xScale, yScale))
    : [];
  const countElement = document.getElementById('selection-count');
  countElement.textContent =
    selectedCommits.length === 0
      ? 'No commits selected'
      : `${selectedCommits.length} commit${selectedCommits.length === 1 ? '' : 's'} selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection, commits, xScale, yScale) {
  const selectedCommits = selection
    ? commits.filter((commit) => isCommitSelected(selection, commit, xScale, yScale))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((commit) => commit.lines);
  const breakdown = d3.rollup(lines, (values) => values.length, (line) => line.language);

  container.innerHTML = '';

  for (const [language, count] of [...breakdown.entries()].sort((a, b) => b[1] - a[1])) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    const dt = document.createElement('dt');
    dt.textContent = language;

    const dd = document.createElement('dd');
    dd.textContent = `${count} lines (${formatted})`;

    container.append(dt, dd);
  }
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 12, right: 18, bottom: 50, left: 60 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right]);

  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
  const rScale = d3
    .scaleSqrt()
    .domain([0, d3.max(commits, (d) => d.totalLines) || 1])
    .range([3, 20]);

  const yTicks = d3.range(0, 25, 2);
  const colorScale = d3.scaleLinear().domain([0, 24]).range(['#1d4ed8', '#f97316']);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickSize(-usableArea.width).tickFormat(() => ''));

  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d')));

  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat((time) => `${time}:00`));

  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(commits, (a, b) => b.totalLines - a.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => colorScale(d.hourFrac))
    .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', () => {
      updateTooltipVisibility(false);
    });

  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', (event) => {
      const selection = event.selection;
      d3.selectAll('.dot').classed('selected', (d) => isCommitSelected(selection, d, xScale, yScale));
      const selectedCommits = renderSelectionCount(selection, commits, xScale, yScale);
      renderLanguageBreakdown(selection, commits, xScale, yScale);

      if (!selection && selectedCommits.length === 0) {
        d3.selectAll('.dot').classed('selected', false);
      }
    });

  svg.call(brush);
  svg.selectAll('.brush').lower();
  svg.selectAll('.dots').raise();
}

async function main() {
  const data = await loadData();
  const commits = processCommits(data);

  renderCommitInfo(data, commits);
  renderScatterPlot(data, commits);
}

main().catch((error) => {
  console.error('Failed to render meta analysis:', error);
  const stats = document.getElementById('stats');
  if (stats) {
    stats.innerHTML = '<p>Unable to load the project analysis right now.</p>';
  }
});
