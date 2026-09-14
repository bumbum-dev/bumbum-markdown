/**
 * List of main document themes.
 */
export const THEMES = [
    { name: 'modern', displayName: 'Modern' },
    { name: 'classic', displayName: 'Classic' },
    { name: 'minimal', displayName: 'Minimal' },
    { name: 'academic', displayName: 'Academic' },
    { name: 'corporate', displayName: 'Corporate' },
    { name: 'technical', displayName: 'Technical' },
    { name: 'github', displayName: 'GitHub' }
];

export function isValidTheme(name) {
    return THEMES.some(theme => theme.name === name);
}
