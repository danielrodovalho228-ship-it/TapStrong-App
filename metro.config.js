// Sentry's Metro config: adds debug ids so crash stack traces map to source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
