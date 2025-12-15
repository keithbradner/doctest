// Re-export from shared BBCode parser
// This maintains backwards compatibility for server-side imports
const { parseBBCode, extractSections } = require('../shared/bbcode');

module.exports = { parseBBCode, extractSections };
