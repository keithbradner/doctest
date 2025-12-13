// Re-export from shared BBCode parser
// This maintains backwards compatibility for server-side imports
const { parseBBCode } = require('../shared/bbcode');

module.exports = { parseBBCode };
