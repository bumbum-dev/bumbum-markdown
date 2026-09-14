/**
 * Code block themes
 */
export const CODE_THEMES = [
    { name: 'default', displayName: 'Default', hljsUrl: null },
    { name: 'github', displayName: 'GitHub', hljsUrl: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css' },
    { name: 'monokai', displayName: 'Monokai', hljsUrl: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/monokai.min.css' },
    { name: 'dracula', displayName: 'Dracula', hljsUrl: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/dracula.min.css' },
    { name: 'solarized-dark', displayName: 'Solarized Dark', hljsUrl: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/base16/solarized-dark.min.css' },
    { name: 'atom-one-dark', displayName: 'Atom One Dark', hljsUrl: 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css' }
];

export function isValidCodeTheme(name) {
    return CODE_THEMES.some(theme => theme.name === name);
}

export function getCodeTheme(name) {
    return CODE_THEMES.find(theme => theme.name === name);
}
