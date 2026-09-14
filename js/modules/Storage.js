/**
 * Storage Module
 * Single point of access to localStorage for the whole app.
 */

const STORAGE_VERSION = 1;

/**
 * Read and unwrap the envelope for a key, tolerating pre-Storage-module data.
 * @param {string} key
 * @returns {*} The stored value, or undefined if the key is unset.
 */
function readEnvelope(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && '__v' in parsed && 'value' in parsed) {
            return parsed.value;
        }
        return parsed;
    } catch {
        return raw;
    }
}

/**
 * Get a value previously stored with setItem (or by legacy direct localStorage calls).
 * @param {string} key
 * @param {*} [defaultValue] - Returned when the key is unset or reading fails.
 * @returns {*}
 */
export function getItem(key, defaultValue = null) {
    try {
        const value = readEnvelope(key);
        return value === undefined ? defaultValue : value;
    } catch (error) {
        console.error(`Storage: failed to read "${key}"`, error);
        return defaultValue;
    }
}

/**
 * Store a value under key, version-tagged for future migrations.
 * @param {string} key
 * @param {*} value - Anything JSON-serializable.
 * @returns {boolean} Whether the write succeeded.
 */
export function setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify({ __v: STORAGE_VERSION, value }));
        return true;
    } catch (error) {
        console.error(`Storage: failed to write "${key}"`, error);
        return false;
    }
}

/**
 * Remove a stored key.
 * @param {string} key
 */
export function removeItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Storage: failed to remove "${key}"`, error);
    }
}
