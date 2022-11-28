module.exports = {
  deployLocal: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development']
  ],
  deployApothem: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem']
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
    ['execute', '--path', 'scripts/migrations/tests'],
  ],
}
