module.exports = {
  deployLocal: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'development']
  ],
  deployApothem: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'apothem']
  ],
  deployMainNet: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'mainnet'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'mainnet']
  ],
  deployTokensLocal: [
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'development']
  ],
  deployTokensApothem: [
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'apothem']
  ],
  migrateAndConfigureForTests: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/test/pre-deployment'],
    ['execute', '--path', 'scripts/migrations/deployment'],
    ['execute', '--path', 'scripts/migrations/test/configuration'],
    ['execute', '--path', 'scripts/migrations/test/post-deployment'],
  ],
}
