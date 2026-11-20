import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const tooltip = document.getElementById('commit-tooltip');
let commitProgress = 100;
let commits = [];
let filteredCommits = [];
let commitMaxTime;
let timeScale;
let xScale;
let yScale;
let rScale;

const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateTooltipVisibility(isVisible) {
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  tooltip.style.left = `${event.clientX + 16}px`;
  tooltip.style.top = `${event.clientY + 16}px`;
}

function renderTooltipContent(commit) {
  if (!commit) return;

  document.getElementById('commit-link').href = commit.url || '#';
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent =
    commit.datetime.toLocaleString('en-US', { dateStyle: 'full' });
  document.getElementById('commit-time').textContent =
    commit.datetime.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = `${commit.totalLines} lines`;
}

async function loadData() {
  return d3.csv('./loc.csv', (row) => {
    const datetime = new Date(`${row.date}T${row.time}:00`);
    return {
      ...row,
      file: row.path,
      type: row.language,
      lines: Number(row.lines),
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
    };
  });
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([id, rows]) => ({
      id,
      author: rows[0].author,
      url: rows[0].url,
      datetime: rows[0].datetime,
      hourFrac: rows[0].hourFrac,
      totalLines: d3.sum(rows, (d) => d.lines),
      lines: rows,
    }))
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(data, visibleCommits) {
  const container = d3.select('#stats');
  const visibleLines = visibleCommits.flatMap((commit) => commit.lines);
  const stats = [
    ['Total LOC', d3.sum(visibleLines, (d) => d.lines)],
    ['Total commits', visibleCommits.length],
    ['Average lines/commit', Math.round(d3.mean(visibleCommits, (d) => d.totalLines) || 0)],
    ['Files touched', new Set(visibleLines.map((d) => d.file)).size],
  ];

  container.selectAll('dl.stats').remove();
  const list = container.append('dl').attr('class', 'stats');
  for (const [label, value] of stats) {
    list.append('dt').text(label);
    list.append('dd').text(value);
  }
}

function isCommitSelected(selection, commit, x, y) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = x(commit.datetime);
  const cy = y(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function renderSelectionCount(selection, visibleCommits) {
  const selected = selection
    ? visibleCommits.filter((commit) => isCommitSelected(selection, commit, xScale, yScale))
    : [];
  const count = document.getElementById('selection-count');
  count.textContent = selected.length
    ? `${selected.length} commit${selected.length === 1 ? '' : 's'} selected`
    : 'No commits selected';
  return selected;
}

function renderLanguageBreakdown(selection, visibleCommits) {
  const selected = selection
    ? visibleCommits.filter((commit) => isCommitSelected(selection, commit, xScale, yScale))
    : [];
  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';

  if (!selected.length) return;
  const lines = selected.flatMap((commit) => commit.lines);
  const breakdown = d3.rollup(lines, (values) => values.length, (line) => line.type);

  for (const [language, count] of [...breakdown].sort((a, b) => b[1] - a[1])) {
    const dt = document.createElement('dt');
    dt.textContent = language;
    const dd = document.createElement('dd');
    dd.textContent = `${count} lines (${d3.format('.1~%')(count / lines.length)})`;
    container.append(dt, dd);
  }
}

function renderScatterPlot(data, visibleCommits) {
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

  xScale = d3
    .scaleTime()
    .domain(d3.extent(visibleCommits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right]);
  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
  rScale = d3
    .scaleSqrt()
    .domain([0, d3.max(visibleCommits, (d) => d.totalLines) || 1])
    .range([3, 20]);

  const colorScale = d3.scaleLinear().domain([0, 24]).range(['#1d4ed8', '#f97316']);

  svg.append('g').attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickValues(d3.range(0, 25, 2))
      .tickSize(-usableArea.width).tickFormat(() => ''));
  svg.append('g').attr('class', 'x-axis axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d')));
  svg.append('g').attr('class', 'y-axis axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickValues(d3.range(0, 25, 2)).tickFormat((time) => `${time}:00`));
  svg.append('g').attr('class', 'dots');

  const brush = d3.brush()
    .extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
    .on('start brush end', (event) => {
      d3.selectAll('.dot').classed(
        'selected',
        (commit) => isCommitSelected(event.selection, commit, xScale, yScale),
      );
      const selected = renderSelectionCount(event.selection, visibleCommits);
      renderLanguageBreakdown(event.selection, visibleCommits);
      if (!event.selection && !selected.length) {
        d3.selectAll('.dot').classed('selected', false);
      }
    });

  svg.call(brush);
  svg.selectAll('.brush').lower();
  svg.selectAll('.dots').raise();
  updateScatterPlot(data, visibleCommits);
}

function updateScatterPlot(data, visibleCommits) {
  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  const extent = d3.extent(visibleCommits, (d) => d.datetime);
  xScale.domain(extent[0] && extent[1] ? extent : [commitMaxTime, commitMaxTime]);
  rScale.domain([0, d3.max(visibleCommits, (d) => d.totalLines) || 1]);

  svg.select('g.x-axis')
    .selectAll('*')
    .remove();
  svg.select('g.x-axis').call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d')));

  const sortedCommits = d3.sort(visibleCommits, (a, b) => b.totalLines - a.totalLines);
  const dots = svg.select('g.dots');

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => d3.scaleLinear().domain([0, 24]).range(['#1d4ed8', '#f97316'])(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function updateFileDisplay(visibleCommits) {
  const lines = visibleCommits.flatMap((commit) => commit.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll(':scope > div')
    .data(files, (d) => d.name)
    .join(
      (enter) => enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dt').append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt code').text((d) => d.name);
  filesContainer.select('dt small').text((d) => `${d.lines.length} lines`);
  filesContainer
    .select('dd')
    .selectAll('div.loc')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`)
    .attr('title', (d) => `${d.type} · commit ${d.commit}`);
}

function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = Number(slider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });

  filteredCommits = commits.filter((commit) => commit.datetime <= commitMaxTime);
  renderCommitInfo([], filteredCommits);
  updateScatterPlot([], filteredCommits);
  updateFileDisplay(filteredCommits);
  renderLanguageBreakdown(null, filteredCommits);
  renderSelectionCount(null, filteredCommits);
}

function renderCommitStory(visibleCommits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(visibleCommits)
    .join('div')
    .attr('class', 'step')
    .html((commit, index) =>
      `On ${commit.datetime.toLocaleString('en')}, ` +
      `I made <a href="${commit.url}" target="_blank">` +
      `${index === 0 ? 'my first commit, and it was glorious' : 'another glorious commit'}</a>. ` +
      `I edited ${commit.totalLines} lines across ` +
      `${d3.rollups(commit.lines, (lines) => lines.length, (line) => line.file).length} files. ` +
      'Then I looked over all I made, and saw that it was good.',
    );
}

function onStepEnter(response) {
  const commit = response.element.__data__;
  if (!commit) return;
  commitMaxTime = commit.datetime;
  filteredCommits = commits.filter((item) => item.datetime <= commitMaxTime);
  commitProgress = timeScale(commitMaxTime);
  document.getElementById('commit-progress').value = String(commitProgress);
  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });
  renderCommitInfo([], filteredCommits);
  updateScatterPlot([], filteredCommits);
  updateFileDisplay(filteredCommits);
  renderLanguageBreakdown(null, filteredCommits);
  renderSelectionCount(null, filteredCommits);
}

async function main() {
  const data = await loadData();
  commits = processCommits(data);
  filteredCommits = commits;
  timeScale = d3.scaleTime()
    .domain(d3.extent(commits, (commit) => commit.datetime))
    .range([0, 100]);
  commitMaxTime = d3.max(commits, (commit) => commit.datetime);

  renderCommitInfo(data, commits);
  renderScatterPlot(data, commits);
  updateFileDisplay(commits);
  renderCommitStory(commits);

  const slider = document.getElementById('commit-progress');
  slider.addEventListener('input', onTimeSliderChange);
  onTimeSliderChange();

  const scroller = scrollama();
  scroller
    .setup({ container: '#scrolly-1', step: '#scrolly-1 .step', offset: 0.5 })
    .onStepEnter(onStepEnter);
}

main().catch((error) => {
  console.error('Failed to render meta analysis:', error);
  const stats = document.getElementById('stats');
  if (stats) stats.innerHTML = '<p>Unable to load the project analysis right now.</p>';
});
