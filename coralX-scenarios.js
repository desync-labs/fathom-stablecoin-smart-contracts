module.exports = {
  deployLocal: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'development']
  ],
  deployApothem: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'apothem']
  ],
  deployTokensLocal: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'development']
  ],
  deployTokensApothem: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'apothem']
  ],
  migrateAndConfigureForTests: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/test/pre-deployment'],
    ['execute', '--path', 'scripts/migrations/deployment'],
    // ['execute', '--path', 'scripts/migrations/configuration'],
    ['execute', '--path', 'scripts/migrations/test/configuration'],
  ],
}
