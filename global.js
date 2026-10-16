const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'cv/', title: 'CV' },
  { url: 'https://github.com/adcai1', title: 'GitHub', external: true },
];

const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/portfolio/';

function normalizePath(path) {
  const value = new URL(path, location.href).pathname;

  if (value === '/index.html') {
    return '/';
  }

  return value.replace(/\/index\.html$/, '/');
}

const nav = document.createElement('nav');
const themeLabel = document.createElement('label');
themeLabel.className = 'color-scheme';
themeLabel.textContent = 'Theme:';

const themeSelect = document.createElement('select');
const options = [
  { value: 'light dark', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

for (const option of options) {
  const optionElement = document.createElement('option');
  optionElement.value = option.value;
  optionElement.textContent = option.label;
  themeSelect.append(optionElement);
}

themeLabel.append(themeSelect);
document.body.prepend(themeLabel);
document.body.prepend(nav);

const savedColorScheme =
  'colorScheme' in localStorage ? localStorage.colorScheme : 'light dark';

document.documentElement.style.setProperty('color-scheme', savedColorScheme);
themeSelect.value = savedColorScheme;

themeSelect.addEventListener('input', (event) => {
  const value = event.target.value;
  document.documentElement.style.setProperty('color-scheme', value);
  localStorage.colorScheme = value;
});

for (const page of pages) {
  let url = page.url;

  if (!page.external && !url.startsWith('http')) {
    url = BASE_PATH + url;
  }

  const link = document.createElement('a');
  link.href = url;
  link.textContent = page.title;

  if (page.external) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  if (
    normalizePath(link.href) === normalizePath(location.href) &&
    !(page.external)
  ) {
    link.classList.add('current');
  }

  nav.append(link);
}